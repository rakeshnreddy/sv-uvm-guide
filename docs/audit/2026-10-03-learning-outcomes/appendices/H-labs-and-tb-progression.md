> **Provenance.** Area report produced during the 2026-10-03 learning-outcome audit by a read-only review agent, then reviewed by the lead auditor. Key claims were spot-checked against source, the running site, IEEE 1800-2023 (repo `system_verilog_lrm.pdf`), and Arm IHI0033 text. Line numbers refer to commit `488f7f43`. Items fixed in the same session are listed in [../audit-report.md](../audit-report.md) §9; everything else is open.

# Lab Platform & Lab Content Audit — practical testbench-building competence

Repo: `/Users/Rakesh/Projects/sv-uvm-guide` @ `488f7f43` (read-only audit, 2026-10-03).
Scope: all 29 `content/curriculum/labs/**/lab.json` manifests and every asset; `src/generated/lab-registry.ts`, `src/lib/lab-registry.ts`, `src/lib/lab-graders.ts`, `src/lib/lab-assets.ts`, `src/server/labs.ts`, `src/app/api/labs/run`, `src/app/api/me/labs/**`, `src/app/api/simulate/**`, `src/server/simulation/*`, `simulation-runner/*`, `scripts/compile-sv-solutions.mjs`, `scripts/generate-lab-registry.mjs`, `scripts/validate-content-manifests.mjs`, `tests/qa/labsPlatformAudit.spec.ts`, `src/app/(learning)/practice/**`, `src/components/practice/PracticeHub.tsx`, `src/components/ui/CodeExecutionEnvironment.tsx`, `src/components/mdx/LabLink.tsx`.

