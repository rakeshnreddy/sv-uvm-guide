# 6a extras: lab constructs-1 (author log)

Milestone M1 lab, "Race-Aware Interface Testbench with Clocking Blocks", rebuilt from scratch on the simple-dut-1 / basics-1 v2 pattern.

## Ownership

- `owningModule` moved from **F2B** to **F4C**. F2B (Dynamic Data Structures) teaches arrays and queues, not clocking blocks. The spine's F4C card says "Lab `constructs-1` ... should be re-owned here" and calls F4C the M1 gate; F3C's card says "LAB-M1 is owned by F4C"; Appendix B lists `constructs-1` -> F4C (LAB-M1). F4C's worked example is the M1 bench this lab mirrors (`pipe_if`, `cb`, `mon_cb`, `send`, `monitor`, `wait_cycles`).
- `modulePrerequisites`: `F3C`, `F4B` (the F4C card's prerequisites). `labPrerequisites`: `simple-dut-1` (M0; this bench keeps its conventions).
- `status`: `available`; `version`: `2`; `graderId`: `sv-clocking-v1` (new).

## What I built (content/curriculum/labs/constructs/)

- `work/rot_pipe.sv`: the DUT, a sibling of F4C's `pipe2`: three registers, result = input rotated left by one, async active-low reset. `BUG=1` shift instead of rotate; `BUG=2` one extra register (right values, one cycle late). No combinational path from inputs to the first register, so the testbench race shows cleanly.
- `work/pipe_if.sv` (starter, TODO step 2) and `solution/pipe_if.sv`: `default clocking cb` (`#1step`/`#0`, outputs `in_vld`, `in_data`, inputs `out_vld`, `out_data`, no `rst_n`), input-only `mon_cb` with `rst_n`, and `wait_cycles` using `repeat (n) ##1;`.
- `work/tb_top.sv` (starter, compiles, prints a vacuous `PASS=0 FAIL=0`) and `solution/tb_top.sv`: driver through `bus.cb` after `@(bus.cb)`, monitor on `@(bus.mon_cb)` reading only `mon_cb`, expectations carry a `due` time and the monitor checks arrival cycle as well as value (`!==`), F2E verdict (leftovers, vacuous run, watchdog with `join_any`, `disable fork`), reset released directly at 12 ns, drain with `bus.wait_cycles`.
- `work/tb_racy.sv` (reference, complete): the same items and checks with no interface or clocking block; blocking drives right after `@(posedge clk)`. `+DUT_FIRST` replays the other legal order with nonblocking writes (NBA region, after the flops read). This is the "prove the race" planted bug.
- `README.md`: spec R1-R4 and the timing rule (driven after edge k, seen by `mon_cb` at k+4), steps 1-7, captured expected logs, step 6 bug table (BUG=1, BUG=2, value-only check, learner's rotate-right bug), step 7 race proof with both logs, run commands, grading note, checklist.
- `lab.json`: 7 steps (1, 6, 7 self-attested; 2-5 graded structurally).
- Removed the old `lab1_race_condition/` and `lab2_scheduler/` folders (coming-soon assets superseded by this lab; lab2 was an RTL blocking-vs-nonblocking exercise, not M1).

## Grader

`sv-clocking-v1` in `src/lib/lab-graders.ts`, steps `clocking-blocks`, `driver`, `monitor`, `verdict`; registered in `scripts/generate-lab-registry.mjs` `knownGraders`. Structural only (comments ignored, no compile). It rejects among others: `cb` not default, wrong skews, `rst_n` in `cb`, `mon_cb` with outputs or missing `rst_n`, raw or blocking clockvar drives, `@(posedge clk)` in testbench code, `##` in `tb_top`, raw or `cb` reads in the monitor, no due-time check, `!=`, no empty-queue guard, reset through `cb`, no drain, `join`. I extracted F2E's watchdog check into a shared `checkWatchdog` helper (behaviour unchanged; its tests still pass). Tests: 9 new cases in `tests/lib/lab-graders.test.ts` (starter fails every step, solution passes every step, mutants fail with the expected codes).

## Sources verified (IEEE 1800-2023, t1_lrm_clean.txt)

- §14.3: illegal to write an input clockvar or read an output clockvar.
- §14.11 (`## ( expression )` is legal syntax; `##` needs a default clocking), §14.12 (default clocking scope).
- §14.13: non-`#0` input skew samples the Postponed value of the time step skew before the event; the block updates samples before triggering its event, so a process waiting on the block reads the new samples.
- §14.10: clocking block event triggered in the Observed region.
- §14.16: zero-skew drives scheduled in Re-NBA of the event's time step; a drive executed between events acts as if executed at the next event; Syntax 14-5 (`clockvar_expression <= [cycle_delay] expression` is the drive form).
- §14.16.2: last drive wins; procedural assignments to a signal of an output clockvar allowed; synchronous drive and procedural NBA in one time step take effect in arbitrary order.
- §4.4.2.1 (`#1step` = Preponed), §4.4.2.4 (NBA region), §4.7 (Active-region order not defined), §9.3.2, §9.6.3, §20.10, §3.14.2.3 (as cited in simple-dut-1).

No URLs, dates or external facts are cited. UVM/AMBA sources not needed.

## Verilator (5.052 2026-09-05)

Lint, `verilator --lint-only -Wall --timing -Wno-fatal --top-module <top> <files>`, run from the lab folder; all exit 0, warnings only:

| Unit | Warnings |
|---|---|
| `work/rot_pipe.sv solution/pipe_if.sv solution/tb_top.sv` | PROCASSINIT 1, SYNCASYNCNET 1, UNDRIVEN 3, UNUSEDSIGNAL 6 (interface signals reached only through clockvars) |
| `work/rot_pipe.sv work/pipe_if.sv work/tb_top.sv` (starter) | PROCASSINIT 1, UNDRIVEN 2, UNUSEDPARAM 2, UNUSEDSIGNAL 5 (empty TODO bodies) |
| `work/rot_pipe.sv work/tb_racy.sv` | BLKSEQ 4 (testbench `always`), PROCASSINIT 3, SYNCASYNCNET 1 |

Runs, `verilator --binary --timing -Wno-fatal --top-module <top> <files>` then `./obj_dir/V<top> +verilator+error+limit+100`:

| Run | Result |
|---|---|
| starter | `PASS=0 FAIL=0` at 0 s (vacuous, as the README says) |
| solution, BUG=0 | PASS lines at 55, 65, 75, 105, 115 ns; `PASS=5 FAIL=0`; `$finish` at 155 ns |
| solution, BUG=1 | errors at 65 (80: out=00), 75 (c3: 86), 115 (ff: fe); `PASS=2 FAIL=3` |
| solution, BUG=2 | five "result at t+10, expected at t" errors; `PASS=0 FAIL=5` |
| solution, BUG=2, time check replaced by `if (1'b0)` | `PASS=5 FAIL=0` (latency bug escapes a value-only check) |
| solution, rotate-right own bug | `PASS=1 FAIL=4` (only `FF` passes) |
| `tb_racy` (default order) | five "result at t-10" errors at 45, 55, 65, 95, 105 ns; `PASS=0 FAIL=5` (Verilator ran the driver first) |
| `tb_racy +DUT_FIRST` | `PASS=5 FAIL=0` |
| `tb_racy` with `--trace` builds | same two results |

`node scripts/compile-sv.mjs --only constructs`: 3 units compile (starter, solution, racy-reference).

Findings during validation, reflected in the README:

1. `##(n)` with a variable `n` gives a Verilator 5.052 internal error (`V3AssertPre.cpp: Non-constant cycle delay`). `repeat (n) ##1;` is used instead; the README says both are legal (§14.11).
2. A first design had a `+RACY` switch inside `tb_top` that wrote `in_vld` both through `cb` and with blocking/nonblocking assignments. Verilator warned `MULTIDRIVENPROC`, and the `+RACY +DUT_FIRST` result changed between a plain and a `--trace` build of the same source (and when an unrelated process was added). The racy bench was moved to its own file with one kind of writer per signal; its results are stable across builds.
3. Verilator's `$error` stops the run unless `+verilator+error+limit+N` is passed; the README's commands include it.

## Validation

- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/lib/lab-graders.test.ts tests/curriculum/compile-sv.test.ts tests/lib/lab-registry.test.ts tests/components/LabLink.test.tsx tests/lib/practice-links.test.ts tests/lib/learning-paths.test.ts tests/app/lab-page.test.tsx`: 277 passed, 1 failed. The failure is `compile-sv ... lists every lab that has SystemVerilog`: `common/lab1_packet_decoder has no compile units`, another item's new lab folder, not this lab.
- `npx tsc --noEmit -p .`: clean. `npx eslint src/lib/lab-graders.ts tests/lib/lab-graders.test.ts`: clean.
- No MDX touched, so `check-mdx` was not needed.

## Shared-file requests (for Integrate)

1. `content/curriculum/labs/compile-units.json`: I replaced the `constructs` entry (it pointed at the deleted `lab1_race_condition`/`lab2_scheduler` files) with `solution`, `starter` and `racy-reference` units. Only that key changed; please keep it when merging.
2. Regenerate `src/generated/*` (lab registry) so `constructs-1` shows as available, owned by F4C, with grader `sv-clocking-v1`.
3. `content/curriculum/T1_Foundational/F4C_Clocking_Blocks/index.mdx`, "Before the lab" (around line 1771): replace the "is planned ... Until it exists" text with `<LabLink labId="constructs-1" />`. The lab is task-based, not "simulator-graded with hidden mutants": its graded steps are structural and its mutants are the README's `BUG=1`, `BUG=2`, the value-only check and `tb_racy`.
4. `src/lib/practice-links.ts`: no override needed; `owningModule: "F4C"` resolves to `F4C_Clocking_Blocks/index`. Optionally also list it under F3C (`LAB_LESSON_OVERRIDES`) since F3C's RaceDebugChallenge is the pre-lab gate.
5. `src/lib/learning-paths.ts` MILESTONES already maps M1 to `constructs-1`; no change. No test pins `constructs-1` as `coming_soon`.
6. `docs/curriculum-quality/curriculum-spine.md`: Appendix B row for `constructs-1` (status available, owner F4C, contents now `rot_pipe` M1 bench); F4C card "Hands-on that should exist" (built); the "Milestone labs that do not exist yet" line (drop LAB-M1).