**Method / limits.** No SystemVerilog simulator exists on the audit machine (`verilator`, `iverilog`, `docker`, `vcs`, `xrun`, `vsim` all absent). I did not install one, so no lab was executed. Semantic claims come from reading the code by hand against IEEE 1800 and IEEE 1800.2 behavior; confidence is stated for each one. I checked CI evidence read-only: GitHub run `29693855900` (the PR #391 merge that is now `main`) logged `Compiled 23 SystemVerilog reference files with …verilator-docker.sh` (Verilator v5.050, `--lint-only`). In other words, every reference file **lints**. That says nothing about whether they elaborate, run, or behave as their READMEs claim.

---

## 0. Executive summary

* **Completion means nothing.** The 21 available labs have **63 steps**. **61 are `self_attested`**: the learner clicks "Mark step complete" and nothing is checked (`LabClientPage.tsx:217-258`, `src/server/labs.ts:95-151`). The other 2 steps (`basics-1`) are "graded" by a token-sequence match for `int myVar ;` and `myVar = 10 ;` (`src/lib/lab-graders.ts:53`). That grader has nothing to do with the lab's refactoring README.
* **Simulation is off by default, and when it is on it can't run most labs.** `/api/simulate` returns 503 `SIMULATION_EXECUTION_NOT_CONFIGURED` unless `SIMULATION_QUEUE_URL` or `SIMULATION_LOCAL_DOCKER=true` is set (`src/server/simulation/index.ts:146`; `.env.example` leaves the URL empty). Even when enabled:
  * The runner image has no UVM library (`simulation-runner/Dockerfile:4`), so 10 of 21 available labs can't compile.
  * Only *editable* SV files are sent (`LabClientPage.tsx:69-72,337-343`). Most labs mark the top-level `testbench.sv` as read-only `reference`, so the workspace has no top module.
  * `coverage` is hard-coded to `0` and `waveformKey` to `null` (`run-simulator.py:56-57`).
  * `passed` is just the process exit code (`run-simulator.py:53`). It is not tied to any lab's expected log signature.
* **Several flagship solutions don't do what their READMEs claim** (traced by hand, not executed):
  * **Mini UVM capstone:** the monitor samples `full/empty/level` with `default input #0`, i.e. *after* the DUT's NBA update. Reads that drain the FIFO and writes that fill it are mis-classified, so the "fixed-DUT" run should produce scoreboard mismatches and then hit the 100 µs timeout (LAB-C1).
  * **AHB checker:** its assertions can't detect either injected `BROKEN_MODE` bug (LAB-P3).
  * **AHB→AXI bridge:** the bridge never asserts `WLAST` on multi-beat bursts, its checker doesn't look, and `LAB PASS` is printed unconditionally (LAB-P5).
  * **Callbacks:** the callback is registered on a null `env.drv` (LAB-U3).
  * **Custom phase:** a runtime phase is inserted into the common domain (LAB-U4).
  * **Randomization:** the "silently failing" randomize never fails (LAB-S3).
  * **Formal harness:** the "masking" assumption doesn't mask the bug (LAB-S5).
  * **Scoreboard decoupling:** the starter is already solved, and the README teaches that `write()` can block (LAB-U1).
* **Prerequisites are decorative.** `labPrerequisites` and `modulePrerequisites` are never enforced or shown. Six available UVM labs list `simple-dut-1` as a prerequisite, which is a *coming-soon*, non-UVM AND-gate lab. Some module prerequisites dangle (`A-UVM-1`, `systemverilog-basics`) and two are lab IDs filed as modules.
* **TB-mastery path:** M1 (clocking-block TB), M5 (multi-agent + virtual sequences) and M8 (code-level SoC/subsystem capstone) have **no runnable lab**. M2/M3/M4/M6/M7 are Partial at best. **No milestone has meaningful automated checks**, and **no milestone has an independent (unscaffolded) task.**

---

## 1. Lab inventory

Legend:
* **SA** = self_attested; **G** = graded.
* "Real work?" = does the starter differ meaningfully from the solution and require the target skill.
* "Obs. criteria" = does the README give observable success criteria (log lines, mismatch counts, coverage numbers).
* LOC are file line counts.
* Path is relative to `content/curriculum/labs/`.

| # | id | Title | Path | owningModule | Status | labPrereq | modulePrereq | Steps / policy | Editable starters (LOC) | Solution (LOC) | Real work? | Obs. criteria | Bug/debug exercise | UVM? | Linked from (MDX) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ahb-axi-bridge-debug | AHB-to-AXI Bridge Debug | ahb_axi_bridge/lab1_bridge_debug | B-AMBA-F1 | available | – | ahb-checker-lab, axi-scoreboard-lab (**lab IDs in module field**) | 3 SA | bridge_split_checker.sv (145), testbench.sv (340, contains DUT) | solution.sv (181) | Yes: 3 SVA + counter. Fix is 1 line (`beats+1`) | Partial: AW log lines + `LAB PASS` (printed unconditionally, LAB-P5) | Yes (split bug) | No | B-AMBA-F1 index.mdx:334 |
| 2 | ahb-checker-lab | AHB-Lite Monitor & Checker | ahb_checker/lab1_monitor_checker | B-AHB-3 | available | – | B-AHB-1, B-AHB-2 | 3 SA | ahb_monitor.sv (74), ahb_checker.sv (78); testbench.sv (349) **read-only** | solution.sv (120) | Yes | Claims "≥2 assertions fire in BROKEN_MODE"; unachievable (LAB-P3) | Yes (BROKEN_MODE A/B) | No | B-AHB-3 index.mdx:503 |
| 3 | arbiter-1 | Arbiter Verification | arbiter | I-UVM-2A | coming_soon | simple-dut-1 | – | 0 | none (test_arbiter.sv 56, reference) | none | n/a | No | No | No (desc. says UVM module) | none |
| 4 | assertions-1 | Assertions Fundamentals | assertions | I-SV-4A | coming_soon | – | – | 0 | none (dut.sv 72, testbench.sv 67 reference) | solution_assertions.sv (55) | No starter checker | "assertion failure message" | Yes (pipeline corruption) | No | none |
| 5 | axi-deadlock-hunt-lab | AXI Deadlock Hunt | axi_deadlock/lab1_hunt | B-AXI-5 | available | – | axi-scoreboard-lab (**lab ID**) | 3 SA | axi_deadlock_checker.sv (52); testbench.sv (336) read-only | solution.sv (122) | Yes (6 props + 3 bounds) | Signal-state description only; no pass signature | Analysis only; **no "fix the master" step** | No | B-AXI-5 index.mdx:199 |
| 6 | axi-scoreboard-lab | AXI Out-of-Order Scoreboard | axi_scoreboard/lab1_out_of_order | B-AXI-6 | available | – | B-AXI-1, B-AXI-3 | 3 SA | axi_monitor.sv (75), axi_scoreboard.sv (35); testbench.sv (124) read-only | solution.sv (164) | Yes, but **starter cannot compile** (LAB-P1) | "report MATCHES" (vague) | No mutants / negative tests | Yes | B-AXI-6 index.mdx:245 |
| 7 | basics-1 | SV Basics: Variables and Assignment | basics/lab1_refactoring | F2D | available | – | – | **2 G** (`sv-basics-v1`) | work/dut_counter.sv (15), work/tb_counter_unrefactored.sv (72) | solution/tb_counter_refactored.sv (63) | README = task refactor; **grader = `int myVar;`** (LAB-G1) | No expected counts | No | No | F2D index.mdx:14 |
| 8 | common-1 | Common Structures | common | F2C | coming_soon | basics-1 | – | 0 | none (4 RTL refs) | none | n/a | No | No | No | none |
| 9 | config-debug | Null Virtual Interface | config_debug | I-UVM-2C | available | simple-dut-1 | – | 3 SA | src/dv/driver.sv (30), src/dv/testbench.sv (46); env.sv, my_if.sv read-only | src/dv/solution.sv (86) | 1-token fix (`viiif`→`vif`) | `[DRV] Wiggling pins` signature **not printed by code** (LAB-U2) | Yes (string typo) | Yes | I-UVM-2C index.mdx:99 |
| 10 | constructs-1 | SV Constructs | constructs | F2B | coming_soon | – | – | 0 | none (2 testbenches, reference) | 2 × solution.sv (65, 41) | n/a | Partial | Yes (races) | No | none (but F4C index.mdx:108 names "The Race Condition Lab") |
| 11 | coverage-advanced-1 | Advanced Coverage | coverage_advanced/lab1_closure_loop | I-SV-3B | available | – | – | 3 SA | alu_cov_mon.sv (44), testbench.sv (32) | **none** | Small (add DIV, add `dist`) | `SUCCESS: Coverage Closed!`, but **steps can't reach 100%** (LAB-S4) | No | No | I-SV-3B closure-workflow.mdx:48 |
| – | (orphan) | State Machine Bug Hunt | coverage_advanced/lab1_state_machine_bug_hunt | – | **no lab.json** | – | – | – | fsm_buggy.sv (35) | fsm_solution.sv (40; CI-linted) | – | – | – | No | none |
| 12 | dma-1 | DMA Verification | dma | I-UVM-3B | coming_soon | arbiter-1 | – | 0 | none (test_dma.sv 71) | none | n/a | No | No | No | none |
| 13 | fifo-1 | FIFO Implementation | fifo | I-SV-1 | coming_soon | common-1 | – | 0 | none (test_fifo.sv 63) | none | n/a | No | No | No | none |
| 14 | formal-harness | Formal Assumption Harness | formal_harness/lab1_assumption_harness | E-INT-1 | available | – | – | 3 SA | testbench_buggy.sv (81) | testbench_solution.sv (73) | Comment out one `assume` | "proven"/"counterexample"; needs a formal tool the platform lacks | Narrative wrong (LAB-S5) | No | E-INT-1 index.mdx:197,236 |
| 15 | ipc-deadlock | Semaphore Deadlock | ipc_deadlock | I-SV-5 | available | – | systemverilog-basics (**dangling**) | 3 SA | **none**: src/testbench.sv (59) read-only | **none** | Learner cannot edit in-app (LAB-S6) | `Test finished successfully!` (good) but bug fires only ~38% of runs | Yes (key leak) | No | I-SV-5 index.mdx:24 |
| 16 | methodology-custom-phase | Injecting a Custom UVM Phase | methodology_customization/lab1_custom_phase | E-CUST-1 | available | simple-dut-1 | – | 3 SA | testbench.sv (103) | solution.sv (104) | Yes (but `exec_task` hook omitted from starter/steps) | Expected log ≠ solution messages/timestamps (LAB-U4) | No | Yes | E-CUST-1 index.mdx:201 |
| 17 | power-aware-retention | Retention Bug & Isolation Sequencing | power_aware/lab1_retention_bug | E-PWR-1 | available | – | – | 2 SA | buggy_tb.sv (62) | solution_tb.sv (63) | Trivial reorder of 3 statements | "Check the waveform" (no DUT, no UPF, no checks) | Nominal | No | E-PWR-1 index.mdx:143 |
| 18 | pss-portable-intent | Memory R/W Portable Intent | pss/lab1_portable_intent | E-PSS-1 | available | – | A-UVM-1 (**dangling**), E-PSS-1 | 3 SA | starter/mem_test.pss (55) | solution/mem_test.pss (67), generated_uvm_sequence.sv (62), generated_baremetal_test.c (27) | Fill-in constraints | Example log text only | No | Generated UVM seq | E-PSS-1 index.mdx:293 |
| 19 | ral-mirror-bug | RAL Mirror Bug | ral_advanced/lab1_mirror_bug | A-UVM-4B | available | simple-dut-1 | – | 3 SA | testbench_buggy.sv (154) | testbench_solution.sv (275) | 1-line fix; **starter not runnable** (LAB-U5) | Error text + milestones | Yes (missing connect) | Yes | A-UVM-4B index.mdx:136 |
| 20 | randomization-advanced-1 | Advanced Randomization | randomization_advanced/lab1_dependent_fields | I-SV-2B | available | – | – | 3 SA | packet.sv (34), packet_buggy.sv (34), test.sv (25) | packet_solution.sv (42), solves a **different** problem | Premise false (LAB-S3) | Nominal | No | I-SV-2B solver-debug.mdx:93 |
| 21 | scoreboard-reference-model | Self-Checking Scoreboard w/ Ref Model | scoreboard/lab1_reference_model | A-UVM-6 | available | scoreboard-decoupling | – | 3 SA | testbench.sv (247) | solution.sv (105, scoreboard class only; wiring in comments) | Yes | "All 20 … PASS" | Manual "corrupt the ref model" | Yes | A-UVM-6 index.mdx:357 |
| 22 | scoreboard-decoupling | Scoreboard Decoupling | scoreboard_decoupling | I-UVM-2B | available | simple-dut-1 | – | 3 SA | src/dv/env.sv (29), src/dv/scoreboard.sv (43) | **none** | **No: starters already contain the answer** (LAB-U1) | None | No | Yes | I-UVM-2B index.mdx:152 |
| 23 | simple-dut-1 | Simple DUT Verification | simple_dut | F4 (ambiguous prefix) | coming_soon | – | – | 0 | work/tb_and_gate.sv (32) | solution/tb_and_gate.sv (51) | Yes | "PASSED/FAILED" lines | "Experiment: insert a bug" | No (desc. says "basic UVM testbench") | none |
| 24 | soc-vip-reuse | Block to SoC: VIP Modes | soc_level/lab1_vip_reuse | E-SOC-1 | available | simple-dut-1 | – | 3 SA | testbench.sv (97) | solution.sv (182) | 1-line `config_db::set` | Expected log (good) | Collision is simulated by an `if (is_active)` tautology | Yes | E-SOC-1 index.mdx:137 |
| 25 | soc-strategy-capstone | Staff-Level SoC Strategy Review | soc_level/lab2_soc_strategy_capstone | E-SOC-1 | available | soc-vip-reuse, uvm-mini-capstone | – | 4 SA | strategy_template.md (91) | model_solution.md (86) | Document | Countable acceptance criteria, self-scored | n/a | n/a | E-SOC-1 index.mdx:139 |
| 26 | callbacks-driver-behavior | Driver Behavior via Callbacks | uvm_callbacks/lab1_driver_behavior | A-UVM-5 | available | simple-dut-1 | – | 3 SA | testbench.sv (132) | solution.sv (182) | Small; **starter cannot compile** (LAB-U3) | "driver prints delay and parity" | Parity injected, nothing checks it | Yes | A-UVM-5 index.mdx:212 |
| 27 | uvm-mini-capstone | Mini UVM FIFO Env Capstone | uvm_capstone/lab1_fifo_env | A-UVM-6 | available | scoreboard-reference-model, scoreboard-decoupling | – | 4 SA | testbench.sv (355) | solution.sv (554) | **Yes: the only substantial build lab** | 0 mismatches, ≥90% coverage, `MISSED_BUG` check (good design) | Yes (`INJECT_FIFO_BUG`) | Yes | I-UVM-1B:188, I-UVM-2A:116, I-UVM-2B:160, I-UVM-3A:138, A-UVM-6:361 |
| 28 | debug-waveform-trigger | Triggering Waveforms via Event Bus | uvm_debug/lab1_waveform_trigger | E-DBG-1 | available | config-debug | – | 3 SA | testbench.sv (111) | solution.sv (126) | Small (~20-line subscriber) | "capture starts" | Teaches post-failure capture (LAB-U6) | Yes | E-DBG-1 index.mdx:53 |
| 29 | uvm-performance-1 | UVM Performance Metrics | uvm_performance | E-PERF-1 | coming_soon | – | – | 0 | lab1_bottleneck/tb_buggy.sv (73) | tb_solution.sv (155) | n/a | References non-existent `scoreboard.sv`, `env.sv`, `make run` | Yes | Yes | none |

**Totals.**
* 29 manifests: 21 available, 8 coming_soon.
* Available labs: 63 steps; 61 SA and 2 G (token match).
* 10/21 available labs need UVM.
* 3 available labs ship no solution: coverage-advanced-1, ipc-deadlock, scoreboard-decoupling.
* 1 available lab has no editable file (ipc-deadlock).
* 1 available lab has nothing to do (scoreboard-decoupling).
* Coming-soon labs are not linked through `LabLink`. However, F4C names "The Race Condition Lab" as if it exists (`F4C_Clocking_Blocks/index.mdx:108`), and F4B names a non-existent "Refactor a legacy testbench to use interfaces" lab (`F4B_Interfaces_and_Modports/index.mdx:149`).
* `PracticeHub.tsx:165-183` renders every lab, including coming-soon ones, as a `<Link href="/practice/lab/<id>">`. Those routes call `notFound()` (`practice/lab/[labId]/page.tsx:29`), so coming-soon cards lead to a 404.
* The hub is not ordered by progression and shows no prerequisites.

Owning-module mismatches (metadata only):
* `constructs-1` → F2B (Dynamic Structures), but the content is scheduling races (F3B/F3C/F4C).
* `common-1` → F2C, "structs/enums/arrays", but the content is 4 RTL files.
* `simple-dut-1` → "F4", which matches F4A/B/C by prefix only (`generate-lab-registry.mjs:80-82`); its README cites a non-existent "F4: Your First Testbench".
* `fifo-1` → I-SV-1 (OOP), but the content is a procedural FIFO TB.

---

## 2. Quality review of each available lab's solution code

### 2.1 What CI actually checks

`scripts/compile-sv-solutions.mjs`:
* Selects files whose path matches `/(?:^|[/_-])solution(?:[/_.-]|$)/` and `.sv/.svh` (L21-23). That is **23 files**: 13 UVM, 10 non-UVM. One of them is in the unregistered `fsm_solution.sv` folder.
* Runs each file **alone** with `verilator --lint-only --timing -Wall -Wno-fatal` (L51), prepending `uvm_pkg.sv` when needed.
* There is no elaboration with the lab's real file set, no `--binary`, no simulation, and no expected-output check. Warnings never fail.
* Locally the script **exits 0 when no compiler is installed** (L26-33); see `test-results/project-analysis/sv-solutions.log`.

What CI therefore never touches:
* Starters, read-only testbenches, and DUTs that are not in a solution file. This is why the non-compiling starters (axi-scoreboard, callbacks) and broken reference RTL (`common/rtl/arbiter.sv` uses the keyword `priority` as a variable name, L35) are uncaught.
* Lab packaging (whether the editable set compiles).
* Runtime behavior: every runtime defect below passes CI.
* `scoreboard/lab1_reference_model/solution.sv` is only a class plus commented wiring, so linting it proves nothing about the lab.

### 2.2 Per-lab solution findings (available labs)

Format: **finding**, then evidence, then confidence. Severity and fixes are in §7.

**uvm-mini-capstone** (`uvm_capstone/lab1_fifo_env/solution.sv`)
* **LAB-C1: the monitor samples "before" state after the DUT has updated it.**
  * `monitor_cb` uses `default input #0` (L98-101). IEEE 1800 clocking semantics: an explicit `#0` input skew samples in the **Observed** region, after NBA updates.
  * The monitor stores `full_before = cb.full`, `empty_before = cb.empty`, `depth_before = cb.level` (L278-281). Those are the *post-edge* values from the same edge where the DUT accepted push/pop.
  * So `pop_accepted = pop && !empty_before` (L289) is false for any read that drains the FIFO, and `push_accepted` is false for the write that fills it.
  * Hand trace of `fifo_capstone_seq` (L175-190) on the **fixed** DUT:
    * Read #1 (1→0) is not modeled.
    * The next accepted read expects `00` but sees `A5`, so SCB_MISMATCH.
    * Write `44` (3→4) is not modeled.
    * Three further reads mismatch.
    * Only 4 reads are checked, against `CAPSTONE_READ_COUNT = 7` (L14, L371).
    * `wait_until_idle()` never returns, so `TIMEOUT` fatal at 100 µs (L550-553). `UNEXPECTED_MISMATCH` and `READ_COUNT` errors also fire.
  * The `#0` was evidently chosen so the registered `dout` could be read on the same edge. Sampling control/level with `#1step` and `dout` with `#0` (or one cycle later) would fix it.
  * Confidence: **Medium-High** (LRM semantics high; end-to-end trace by hand; simulator-dependent clocking implementations, Verilator in particular, may differ, which is itself a portability problem).
* **LAB-C2: the scoreboard is coupled to the test.** `CAPSTONE_READ_COUNT` hard-codes the sequence length into the scoreboard's idle/end-of-test logic (L371-388). A "reusable" scoreboard knows the test's stimulus. Learners copy this pattern. Confidence High.
* `depth_before`/`depth_cp` measure *post* depth (follows from LAB-C1). The `op_x_depth` "read when full" bin therefore can't be hit as designed. Medium-High.
* Positive design choices worth keeping: `INJECT_FIFO_BUG` with a `MISSED_BUG` check in `report_phase` (L397-405), drain check of `observed_fifo`, factory override proven by `get_type_name()`. These are exactly the right ingredients for mutation-style grading once the monitor is correct.
* Minor: `rst_n` is released with a blocking assignment at `posedge` (L540-541) while the DUT's async-reset flop samples it on the same edge. It's a race, though harmless here.

**scoreboard-reference-model**
* Solution = scoreboard class only (`solution.sv:24-100`). Env wiring exists only as comments (L102-105), so there is no runnable reference.
* **LAB-S1: end-of-test accounting is incomplete.**
  * `check_phase` checks `processed_count == 0` and `accepted == processed` (L82-91), which is tautological because both increment in the same loop. It never checks *expected = 20*.
  * The test ends with a fixed `#100` drain (`testbench.sv:220`), not an objection held until the scoreboard is idle.
  * A monitor that drops transactions would still pass. Confidence High.
* Monitor (`testbench.sv:78-89`) samples raw signals at `@(posedge clk iff valid_out)`. It pairs *current* `op_a/op_b/opcode` with the *registered* `result`. This is correct only because the driver holds inputs for 2 cycles (`testbench.sv:112-118`). It does not teach input/output correlation across pipeline latency, and it breaks with back-to-back stimulus. Confidence High.

**ral-mirror-bug**
* The solution (`testbench_solution.sv`) is a complete explicit-predictor environment: `set_auto_predict(0)`, `predictor.map/adapter`, `monitor.ap → predictor.bus_in` (L219-226). Write/read/`mirror(UVM_CHECK)` checks are present (L244-252). It is a good reference.
* The monitor uses `default input #0` (L18-21), the same fragile pattern as LAB-C1. It happens to work for this single-register DUT, but it teaches a skew that is unsafe in general. Medium.
* The error text quoted in the README (`README.md:20`) is not UVM's actual mirror-check message wording. Low impact.
* See LAB-U5 for the non-runnable starter.

**callbacks-driver-behavior**
* **LAB-U3a: callback registered on a null handle.**
  * `uvm_callbacks#(packet_driver, packet_driver_cb)::add(env.drv, my_cb)` runs in `my_test::build_phase` (`solution.sv:151-156`). `env.drv` is created later, in `my_env::build_phase` (top-down build), so it is **null**.
  * With a null object, `add()` registers the callback **type-wide**, not per instance. The `delete(env.drv, my_cb)` in `final_phase` (L165-168) then targets an instance the callback was never added to.
  * The lab teaches the wrong phase for instance-specific callback registration (it belongs in `connect_phase` or `end_of_elaboration`). Confidence High (build order is certain; `add(null, …)` type-wide behavior is per IEEE 1800.2 `uvm_callbacks::add`, Medium-High).
* The solution changes the hook from the README's `task pre_drive` with `#10ns` to a `function` that sets `extra_delay_cycles = 2` (L45-46, L135-139). So it doesn't implement what steps 2-3 ask. High.
* Parity is corrupted but no monitor or checker observes it. The "error injection" is never shown to be detected. High.
* **LAB-U3b: the starter cannot compile.** `packet_driver_cb` references `packet_driver` before it is declared, with no `typedef class packet_driver;` (`testbench.sv:22-25` vs the solution's forward typedef at L38). CI never compiles starters. High.

**methodology-custom-phase**
* **LAB-U4: the phase is inserted into the wrong schedule.**
  * The solution inserts `load_fw_phase` with `uvm_domain::get_common_domain().add(load_fw, .after_phase(uvm_reset_phase::get()), .before_phase(uvm_configure_phase::get()))` (`solution.sv:86-90`).
  * The runtime phases (reset … shutdown) live in the `uvm` sub-schedule (`uvm_domain::get_uvm_schedule()`), not directly in the common domain. Looking up `reset` as a predecessor *within the common domain node* is expected to fail (`PH_BAD_ADD`) or mis-place the phase. The idiomatic call is `uvm_domain::get_uvm_schedule().add(...)` or a custom `uvm_domain`.
  * Confidence **Medium**: based on knowledge of the UVM `uvm_phase::add`/`find` implementation; I couldn't open the UVM source here. Must be verified by running it.
  * The schedule is also modified from inside `build_phase` while phasing is executing. That is risky; Low-Medium.
* The starter/steps never mention `exec_task` (`testbench.sv:8-23`). A learner who follows steps 1-3 and writes a `load_fw_phase` task in `soc_env` gets a task nobody calls. The solution relies on `exec_task` casting to `soc_env` (`solution.sv:21-25`). High.
* README "Expected Output" (`README.md:28-35`) doesn't match the solution's messages (`ORDER load_fw` etc.) or its timing. `configure` takes 10 ns, so `main_phase` starts at 80 ns, not 70 ns. High.

**config-debug**
* The solution is fine as a minimal UVM example.
* **LAB-U2: the success criterion is unobservable.** Step 3 and the README ask learners to look for `[DRV] Wiggling pins at time 10` (`lab.json` step 3; `README.md:15`). The driver prints `"Driving pins through the clocking block"` (`driver.sv:23`), and the solution prints nothing in the driver. High.
* Class-to-module hierarchical references (`testbench.vif`, `config_debug_solution_top.vif`, `testbench.clk`) are a portability concern, and they bypass the very `config_db` pattern being taught for clock waits. Low-Medium.

**soc-vip-reuse**
* The solution is coherent: a passive agent creates only the monitor, a firmware BFM drives the bus, the monitor observes, and an assertion flags dual-drive intent.
* The starter's "collision" is `if (spi_agt.is_active == UVM_ACTIVE) uvm_fatal(...)` (`testbench.sv:61-63`), a tautology, not an observed bus effect. The learner's one-line `config_db::set` "fixes" a check that reads the very flag being set. High.
* README describes an APB bus; the solution models SPI-like `cs_n/mosi`. Low.
* No timeout if no traffic arrives (`solution.sv:150`). Low.

**debug-waveform-trigger**
* **LAB-U6: teaches post-failure capture.** The subscriber calls `$dumpfile/$dumpvars` when `WATCHDOG_TIMEOUT` is published, which happens **5 ns before** `uvm_fatal` (`testbench.sv:45-48`; the README says "~1 ms"). That captures nothing about the cause. Real selective capture needs a pre-trigger window (re-run with `$dumpon` at T−Δ, or a ring buffer).
* `tb_top` has no signals, so the dump is empty.
* The "sporadic" failure is deterministic, and every run ends in `UVM_FATAL`. Confidence High.

**scoreboard-decoupling**
* **LAB-U1: starter already solved, and the premise is wrong.**
  * The editable starters already contain the answer: `env.sv:7,21,26-27` declares/creates `sb_fifo` and connects `analysis_export`/`get_export`; `scoreboard.sv:4,20-30` already uses `uvm_blocking_get_port` and a `run_phase` `get()` loop. There is nothing to do. High.
  * README premise (`README.md:5`), repeated in I-UVM-2B (`index.mdx:147-150`, "diagnose artificial monitor backpressure"): "Because `write()` is a blocking function call … the slow Scoreboard is blocking the Monitor". A `function void write()` cannot consume simulation time, so it cannot apply backpressure in simulated time. The real reasons for an analysis FIFO are a task context for time-consuming checks, decoupling, and buffering. **This is a core-semantics misconception.** High.
  * The "scoreboard" compares nothing. It only counts.

**axi-scoreboard-lab**
* **LAB-P1: the starter cannot compile.** `axi_scoreboard.sv:4-5` uses `uvm_analysis_imp_expected/_actual`, but the `` `uvm_analysis_imp_decl(_expected/_actual) `` macros exist only in `solution.sv:5-6`. None of the starter files or the (read-only) `testbench.sv` declares them. High.
* The solution's ID-queue matching is correct for the supported scope: per-ID FIFO, RLAST-vs-beat-count check, `check_phase` drain.
* Stimulus covers only single-beat reads, one per ID (`testbench.sv:72-98`). Same-ID ordering, multi-beat interleaving across IDs, and RLAST/beat-count errors are never exercised. The README's "without hiding beat-count, response-code, or RLAST failures" (lab step 3) has no negative test.
* Expected transactions are hand-written in the test (L72-76). There is no predictor or reference model.
* The test drives pins directly from `uvm_test`. There is no agent or slave model.
* The monitor flags legal `SLVERR/DECERR` responses as `uvm_error` (`solution.sv:108-109`), conflating protocol legality with expected behavior. Medium.

**ahb-checker-lab**
* **LAB-P3: the assertions can't catch either injected bug.**
  * Bug A, "slave samples HWDATA regardless of HREADY" (`testbench.sv:137-142`), is internal to the slave. None of the four pin-level properties can observe it. With this stimulus the final memory content is also the same, so it isn't observable at all.
  * Bug B, single-cycle ERROR, drives `HRESP=1` while `HREADY=1` (`testbench.sv:158-169`). `p_error_two_cycle` (`solution.sv:105-107`) only triggers on `HRESP && !HREADY`, so it never fires. A rule like "`$rose(HRESP)` ⇒ `!HREADY`" is missing.
  * README success criterion "≥2 assertions fire, identifying both bugs" (`README.md:60`) is unachievable. High.
* **LAB-P4: the stimulus is never pipelined, so the checks are mostly vacuous.**
  * The BFM always follows each NONSEQ with IDLE (`testbench.sv:213-243`). During wait states `HTRANS==IDLE`, so `p_addr_stable`/`p_ctrl_stable` (antecedent `HTRANS != IDLE`) are vacuous on all stimulus.
  * The monitor's core challenge, pairing an overlapped address phase with a previous data phase, is never exercised. High.
* **The "correct" slave asserts ERROR one cycle late.** Its ERROR FSM starts from the registered `active_reg` one edge *after* the data phase has already completed with HREADY=1/OKAY (`testbench.sv:172-197`). The two-cycle ERROR is given to an IDLE slot. The out-of-range write also aliases into `mem[0]` (L141-146 + L155). Medium-High.
* The BFM uses level-sensitive `wait(bus.HREADY)` on a signal updated in the NBA region, mixing pre- and post-edge sampling (`testbench.sv:214-226`). This is race-prone code in the reference TB of an advanced lab. Medium.
* The solution modules `ahb_monitor_solution`/`ahb_checker_solution` are never instantiated or bound (`solution.sv:16,73`; `testbench.sv:320-342` keeps the hookups commented out). Running the solution does not demonstrate the checker. High.
* README says "Wire the monitor into the environment's build_phase/connect_phase … analysis port" (`README.md:19-21`), but there is no UVM environment; the monitor is a module with `$display`. The HREADY ≤16 "protocol rule" in the README (`README.md:29`) is a recommendation, not a protocol requirement; lab.json step 2 correctly calls it a watchdog. Medium.

**axi-deadlock-hunt-lab**
* The solution checker is sound and honestly scoped: VALID/payload stability on 5 channels, BVALID only after AW + final W, service bounds gated as policy (`solution.sv:48-115`).
* Limitations:
  * BVALID tracking supports one outstanding write (single flags, L31-46).
  * No step asks the learner to **fix** the master and prove forward progress.
  * The real violation (WVALID waiting on AWREADY) is undetectable from pins, which the README acknowledges.
  * The BFM uses `wait(AWREADY===1); @(posedge)` handshake detection (`testbench.sv:145-147`). Medium.

**ahb-axi-bridge-debug**
* **LAB-P5: the bridge's W channel is broken, the checker misses it, and the pass message is meaningless.**
  * `WLAST <= (beat_index == current_burst_beats-1)` is computed from the pre-increment index, and the final-beat branch overrides it to 0 (`testbench.sv:310-333`). For any burst longer than one beat, **WLAST is never 1 on a handshake**. `WDATA` also lags by one beat (0,0,1,2,…).
  * Both the "buggy" and "fixed" bridges have this, because the fix only replaces the split helper. README acceptance #3, "WLAST fires at the correct beat" (`README.md:127`), is neither met nor checked. High (hand trace).
  * `LAB PASS` is `$display`ed on every `bridge_done`, regardless of assertion results (`solution.sv:131-137`). It also prints for scenarios 1-2 of the *buggy* run. The advertised success signature is meaningless. High.
  * Acceptance #5, backpressure via HREADYOUT/`req_ready`: `AWREADY`/`WREADY` are tied to 1 (`testbench.sv:50-51`), so no stall ever happens. Unverifiable. High.
* The 4KB math and `p_no_axi_4kb_cross`/`p_first_split_len` are correct for the scenarios. The "fixed" split helpers are free-standing `$unit` functions (`solution.sv:146-181`), not a fixed bridge.

**randomization-advanced-1**
* **LAB-S3: the "silent randomization failure" never happens.**
  * In `packet.sv`, `proto` is itself `rand` and unconstrained. The solver simply avoids `IPV6` (40 ∉ {16,32,64,128,256}) and picks IPV4 (32) or RAW. **`randomize()` always succeeds.** The real symptom is that IPV6 is never generated, a coverage hole, not a failure.
  * This contradicts the README ("packets that are entirely zero") and steps 1-2 ("Does it succeed?"). High.
* `packet_buggy.sv`/`packet_solution.sv` solve a *different* problem: a CRC constraint on a non-rand variable. The buggy file's claim "solvers often cannot process … reductions" is wrong: `crc == payload.sum() with (item ^ 0)` with `crc=0` is solvable (e.g., an all-zero payload). The "fix" changes the semantics from sum to XOR. High.
* `solve length before payload` (`packet_solution.sv:15-17`) names an unpacked array in solve-before; LRM requires integral rand variables (clause unverified). Medium.
* **LAB-S2 (packaging):** `packet.sv` and `packet_buggy.sv` both define `class packet`; `test.sv` and `packet_buggy.sv` both define `program test`. All three are editable starters compiled together by the runner, so duplicate definitions. High.

**coverage-advanced-1**
* **LAB-S4: the steps can't reach 100%.** `cross_max_op: cross cp_op, cp_a` crosses 7 ops with **both** `zero` and `max` bins (`alu_cov_mon.sv:14-26`). Step 3 only weights `8'hFF`. With `a==0` at ≈1/256, the `op × zero` cross bins mostly stay empty over 500 samples, so the score stays below 100 and `FAILURE: Coverage holes remain.`. Medium-High.
* No solution file.
* Covergroups are unsupported in Icarus, and version-dependent in Verilator (bookworm ships v5.006; not verified). The lab can't run on the platform runner.

**formal-harness**
* **LAB-S5: the narrative is wrong in two ways.**
  1. `a_never_consecutive_push` (push every other cycle) does **not** prevent filling: 4 pushes over 8 cycles reach `count==DEPTH`. At that cycle the registered `full` still reflects the previous count, so `prop_full_correct` fails **even with** the over-constraint. The assumption doesn't mask the bug.
  2. "Rapid pushes overflow past DEPTH" is impossible, because the RTL guards `count < DEPTH` (`testbench_buggy.sv:24`).
* The lesson about vacuity and over-constraint is valuable, but this harness demonstrates the opposite. High.
* `push/pop` are undriven `logic`. Whether they are treated as free inputs is tool-dependent (several open tools require `anyseq`). Medium.
* No formal engine is available to learners.

**ipc-deadlock**
* The deadlock is randomized: `$urandom_range(0,10) == 5` per iteration (`src/testbench.sv:25-33`), so P(no hang in 5 iterations) = (10/11)^5 ≈ 0.62. About 62% of runs "pass" without any fix. High.
* Step 3's "both threads complete all 5 iterations" contradicts a fix that keeps the early `return`. Medium.
* The Makefile uses `-ntb_opts uvm-1.2` for non-UVM code. Low.
* See LAB-S6: nothing is editable.

**power-aware-retention**
* No DUT, no UPF, no isolation cells, no X-propagation model, no assertion. The "bug" can't be observed in any log or waveform. Reordering three assignments completes the lab.
* The "bonus" SVA is the only meaningful check and is optional. High.

**pss-portable-intent**
* `input write_mem wr;` and `do write_mem as wr; do read_verify as rd with { rd.wr == wr; }` (`solution/mem_test.pss:37,61-64`) are not valid PSS as I understand PSS 2.x:
  * action inputs/outputs must be flow-object references (buffer/stream/state), not action types;
  * `as` is not PSS activity syntax (labeled traversal is `wr: do write_mem;`);
  * write→read data passing is done through a buffer object with inferencing.
* Confidence **Medium** (no PSS LRM consulted).
* Step 3 requires reading files that are hidden until lab completion (LAB-P6).

**basics-1**
* The solution refactor is clean (NBA drives inside an automatic task).
* The starter TB drives `enable = 1` with **blocking** assignments right after `@(posedge clk)` (`tb_counter_unrefactored.sv:35-37`). That races the DUT's `always_ff`, and the lab never points it out.
* There is no self-check and no expected counts.

### 2.3 Coming-soon labs (light review; defects worth fixing before enabling)

* `common/rtl/arbiter.sv:35`: `int priority = …` uses the reserved keyword `priority`, which is a compile error even in the unselected generate branch. The round-robin rotation casts the one-hot `last_gnt` to an index (logic error). High.
* `common/rtl/fifo.sv:16-25,34`: `mem[wr_ptr]` indexes `mem[DEPTH]` with the full `$clog2(DEPTH)+1`-bit pointer, so it goes out of range after DEPTH writes. `fifo/test_fifo.sv:53-57` checks `rd_data` one beat late. High.
* `simple_dut/solution/tb_and_gate.sv:40-49`: the checker runs only `always @(tb_y)`. Vectors (0,1) and (1,0) never change `y`, so they are never checked. **A stuck-at-0 DUT passes.** The README references a missing `work/and_gate.sv`, and its tasks use a non-existent `clk`. The manifest description says "basic UVM testbench". High.
* `constructs/lab1_race_condition`:
  * README and `testbench.sv:24-33` claim that TB `d <= 8'hA5` at `posedge` races the DUT. It doesn't: NBA drives are deterministic, and the DUT samples the old value. The printed "Mismatch" is pipeline latency, not a race.
  * Key Takeaway says drives occur in "Reactive/Observed"; clocking-block drives mature in Re-NBA.
  * This is a core-semantics misteaching for M1. High.
* `constructs/lab2_scheduler/testbench.sv:26`: `#15 // Align away from clock edge` lands exactly on a posedge (clk rises at 5, 15, …). Low.
* `assertions/solution_assertions.sv:23-38`:
  * `s_eventually (out_vld && out_rdy && out_data == local_data)` matches *any* later beat, not the corresponding one.
  * The action block references the local variable `p_data_integrity.local_data`, which is not legal (the file's own comment admits it).
  * The DUT also drops data on stalls beyond the "intended" bug.
  * Medium-High.
* `uvm_performance/README.md:15-27`: references files that don't exist, and repeats the "write() blocks the monitor" misconception (wall-clock CPU cost ≠ simulated-time blocking).

---

## 3. What the learner actually gets as feedback

| Channel | What happens | Evidence |
|---|---|---|
| Self-attested step (61/63 steps) | "Mark step complete & continue" button. Server checks only step order and version. No evidence, artifact, or log is stored beyond `{kind:"self_attested", recordedAt}`. | `LabClientPage.tsx:328-331`; `server/labs.ts:95-151`; `api/me/labs/[labId]/progress/route.ts:79+` |
| Graded step (basics-1 only) | `POST /api/labs/run` → `sv-basics-v1`: strips comments/strings, tokenizes, passes if the token sequence `int myVar ;` (step 1) or `myVar = 10 ;` (step 2) appears in **any** editable file. No compile. Unrelated to the README's refactoring task. The step's `starterCode` editor is never shown, because `selectedAssetPath` defaults to the first editable asset and there is no way to deselect it. | `lab-graders.ts:34-65`; `labs/run/route.ts:42-63`; `LabClientPage.tsx:48-66` |
| Solution reveal | Solution assets are hidden until the attempt is `COMPLETED` (`labAccessService.resolve`). Self-attesting every step reveals them, so the gate is cosmetic. **Contradiction (LAB-P6):** steps that require a solution file before completion are bridge step 3 ("calculation from `solution.sv`"), formal step 3 ("Open `testbench_solution.sv`") and pss step 3 ("Review `solution/generated_*`"). | `server/labs.ts:53-61`; `lab-assets.ts:28-30` |
| Simulation ("Run workspace") | Shown only if the lab has editable `.sv` assets. Sends **only editable files**. `/api/simulate` → 503 `SIMULATION_EXECUTION_NOT_CONFIGURED` unless `SIMULATION_QUEUE_URL` (external dispatcher, no consumer in repo besides `scripts/process-simulation-job.ts`) or `SIMULATION_LOCAL_DOCKER=true`. `.env.example:26` leaves the URL empty, so **unavailable in the default deployment**. | `index.ts:140-166`; `docs/simulation-worker.md:7-10` |
| Runner result | Two backends:<br>• Icarus: `iverilog -g2012 *.sv && vvp`<br>• Verilator: `verilator --binary --timing -Wno-fatal *.sv && run`<br>15 s per command, 20 s wall, 512 MB, 1 CPU. `passed = compile rc==0 && run rc==0`. **`coverage: 0` and `waveformKey: null` are hard-coded.** Output truncated to 1,800 chars. The UI always prints "Reported coverage: 0%" when a result returns. No lab-specific expectation (log signature, error count). `$error`/assertion failures generally don't change the process exit status (simulator-dependent; Medium), so failing TBs can show "passed". Results are **not connected to step completion**. | `run-simulator.py:39-63`; `worker.ts:83-98`; `CodeExecutionEnvironment.tsx:90-99,157` |
| UVM in runner | **No.** The Dockerfile installs `iverilog python3 verilator` from Debian bookworm (I believe Verilator 5.006 and Icarus 11 there; versions unverified) and copies no UVM source. No `+incdir`/`uvm_pkg.sv` is passed. Icarus can't compile UVM. Old Verilator 5.0x can't run UVM. Whether `g++/make` (needed by `verilator --binary`) are pulled in with `--no-install-recommends` is unverified, and a C++ build within 15 s on 1 CPU is doubtful. | `simulation-runner/Dockerfile:1-15` |
| Waveforms | None. Labs that say "check the waveform" (power-aware, ahb-checker `$dumpvars`, debug-waveform) have no viewer path. | `run-simulator.py:57` |

**Per-lab runnability in-app, assuming the runner is enabled:**
* UVM labs (10): not runnable.
* No editable SV (pss, soc-strategy, ipc-deadlock): no Run button.
* No top module or missing includes in the editable set: ahb-checker (editable files reference `ahb_if` from the read-only TB), axi-scoreboard, config-debug, scoreboard-decoupling.
* Duplicate definitions:
  * bridge: `testbench.sv` `` `include``s `bridge_split_checker.sv`, which is also compiled directly. Icarus rejects the duplicate module; Verilator reports MODDUP as a warning.
  * randomization: duplicate class/program.
* Unsupported features: coverage-advanced-1 (covergroups); SVA-heavy labs under Icarus.
* Runs but proves nothing: axi-deadlock and formal-harness compile to an input-only top that ends immediately, likely reporting "passed" (Medium).
* **Net: only `basics-1` and `power-aware-retention` would actually simulate, and neither self-checks.**

---

## 4. Prerequisite chain

```
basics-1 ──► common-1(cs) ──► fifo-1(cs)
simple-dut-1(cs) ──► arbiter-1(cs) ──► dma-1(cs)
simple-dut-1(cs) ──► config-debug ──► debug-waveform-trigger
simple-dut-1(cs) ──► scoreboard-decoupling ──► scoreboard-reference-model ──► uvm-mini-capstone ──► soc-strategy-capstone
                                   └──────────────────────────────────────────► uvm-mini-capstone
simple-dut-1(cs) ──► soc-vip-reuse ─────────────────────────────────────────────► soc-strategy-capstone
simple-dut-1(cs) ──► ral-mirror-bug
simple-dut-1(cs) ──► callbacks-driver-behavior
simple-dut-1(cs) ──► methodology-custom-phase
(no lab prereqs): ahb-checker-lab, axi-scoreboard-lab, axi-deadlock-hunt-lab, ahb-axi-bridge-debug,
                  coverage-advanced-1, randomization-advanced-1, formal-harness, ipc-deadlock,
                  power-aware-retention, pss-portable-intent, assertions-1(cs), constructs-1(cs), uvm-performance-1(cs)
module-prereqs that are actually labs: ahb-axi-bridge-debug → {ahb-checker-lab, axi-scoreboard-lab}; axi-deadlock-hunt-lab → {axi-scoreboard-lab}
```

* **Cycles:** none.
* **Dangling `labPrerequisites`:** none; `generate-lab-registry.mjs:100-104` validates them.
* **Dangling/misfiled `modulePrerequisites`** (never validated; the schema only requires `min(1)`):
  * `systemverilog-basics` (ipc-deadlock): not a curriculum slug.
  * `A-UVM-1` (pss): no such module.
  * `ahb-checker-lab`, `axi-scoreboard-lab`: lab IDs filed as modules.
* **Enforcement:** none. Neither field is read outside the schema and generator (grep over `src/`). `toLearnerLabDto` doesn't expose them, `labAccessService` doesn't check them, and `PracticeHub`/`LabLink` don't display them.
* **Prerequisites that don't teach what's needed:**
  * Six available UVM labs depend on `simple-dut-1`. It is *coming soon*, has no steps, and is a non-UVM AND-gate TB, so it teaches none of the UVM they assume. The dependency can never be satisfied.
  * `axi-scoreboard-lab` (UVM, analysis-imp macros, associative arrays of queues) has no UVM lab prerequisite.
  * `ahb-axi-bridge-debug` needs SVA but has no SVA lab before it (assertions-1 is coming soon).
  * `uvm-mini-capstone` is offered as the "Capstone Checkpoint" in **I-UVM-1B** (factory; before phasing I-UVM-1C and sequences I-UVM-3A), I-UVM-2A, I-UVM-2B and I-UVM-3A. Yet it lists two A-UVM-6 (Tier 3) labs as prerequisites. Learners are invited to the capstone 4-6 modules before its prerequisites exist.
* **Coming-soon labs referenced as available:**
  * `PracticeHub` links every coming-soon lab, and those links 404.
  * F4C `index.mdx:108` "Lab: The Race Condition Lab" refers to constructs-1 (coming soon).
  * F4B `index.mdx:149` "Lab: Refactor a legacy testbench to use interfaces": no such lab exists.
  * No `LabLink` points at a coming-soon lab (the QA test only checks that the ID exists, not its status: `labsPlatformAudit.spec.ts:54-79`, `validate-content-manifests.mjs:55-58`).

---

## 5. TB-mastery progression (M1–M8)

Each milestone is rated on five dimensions: instruction (module refs), starter material, meaningful automated checks, debugging practice, and an independent (unscaffolded) task. Ratings are P = Present, Pa = Partial, A = Absent.

| Milestone | Instruction | Starter | Automated checks | Debug practice | Independent task | Overall |
|---|---|---|---|---|---|---|
| **M1** race-aware interface TB with clocking blocks | **P**: F3B, F3C, F4B, F4C exist. Cross-ref: the F4C interview answer at index.mdx:117-128 says a CB drive from a module matures in NBA; per IEEE 1800-2009+ synchronous drives mature in Re-NBA (Medium; clause unverified; owned by the lesson audit). | **Pa**: constructs-1 (coming soon; flawed race narrative) and simple-dut-1 (coming soon; no clocking block). The only available SV TB (basics-1) is itself racy and silent about it. | **A** | **Pa**: constructs-1 lab1/lab2, coming soon and lab1 misattributes the race. | **A** | **Absent as a reachable lab** |
| **M2** reusable UVM agent (active/passive, config object) | **P**: I-UVM-2A, A-UVM-7. | **Pa**: capstone agent TODOs (`get_is_active`); soc-vip-reuse (one config_db line). No agent config object anywhere (vif + is_active + knobs in a `uvm_object`); `decoupling_lab_config` is a test knob, not an agent config. | **A** | **Pa**: config-debug (one typo), soc-vip-reuse (tautological collision). | **A** | **Partial (weak)** |
| **M3** reference-model scoreboard with end-of-test accounting | **P**: A-UVM-6. | **P**: scoreboard-reference-model (real work), capstone scoreboard TODO. | **A**: the reference solutions' own accounting is flawed (LAB-S1, LAB-C1/C2). | **Pa**: capstone `INJECT_FIFO_BUG` + `MISSED_BUG` (good design, but the solution's monitor defect undermines it); manual "corrupt the model". | **A** | **Partial** |
| **M4** coverage-driven environment with closure loop | **P**: I-SV-3A, I-SV-3B (closure-workflow). | **Pa**: coverage-advanced-1 (non-UVM, tiny, can't close per steps); capstone covergroup with 90% threshold. | **A**: runner coverage hard-coded 0; Icarus has no covergroups. | **A**: no hole-analysis-then-fix with measured before/after. | **A** | **Partial (weak)** |
| **M5** multi-agent env with virtual sequences | **P**: I-UVM-3B (virtual sequences/sequencer, layered, arbitration), A-UVM-8. "Lab: Coordinated Attack" (`coordinated-attack-lab.mdx`) is *read-the-solution*: "Examine the solution below". | **A** | **A** | **A** | **A** | **Absent** |
| **M6** out-of-order / ID-aware protocol verification | **P**: B-AXI-3, B-AXI-6, B-AXI-5. | **Pa**: axi-scoreboard-lab (starter doesn't compile; single-beat, one txn per ID; expectations hand-written). | **A** | **Pa**: axi-deadlock (analysis + checker, no fix); bridge (split bug, but bridge W channel broken and unchecked). | **A** | **Partial** |
| **M7** RAL-integrated environment with predictor | **P**: A-UVM-4A, A-UVM-4B. | **Pa**: ral-mirror-bug starter is a non-runnable fragment with a one-line fix. No lab builds a register model, uses built-in sequences (hw_reset, bit_bash), or covers W1C/RO/volatile fields or desired-vs-mirrored. | **A** | **Pa**: missing `bus_in` connect (conceptual; can't be reproduced). | **A** | **Partial (weak)** |
| **M8** subsystem/SoC capstone (reset, error injection, concurrency, closure) | **P**: E-SOC-1. | **Pa**: soc-strategy-capstone is a written strategy (good rubric); soc-vip-reuse is a toy. No code capstone with ≥2 agents, RAL, mid-traffic reset, error injection, concurrency, closure criteria. | **A**: rubric is self-scored. | **A** | **Pa**: the strategy doc is open-ended. No code. | **Absent (code) / Partial (planning)** |

Summary: instruction exists for every milestone, but the practice ladder stops at "fill a TODO in a provided file and click complete". **No milestone has (a) simulator-verified completion or (b) an unscaffolded build-from-spec task.** The only substantial build exercise (uvm-mini-capstone) is offered too early in the curriculum and its reference is likely wrong at runtime.

---

## 6. Where guided practice should give way to independent practice, and bounded proposals

### 6.1 Guided → independent transition points

| After … | Guided (exists or fix) | Independent (add) |
|---|---|---|
| F3C/F4C | Fixed constructs-1 race lab (clocking-block drive/sample) | Spec-only: "write an interface + CB + task-based self-checking TB for a 2-stage pipeline". Graded against hidden timing mutants. |
| I-UVM-2A/3A | Capstone agent TODOs (moved after I-UVM-3A) | Spec-only agent for a new valid/ready stream, with an agent config object; reused passive in a second env. |
| A-UVM-6 | scoreboard-reference-model (fixed accounting) | Build a scoreboard for a pipelined DUT with latency and drops. Must catch hidden mutants and have zero false fails. |
| I-SV-3B | coverage-advanced-1 (fixed closure) | Close a coverage plan on a new DUT within an N-test budget. Report bins hit; grader checks the coverage DB or text report. |
| I-UVM-3B/A-UVM-8 | New guided 2-agent virtual-sequence lab | Add a third agent and an ordering constraint without starter TODOs. |
| B-AXI-3/6 | Fixed axi-scoreboard-lab | Spec-only multi-beat, interleaved, same-ID-ordered read scoreboard. Mutants: reorder same ID, drop RLAST, extra beat. |
| A-UVM-4A/B | New guided RAL build lab | Spec-only register block (RO/RW/W1C/volatile) with explicit predictor and built-in reset sequence. Mutants: wrong reset value, W1C bug, stale predictor. |
| E-SOC-1 | soc-strategy-capstone (doc) | Code subsystem capstone (below). |

### 6.2 Platform proposals (bounded)

**PR-1 Runnable lab contract (manifest `run` block).** Add to `lab.json`:
* `run.files` (including read-only references), `run.top`, `run.defines[]`, `run.backend`;
* `expect.mustMatch[]`/`mustNotMatch[]` regexes (e.g. `^UVM_ERROR\s*:\s*0$`, `SCB_SUMMARY: matches=\d+ mismatches=0`);
* `mutants[]` (define or alternate-DUT file plus an expected-failure regex).

Acceptance:
* The `generate-lab-registry` check rejects available labs whose `run.files` don't exist or whose editable set + references contain duplicate top-level definitions.
* The runner compiles the *full* declared file set, not only editable files.

**PR-2 Execute references in CI, not just lint.** Extend `compile-sv-solutions.mjs` (or a new `run-lab-references.mjs`) to:
* build each available lab's *reference configuration* with Verilator `--binary` plus `uvm-core` 2020.3.1, which CI already downloads (`quality-gates.yml`);
* run it and assert the `expect` signatures;
* run each declared mutant and assert it **fails** with the expected signature;
* also compile each lab's *starter configuration* and require that it compiles (TODOs may leave behavior incomplete).

Acceptance: CI fails if any reference misses its signature, any mutant passes, or any starter fails to compile. This would have caught LAB-C1, LAB-P1, LAB-P3, LAB-P5, LAB-U3b and LAB-S2.

**PR-3 Simulator-graded steps (`sim-signature-v1` grader).** A new grader with `requiresSandbox: true`:
* takes the learner's editable files plus the lab's reference files;
* runs the clean configuration and the hidden mutants;
* passes a step only if the clean run matches `expect` **and** every mutant is flagged (e.g. `UVM_ERROR` count > 0 or a named assertion fires).

Store the log hash and seed as step evidence. Acceptance: `/api/labs/run` no longer returns `GRADING_QUEUE_UNAVAILABLE` for sandbox graders when a runner is configured, and step evidence includes `{graderId, mutantsCaught, seed, logDigest}`.

**PR-4 Runner image capable of UVM.** Pin a Verilator version proven in CI to compile and run `uvm-core` (CI already uses `verilator/verilator:v5.050` for lint). Bake a precompiled UVM. Raise the compile timeout to match measured CI times. Parse real coverage when the backend supports it; otherwise return `null`, not `0`. Acceptance: the capstone reference runs to `UVM_ERROR : 0` inside the runner within limits in CI.

**PR-5 Honest UI states.**
* Hide or disable coming-soon cards (no 404 links).
* Show prerequisites and an "unverified/self-attested" badge.
* Order the hub by tier.
* Don't print "Reported coverage: 0%" when the runner doesn't measure coverage.

Acceptance: Playwright checks that coming-soon cards are not anchors and that the hub order follows `owningModule` tier.

**PR-6 Prerequisite hygiene.**
* Validate `modulePrerequisites` against curriculum slugs.
* Forbid an available lab depending on a coming_soon lab.
* Fix the bridge/deadlock/pss/ipc entries.
* Move the capstone `LabLink`s to A-UVM-6 or later, or relabel them "preview".

Acceptance: the registry generator fails on violations; the capstone is linked only from modules at or after its prerequisites.

### 6.3 Lab fixes (bounded, with acceptance criteria)

| ID | Fix | Acceptance (meaningful validation) |
|---|---|---|
| LAB-C1/C2 | Capstone monitor: sample `push/pop/full/empty/level/din` with `#1step`. Take `dout` on the next clock (or keep a separate `#0` sample only for `dout`). Derive the scoreboard idle condition from monitor counts or an objection, not `CAPSTONE_READ_COUNT`. | Clean run: `SCB_SUMMARY matches=7 mismatches=0`, `UVM_ERROR : 0`, `COV_SUMMARY ≥ 90%`. `INJECT_FIFO_BUG`: ≥1 `SCB_MISMATCH` and no `MISSED_BUG`. Add 2 more hidden mutants (drop-on-full, off-by-one `level`) that must each produce ≥1 UVM_ERROR. |
| LAB-U1 | scoreboard-decoupling: restore a genuinely coupled starter (an `analysis_imp` scoreboard that must do time-consuming correlation). Rewrite the premise: functions can't block; the FIFO provides a task context and buffering. Add a solution file. | Starter fails to compile or meet the correlation spec. Reference passes with `processed=10` and a compare on every txn. Lesson text no longer claims `write()` blocks. |
| LAB-U2 | config-debug: align the expected log line with the driver's message. | `mustMatch: \[DRV\] .*` present in the fixed run; buggy run `mustMatch: NO_VIF`. |
| LAB-U3 | callbacks: add `typedef class packet_driver;` to the starter. Register the callback in `connect_phase` with a non-null `env.drv`. Implement the `pre_drive` the README specifies, or change the README. Add a monitor/checker that detects the parity error. | Starter compiles. Run log shows `CB` once per packet and a checker `PARITY_ERR` count equal to injected packets. Removing the callback gives 0 parity errors. |
| LAB-U4 | custom phase: use `uvm_domain::get_uvm_schedule().add(...)` (or a custom domain, which must be verified). Add the `exec_task` TODO to the starter. Fix the README log and times. | Log order `reset → load_fw → configure → main` with timestamps 0/50/70/80 ns. `check_phase` has no `ORDER` errors. |
| LAB-U5 | ral-mirror-bug: ship a runnable buggy environment (the solution minus the `bus_in` connect). Add a W1C or volatile field step. | Buggy run: `mirror(UVM_CHECK)` produces a `RegModel` error. Fixed run: `UVM_ERROR : 0`. Mutant "auto_predict(1)+predictor" is reported as double prediction by a learner-added check. |
| LAB-U6 | waveform trigger: teach a pre-trigger window (re-run with `+dump_start=<T-Δ>` derived from the published event time, or a ring buffer). Give `tb_top` real signals. | The second run's VCD starts ≥Δ before the fatal (grader parses the `$dumpvars` time from the log). |
| LAB-P1 | axi-scoreboard: put `uvm_analysis_imp_decl` in the starter. Add multi-beat, same-ID ordering and interleaving stimulus via a simple reordering slave model. | Clean: `MATCH` count = N, 0 errors. Mutants (same-ID swap, missing RLAST, extra beat, wrong RID) each produce ≥1 `MISMATCH/RLAST/UNEXPECTED`. |
| LAB-P3/P4 | AHB checker: make the TB editable or provide a hookup file. Add pipelined back-to-back and burst stimulus with waits. Make bug B a protocol-visible ERROR violation (first ERROR cycle with HREADY=1). Add `$rose(HRESP) |-> !HREADY`. Replace bug A with a pin-visible bug (e.g., address changes during a wait). Fix the slave's late ERROR. | Clean run: 0 assertion failures, and each of `a_addr_stable`/`a_ctrl_stable` has ≥1 non-vacuous attempt (cover). Broken run: ≥1 failure of each targeted assertion. Monitor log contains overlapped address/data transfers with correct pairing. |
| LAB-P5 | bridge: fix the WLAST/WDATA timing. Add WLAST-per-burst and W-count-per-AW checks. Print `LAB PASS` only when the error count is 0 at end. Add a stalled AWREADY/WREADY scenario. | Fixed: `LAB PASS` once, 0 SVA failures. Buggy split: `p_no_axi_4kb_cross` fails. Mutant "WLAST late": learner's WLAST check fires. |
| LAB-P6 | Don't reference hidden solution files in steps. Instead, gate reveal behind a *graded* final step or an explicit "reveal" action that marks the attempt as assisted. | No `instructions` string mentions a `role: solution` asset (lint in the registry generator). |
| LAB-S1 | scoreboard-reference-model: compare `processed == expected_count` (from config) and end on scoreboard-idle, not `#100`. Monitor captures inputs at `valid_in` and correlates with `valid_out` via a queue. Make stimulus back-to-back. | Clean: `20 PASS, 0 FAIL`. Hidden mutants (wrong SUB, dropped `valid_out`) each fail. |
| LAB-S2/S3 | randomization: remove the duplicate starters. Rebuild a genuinely unsolvable case (e.g., constrain `proto == IPV6` in the test). Teach both "failure" and "never-generated" outcomes, with coverage evidence for the latter. | Buggy: `$fatal` "Randomization failed" with the fixed test. After the model fix: IPV6 count > 0 in 100 packets. |
| LAB-S4 | coverage: rewrite steps to cover both the `zero` and `max` crosses (or drop `zero` from the cross). Add a solution. | Fixed run prints `Final ALU Coverage: 100.00%` within 500 samples, on a backend that supports covergroups. |
| LAB-S5 | formal-harness: change the masking assumption to one that genuinely prevents reaching `count==DEPTH` (e.g., `assume count < DEPTH-1 |-> !push`), or recast the lab as "vacuity". Remove the overflow claim. | With a formal tool (or SymbiYosys in CI, if adopted): buggy assumption proves the assertion; relaxed assumption gives a CEX; fixed RTL proves it and the cover is reachable. |
| LAB-S6 | ipc-deadlock: make `src/testbench.sv` editable. Use a deterministic trigger (fixed seed or forced value). Add a solution. | Buggy: `WATCHDOG` line at 500 ns on every seed. Fixed: `Test finished successfully!` on every seed. |
| LAB-G1 | basics-1: replace the `sv-basics-v1` steps with steps that match the README (task extraction). Grade by simulation plus a structural check (the task exists, is `automatic`, and is called 3×). Point out the starter's blocking-drive race. | Grader passes only when the log contains 3 `[Task]` lines with the expected counts (computable) **and** the source has a `task automatic`. Token match alone fails. |

### 6.4 New labs (fill the M1/M2/M5/M7/M8 gaps)

1. **M1: "Race-Free Pipeline TB"** (non-UVM; Verilator).
   * Starter: DUT + TB with blocking drives at the clock edge.
   * Task: introduce an interface, a clocking block (`#1step` in, output skew), modports, and driver/checker tasks.
   * Hidden mutants: the DUT samples on negedge; 1-cycle extra latency.
   * Acceptance: clean `PASS=N FAIL=0`; each mutant gives `FAIL>0`; lint rule that no TB-side signal is assigned outside the clocking block.
2. **M2: "Reusable Stream Agent"**.
   * Spec only.
   * Agent config object (vif, is_active, coverage_enable, max_idle). Active in a block env, passive in a second env that reuses it.
   * Acceptance: active run drives N items; passive run creates no driver/sequencer (checked via `uvm_top.print_topology` signature) and its monitor heartbeat count equals the externally driven N.
3. **M5: "Config-then-Data Virtual Sequence"**.
   * Two agents (register cfg + data stream) and a virtual sequencer.
   * The DUT drops data sent before config is complete.
   * Acceptance: scoreboard 0 mismatches; an ordering assertion holds; a hidden mutant vseq (fork without ordering) must fail the learner's checks.
4. **M7: "Build-a-RAL"**.
   * Spec for 4 registers (RW, RO, W1C, volatile counter).
   * Task: write the reg block, adapter, explicit predictor; run `uvm_reg_hw_reset_seq` and a custom W1C test.
   * Acceptance: clean `UVM_ERROR : 0`; mutants (wrong reset, W1C implemented as RW, predictor disconnected) each give ≥1 RAL error.
5. **M8: "Subsystem Capstone"** (unscaffolded).
   * DUT: a small DMA (cfg regs + AXI-lite-like mem port + interrupt).
   * Requirements: ≥2 agents + RAL + reference-model scoreboard + coverage plan; reset asserted mid-transfer; error-response injection; concurrent channels.
   * Closure criteria: zero mismatches over K seeds, coverage ≥ X% on a provided plan, every hidden mutant (5) detected, no false failure on 3 clean seeds.
   * Graded entirely by the runner. The soc-strategy doc becomes its planning step.

---

## 7. Findings register

| ID | Category | Evidence | Learner consequence | Sev | Conf | Recommended correction / acceptance |
|---|---|---|---|---|---|---|
| LAB-F1 | Interaction/design weakness | 61/63 available steps `self_attested` (`lab.json` files; `LabClientPage.tsx:328-331`) | "Completion" certifies nothing; learners can finish every lab without writing code | S1 | High | PR-1/PR-3; §6.3 acceptance |
| LAB-G1 | Confirmed defect | `basics-1` grader expects `int myVar;` (`lab-graders.ts:53`) vs README refactoring task; step editor hidden (`LabClientPage.tsx:48-66`) | The only graded lab grades an unrelated token; learners must paste a dummy declaration into the counter TB | S2 | High | §6.3 LAB-G1 |
| LAB-R1 | Prototype/gated | `/api/simulate` 503 unless env configured (`simulation/index.ts:146`; `.env.example:26`) | No simulation in the default deployment | S2 | High | PR-4; deployment doc + health check |
| LAB-R2 | Confirmed defect | Runner sends only editable files (`LabClientPage.tsx:69-72,337-343`); most labs' top TB is read-only `reference` | Even with the runner on, most labs have no top or have missing includes | S2 | High | PR-1 `run.files` |
| LAB-R3 | Confirmed defect | No UVM in runner (`Dockerfile:4`) | 10/21 available labs can't run | S2 | High | PR-4 |
| LAB-R4 | Confirmed defect | `coverage: 0`, `waveformKey: null` hard-coded (`run-simulator.py:56-57`); UI shows "Reported coverage: 0%" (`CodeExecutionEnvironment.tsx:157`) | Misleading coverage feedback; no waveforms for "check the waveform" labs | S3 | High | PR-4/PR-5 |
| LAB-R5 | Interaction/design weakness | `passed` = exit code only (`run-simulator.py:53`) | A TB that prints FAIL/`$error` can show "passed" | S2 | Medium | PR-3 signature grading |
| LAB-CI1 | Missing coverage (QA) | `compile-sv-solutions.mjs:51` is lint-only, per file, `-Wno-fatal`; starters and TBs never compiled; exits 0 locally without a compiler (L26-33) | Broken starters/references ship "green" | S2 | High | PR-2 |
| LAB-C1 | Confirmed defect (likely) | Capstone `monitor_cb default input #0` + "_before" fields (`uvm_capstone/.../solution.sv:98-101,276-290`) | The flagship reference likely fails its own fixed-DUT run; learners copying it learn a wrong sampling pattern | S1 | Med-High | §6.3 LAB-C1 |
| LAB-C2 | Interaction/design weakness | `CAPSTONE_READ_COUNT` in scoreboard (`solution.sv:14,371-388`) | Teaches test-coupled scoreboards | S3 | High | §6.3 |
| LAB-U1 | Confirmed defect + misconception | Starters already solved (`scoreboard_decoupling/src/dv/env.sv:7-27`, `scoreboard.sv:4-30`); "write() is blocking … blocking the Monitor" (`README.md:5`; I-UVM-2B `index.mdx:147-150`) | No practice; reinforces a false TLM timing model | S1 | High | §6.3 |
| LAB-U2 | Confirmed defect | Expected `[DRV] Wiggling pins` absent from code (`driver.sv:23`) | Learner can't confirm success | S3 | High | §6.3 |
| LAB-U3a | Confirmed defect | `add(env.drv, …)` in test `build_phase` before env build (`uvm_callbacks/.../solution.sv:151-156`) | Learns a wrong registration phase; type-wide registration mistaken for per-instance | S2 | High | §6.3 |
| LAB-U3b | Confirmed defect | Starter `packet_driver_cb` uses undeclared `packet_driver` (`testbench.sv:22-25`) | Starter doesn't compile | S2 | High | §6.3 |
| LAB-U4 | Unverified concern (strong) + defects | `get_common_domain().add(... reset ...)` (`methodology_customization/.../solution.sv:86-90`); `exec_task` absent from starter; README log mismatch | Learners copy a non-idiomatic, likely-failing phase insertion; the task never executes | S2 | Medium (insertion) / High (others) | §6.3 |
| LAB-U5 | Confirmed defect | `testbench_buggy.sv` has no test/driver/DUT/top (`ral_advanced/.../testbench_buggy.sv:1-154`) | Step 1 "Run the simulation" impossible; one-line fix | S2 | High | §6.3 |
| LAB-U6 | Interaction/design weakness | Dump starts 5 ns before fatal (`uvm_debug/.../testbench.sv:45-48`, `solution.sv:61-68`) | Teaches post-mortem capture that can't show the cause | S3 | High | §6.3 |
| LAB-P1 | Confirmed defect | `uvm_analysis_imp_expected/_actual` used without `_decl` in starter (`axi_scoreboard.sv:4-5`; decl only in `solution.sv:5-6`) | Starter can't compile | S2 | High | §6.3 |
| LAB-P2 | Missing coverage | Single-beat, one-per-ID stimulus; no negative tests (`axi_scoreboard/.../testbench.sv:72-98`) | ID-ordering, RLAST and beat-count logic never exercised | S2 | High | §6.3 LAB-P1 |
| LAB-P3 | Confirmed defect | `p_error_two_cycle` can't see a single-cycle ERROR with HREADY=1 (`ahb_checker/.../solution.sv:105-107` vs `testbench.sv:158-169`); bug A not pin-visible | Success criterion unachievable; learners think their checker is wrong | S2 | High | §6.3 |
| LAB-P4 | Missing coverage | BFM never pipelines (`testbench.sv:213-243`); stability assertions vacuous; slave ERROR one cycle late (L172-197) | Core AHB pipelining skill not practiced; wrong ERROR timing modeled as "correct" | S2 | High / Med-High | §6.3 |
| LAB-P5 | Confirmed defect | WLAST never asserted on multi-beat bursts (`ahb_axi_bridge/.../testbench.sv:310-333`); `LAB PASS` unconditional (`solution.sv:131-137`); READY tied high (`testbench.sv:50-51`) | Wrong "correct" bridge; meaningless pass signature; backpressure criterion untestable | S2 | High | §6.3 |
| LAB-P6 | Confirmed defect | Steps reference solution files hidden until completion (bridge step 3, formal step 3, pss step 3; `server/labs.ts:53-61`) | Learners blocked or nudged to self-attest just to unlock | S3 | High | §6.3 |
| LAB-S1 | Confirmed defect | `check_phase` accounting tautological; `#100` drain (`scoreboard/.../solution.sv:82-91`; `testbench.sv:220`) | End-of-test accounting not learned | S2 | High | §6.3 |
| LAB-S2 | Confirmed defect | Duplicate `class packet`/`program test` across editable starters | Workspace can't compile | S3 | High | §6.3 |
| LAB-S3 | Confirmed defect | Unconstrained `rand proto` makes the IPv6 conflict avoidable (`packet.sv:4-24`); solution solves a different problem | Lab premise false; misteaches solver behavior | S2 | High | §6.3 |
| LAB-S4 | Confirmed defect | Cross includes `zero` bins; steps weight only `FF` (`alu_cov_mon.sv:14-26`) | Following steps can't close coverage | S3 | Med-High | §6.3 |
| LAB-S5 | Confirmed defect | Over-constraint doesn't mask; "overflow" impossible (`testbench_buggy.sv:24,56-70`) | Misteaches assumption masking in an expert lab | S2 | High | §6.3 |
| LAB-S6 | Confirmed defect | ipc-deadlock has no editable asset; bug fires ~38% of runs (`src/testbench.sv:25-33`) | Can't do the fix in-app; non-reproducible bug | S3 | High | §6.3 |
| LAB-K1 | Confirmed defect | Prereqs never enforced/shown; 6 labs depend on coming-soon `simple-dut-1`; dangling `A-UVM-1`, `systemverilog-basics`; lab IDs in module field | No guided ordering; misleading metadata | S3 | High | PR-6 |
| LAB-K2 | Interaction/design weakness | Capstone `LabLink` in I-UVM-1B/2A/2B/3A (T2) although its prereqs are T3 labs | Learners attempt the capstone before phasing/sequences/scoreboards | S2 | High | PR-6 |
| LAB-H1 | Confirmed defect | PracticeHub links coming-soon labs, which 404 (`PracticeHub.tsx:165-183`; `[labId]/page.tsx:29`) | Broken links; no progression order | S3 | High | PR-5 |
| LAB-M1 | Missing coverage | No runnable M1 lab (constructs-1 coming soon and misattributes races: `constructs/lab1_race_condition/README.md:10-12`, `testbench.sv:30-33`) | No practice for the most fundamental TB skill | S1 | High | §6.4 #1; fix constructs-1 narrative |
| LAB-M5 | Missing coverage | No virtual-sequence/multi-agent lab; "Coordinated Attack" is read-only (`coordinated-attack-lab.mdx:28-31`) | Multi-agent coordination never practiced | S2 | High | §6.4 #3 |
| LAB-M8 | Missing coverage | No code-level subsystem capstone; strategy doc self-scored | No end-to-end independent TB build | S2 | High | §6.4 #5 |
| LAB-X1 | Confirmed defect (coming-soon content) | `arbiter.sv:35` uses keyword `priority`; `fifo.sv` pointer index out of range; `tb_and_gate` solution misses stuck-at-0 | Will ship broken when enabled | S3 | High | Fix before enabling; PR-2 includes coming-soon refs |
| LAB-X2 | Unverified concern | PSS `input write_mem wr;` / `do … as …` (`pss/.../mem_test.pss:37,61-64`) | May teach invalid PSS syntax | S3 | Medium | Verify against the PSS 2.x LRM; use buffer flow objects |
| LAB-X3 | Misconception (lesson cross-ref) | F4C interview answer: CB drive from module → NBA (`F4C_Clocking_Blocks/index.mdx:~122-126`) | Wrong region model for clocking-block drives | S3 | Medium (clause unverified) | Hand off to the lesson audit |

---

## 8. Validation notes

* **Static facts (High).** Every file:line reference above was read directly. Manifest counts and policies came from parsing all 29 `lab.json` files. MDX lab links came from `grep` over `content/curriculum/**/*.mdx`.
* **CI evidence.** GitHub Actions run `29693855900` (success): "Compiled 23 SystemVerilog reference files" with Verilator v5.050 lint-only. All 23 references *lint*. No evidence exists that any lab runs.
* **Not executed.** No simulator was available. The C1 capstone trace, the P5 bridge WLAST trace, the S5 formal reasoning, the S3 solver behavior and the S4 coverage estimate are hand analyses. Each should be confirmed by PR-2 (execute references plus mutants in CI) before or alongside fixes.
* **Unverified.** Debian bookworm package versions (Verilator ≈5.006, Icarus ≈11); whether g++/make are present in the runner image; Icarus handling of concurrent SVA; UVM `uvm_phase::add` lookup scope for LAB-U4; PSS syntax for LAB-X2.
