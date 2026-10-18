# G29-B-DBG accuracy review, round 2: `content/interview-questions/debug.json`

Reviewer: accuracy lens, round 2 (2026-10-18). Scope: all 19 questions as they stand after the author's "Fix round 1" (`git diff HEAD -- content/interview-questions/debug.json`). I re-read the whole bank, not only the edited lines.

Sources checked this round:
- IEEE 1800-2023 (`t1_lrm_clean.txt`).
- IEEE 1800.2-2020 (`uvm_lrm.txt`).
- Arm IHI0022E (`arm_axi.txt`).
- uvm-core 2020.3.1 source (`~/Downloads/1800.2-2020.3.1/src`). Files read: `uvm_sequencer.svh`, `uvm_sequencer_param_base.svh`, `uvm_sequencer_base.svh`, `uvm_sequence_base.svh`, `uvm_sequence_item.svh`, `uvm_driver.svh`, `uvm_sqr_connections.svh`, `uvm_tlm_imps.svh`, `uvm_tlm_defines.svh`, `uvm_port_base.svh`, `uvm_message_defines.svh`, `uvm_factory.svh`, `uvm_object.svh`, `uvm_component.svh`, `uvm_misc.svh`, `uvm_topdown_phase.svh`, `uvm_bottomup_phase.svh`, `uvm_task_phase.svh`, `uvm_phase_hopper.svh`, `uvm_phase.svh`, `uvm_domain.svh`, `uvm_config_db_implementation.svh`, `uvm_objection.svh`, `uvm_report_server.svh`, `uvm_root.svh`, `uvm_globals.svh` and `uvm_global_defines.svh`.

**Verdict: fail. There is 1 S2 finding**, plus 2 S3 and 3 S4, and no S1. All eleven round-1 findings (A1 to A11) are fixed, and the fixes are correct against the sources. The S2 is new: round 1 missed it. It is also an analysis item (G29-DBG-05, "an outstanding-transaction counter stuck") that was never applied to snapshot A.

## Findings

| # | Sev | Question | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| B1 | **S2** | debug-waveform-protocol-hang (snapshot A: model answer and rubric) | The model answer reads "every VALID is low: no master is trying to start a transfer, and **no slave has a response pending**", then concludes "the bus is idle, so look upstream". The rubric repeats this: "no master is trying to transfer, so the stall is upstream of the bus". The waveform does not support that conclusion. All VALIDs low means no transfer is *offered* in these cycles, not that nothing is *outstanding*. A slave or interconnect that accepted an AR or AW earlier and never returns R or B produces exactly this picture, as does a master whose AW was accepted but which never sends the W data. In both cases the master waits forever. A lost response is one of the commonest AXI hangs. The answer sends the learner upstream (reset, stimulus, objections) and away from it, and the key would mark down a candidate who checks outstanding transactions first. | Rewrite the first lines of snapshot A: "Every VALID is low, so no transfer is being offered. That does not mean nothing is outstanding. First count handshakes in the monitor or a protocol checker: AR against R with RLAST, and AW and W against B, per ID. If a read or write is still outstanding, the stall is downstream: the slave or interconnect lost or is withholding the response (a slave must not wait for RREADY or BREADY before asserting RVALID or BVALID, A3.3.1), or the master never sent the W data for an accepted AW. Only if nothing is outstanding, look upstream: reset and clock at the DUT, the stimulus, and the objection holder." Make the same change in the rubric, and add "assuming all-VALID-low means nothing is pending" to `common_mistakes`. | Arm IHI0022E A3.3.1, read and write transaction dependencies ("the slave must not wait for the master to assert RREADY before asserting RVALID"; the same rule for BREADY and BVALID); A3.2.1. G29.md DBG-05 lists "an outstanding-transaction counter stuck" as a first check. |
| B2 | S3 | debug-seed-reproduction (puzzle 2: model answer and rubric) | The fix for A3 gives these examples of an edit that moves stimulus: "a helper object or an extra component built in a constructor or `build_phase` ahead of the stimulus objects, or a new thread forked before the stimulus threads start". The rubric adds "(a constructor or `build_phase`, so creation order changes)". In a uvm-core bench, which is what the prompt describes ("a debug print to the scoreboard"), this mostly does not hold. Besides the reseeding the answer mentions (components in their constructor; sequences and items at `start`/`start_item`), uvm-core also reseeds the process for every component's phase, from the phase type and the component's full name. This covers function and task phases alike, and it does not depend on `use_uvm_seeding`. So an edit inside the scoreboard's `build_phase` or `run_phase`, including a forked thread, cannot change another component's random streams, and an extra component reseeds itself by name. Only an edit in the scoreboard's *constructor* can move anything else: it runs inside the parent's `build_phase` call, so it can shift the non-component objects created later in that call (for example a randomized config object) or `$urandom` draws made there. The parenthetical "That makes them less sensitive to creation order" understates the effect. The puzzle's main explanation therefore leans on a mechanism uvm-core largely removes. | Say that the creation-order mechanism is the IEEE 1800-2023 rule, and that it applies directly to plain SystemVerilog code and to objects UVM does not reseed. Then add: "In uvm-core, each component's phase process is reseeded from the phase and component names, components reseed in their constructor, and sequences and items reseed when started. An edit inside the scoreboard's `build_phase` or `run_phase` cannot move another component's stimulus. Only an edit in its constructor can shift objects or `$urandom` draws made later in the parent's `build_phase` (for example a randomized config object). So in a UVM bench, compare the stimulus logs first: usually the stimulus did not change, and the cause is the rebuild, a race or the edit's own behaviour." Drop "so creation order changes" from the rubric, or qualify it the same way. | uvm-core `src/base/uvm_topdown_phase.svh:125`, `uvm_bottomup_phase.svh:123`, `uvm_task_phase.svh:168` (`proc.srandom(uvm_create_random_seed(phase.get_type_name(), comp.get_full_name()))`, unconditional); `uvm_component.svh:1780`; `uvm_sequence_item.svh:143`; `uvm_object.svh:813-818`; `uvm_misc.svh:189-219`; IEEE 1800-2023 §18.14.1; IEEE 1800.2-2020 §5.3.3.3, F.4.1.4.20 (seeding mechanism "implementation specific") |
| B3 | S3 | debug-staff-regression-triage (model answer step 1, rubric) | Step 1 classifies "Infrastructure failures: no report summary (killed jobs, licence or disk problems). Rerun them; they are not design bugs". A missing UVM summary does not mean infrastructure. A SystemVerilog `$fatal` (for example from an assertion action block), a null-object access (the unconnected `seq_item_port` case in `debug-test-ends-at-time-zero`) or a crash in DPI code also ends the run with no summary. Under this rule those real failures are rerun and kept out of the bug count. The bank's own `debug-methodology-first-steps` says it correctly: "No summary at all means a crash, a `$fatal` or a killed job." | Write: "No report summary: read the log tail first. A simulator crash, a null-object error or a SystemVerilog `$fatal` is a real failure, so bucket it by that message. Only jobs killed by the grid, licence or disk problems are infrastructure: rerun them and count them separately." Make the same change to the rubric's "infrastructure failures (no summary)". | IEEE 1800-2023 §20.10 (`$fatal` terminates the simulation), §8.4 (null-handle access is illegal; implementations may issue an error); uvm-core `src/base/uvm_report_server.svh:978-1010` (the summary comes from `report_summarize`); the bank's own `debug-methodology-first-steps` |
| B4 | S4 | debug-test-ends-at-time-zero (model answer, "What happened") | "UVM ends a run-time phase when its objection count is zero, so `run_phase` ended at 0 ns" calls `run_phase` a run-time phase. In IEEE 1800.2, `run` is a common phase (9.8.1.5). The run-time phases are the twelve scheduled phases (9.8.2), and the bank itself uses the term that way elsewhere ("a run-time phase such as `main_phase`"). | Write: "UVM ends a task phase (`run_phase` or a run-time phase) when its objection count is zero, so `run_phase` ended at 0 ns." | IEEE 1800.2-2020 §9.8.1 (common phases; "uvm_run_phase (see 9.8.1.5)"), §9.8.2 (run-time phases) |
| B5 | S4 | debug-read-first-failure-log (`code`) | The illustrative fatal line reads "@ 1000000 ns: ... Explicit timeout of 1000000 hit". uvm-core formats both the `@` time and the timeout value with `%0t`, under the same `$timeformat`. If the `@` field shows "1000000 ns", the message also shows "1000000 ns". | Write "Explicit timeout of 1000000 ns hit", or drop " ns" from every `@` field. | uvm-core `src/base/uvm_report_server.svh:891` (`$swrite(time_str, "%0t", $realtime)`); `src/base/uvm_phase_hopper.svh:587-589` (`"%s timeout of %0t hit, ..."`) |
| B6 | S4 | debug-tb-race-clock-edge (model answer) | "§4.8 shows the same kind of race" is loose. The §4.8 example is a continuous assignment whose update interleaves with a `$display` in the same process. It is not two processes woken by the same clock edge. The race itself is correctly attributed to §4.7. | Write: "§4.8 gives a related example of an order-dependent race". | IEEE 1800-2023 §4.7, §4.8 (example `assign p = q; initial begin q = 1; #1 q = 0; $display(p); end`) |

## Round-1 findings: verification of the fixes

| R1 # | Question | Status | Evidence checked this round |
|---|---|---|---|
| A1 (S2) | debug-test-ends-at-time-zero | Fixed and correct. The answer gives the `DRVCONNECT` warning, then a null-object error at the first `get_next_item` (§8.4), and no `PH_TIMEOUT`. | `uvm_sqr_connections.svh:56-59` (`UVM_SEQ_ITEM_PULL_IMP(this.m_if, ...)`); `uvm_tlm_imps.svh:200-203` (`min_size=0`); `uvm_tlm_defines.svh:584-587`; `uvm_port_base.svh:455-461, 898-901` (`if (size()) set_if(0);`); `uvm_driver.svh:99-102`; IEEE 1800-2023 §8.4 ("Accessing non-static members ... or virtual methods ... via a null object handle is illegal ... implementations may issue an error") |
| A2 (S3) | debug-read-first-failure-log | Fixed. The answer says "one extra item in the actual stream at index 4", which matches act[i] = exp[i-1] in the log and the underflow explanation. | The item's own log |
| A3 (S3) | debug-seed-reproduction | Fixed as proposed. A further uvm-core refinement is B2 above. | §18.14.1 |
| A4 (S3) | debug-simulation-performance | Fixed. The `` `uvm_report_begin `` guard checks `get_report_verbosity_level` and `get_report_action` before the message is evaluated. | `uvm_message_defines.svh:130-158`; 1800.2 B.1.1.1 |
| A5 (S4) | debug-override-not-taking-effect | Fixed. `TYPDUP` is a warning, the call does not return, and a new `bus_driver`→`bus_driver` entry is recorded. | `uvm_factory.svh:1113-1185` |
| A6 (S4) | debug-x-propagation | Fixed. With 8'h5A and 8'hA5, `xx` is exact under Table 11-20. | §11.4.11, Table 11-20 |
| A7 (S4) | debug-methodology-first-steps, debug-read-first-failure-log | Fixed. I also confirmed the mechanism: the run phase's ALL DROPPED branch calls `wait_for_self_and_siblings_to_drop`. That waits until each sibling (including the uvm schedule's end node) is at least `EXECUTING`, so the `PH_TIMEOUT` watchdog stays armed while `main_phase` is open. | `uvm_phase_hopper.svh:503-591`; `uvm_phase.svh:2081-2126`; `uvm_domain.svh:149-150` |
| A8 (S4) | debug-test-ends-at-time-zero | Fixed. The `get_next_item` message ("Get_next_item called twice without item_done or get in between") is reported with the sequencer's full name as the ID, and the same item is handed back. | `uvm_sequencer.svh:224-231`; `uvm_sequencer_param_base.svh:508-547` (`m_safe_select_item` skips selection when `sequence_item_requested` is 1, then peeks) |
| A9 (S4) | debug-assertion-failure-triage | Fixed. Reset is now asserted (`rst_n` low) at edge 3. | §16.12 ("A disabled evaluation of a property does not result in success or failure") |
| A10 (S4) | debug-hang-time-not-advancing | Fixed. The iteration-limit tool note names no tool and no flag. | `uvm_globals.svh:506-523` (`nba <= next_nba; @(nba);`, or `#0` under `UVM_NO_WAIT_FOR_NBA`) |
| A11 (S4) | debug-coverage-hole-triage | Resolved. The bank has 0 occurrences of `exclude_bin`. The replacement wording ("the bin keywords are `bins`, `ignore_bins` and `illegal_bins`") matches Syntax 19-2. | IEEE 1800-2023 §19.5, Syntax 19-2 (`bins_keyword::= bins \| illegal_bins \| ignore_bins`) |

## Checked and correct this round (no change needed)

**Bank-wide.** The bank has 0 occurrences each of "secondary", `exclude_bin`, `-xprop`, "§4.6" and "IHI0022H". Every non-normative source is labelled "Tool note" or "Practice note (not normative)". No vendor flag is named. Every `modules` entry resolves to an MDX file.

**IEEE 1800.2-2020 clause headings.** I re-found each of these as a heading in `uvm_lrm.txt` and checked its content:
- Seeding: 5.3.3.1, 5.3.3.3.
- Reporting: 6.5.1.2.6, 6.5.1.2.14, 6.6, 6.6.5.
- Factory: 8.2.3.2.5 (in `uvm_component_registry`, 8.2.3), and 8.3.1.4.2, which includes "The original type shall be a super class of the override_type". Also 8.3.1.7.1 and 8.3.1.7.5.
- Phases and objections: 9.3.1.7.1, 9.3.1.7.2, 10.5.1.3.3, 10.5.1.5.1, 10.6.
- Components: 13.1.4.1.7, 13.1.7.13.
- Sequences and the sequencer interface: 14.2.3.1, 14.2.4.2, 14.2.4.4, 15.2.1.2.1, 15.2.1.2.2.
- Macros: B.1.1.1.
- Configuration: C.4.2.2.1 (full scope `{cntxt,".",inst_name}`), C.4.2.2.2, C.4.2.3.1 (`typedef uvm_config_db#(uvm_bitstream_t) uvm_config_int`).
- Root: F.7.3.3, F.7.4.2. The seeding default is 1 (F.4.1.4.25, F.4.1.4.26).
- Plusargs: G.2.2 to G.2.7. This covers the `time` form and `_ALL_` of G.2.3, and `<count>,<YES|NO>` for G.2.6.

`+UVM_TIMEOUT`, `+UVM_PHASE_TRACE`, `+UVM_OBJECTION_TRACE`, `+UVM_CONFIG_DB_TRACE` and `debug_create_by_type` have 0 hits in 1800.2. The bank labels each one as uvm-core.

**IEEE 1800-2023.** I re-found each of these as a heading and checked its content:
- Scheduling, types and objects: §4.7, §4.8; §6.3.1, §6.8 with Table 6-7; §8.4.
- Assignments, operators and statements: §10.4.2; §11.4.5; §11.4.11 with Table 11-20; §12.4; §12.5 (an exact 0/1/x/z match, and no statement runs when nothing matches and there is no default).
- Clocking: §14.13; §14.16 ("For zero skew clocking block outputs with no cycle delay, synchronous drives shall schedule new values in the Re-NBA region").
- Assertions: §16.5.1, §16.9.3; §16.12, where the disable condition uses current values ("i.e., not sampled"); §16.12.7, §16.14.8.
- Random stability: §18.14, §18.14.1 (thread and object seeding, and "new objects, threads, and random numbers can be created after existing objects"), §18.14.3.
- Coverage: §19.5 with Syntax 19-2, §19.5.5, §19.5.6, §19.6.2, §19.6.3, §19.11.
- System tasks: §20.9, §20.10, §20.11, §20.14.1; §21.6; §21.7.1.3.
- Timing and SDF: §31.3 (stability-window checks), §31.4, §31.6, Clause 32.

**Arm IHI0022E.**
- A3.1.2: during reset, a master drives ARVALID, AWVALID and WVALID LOW, and a slave drives RVALID and BVALID LOW.
- A3.2.1: VALID stays asserted until the handshake.
- A3.3.1: a receiver may wait for VALID before asserting READY, and the master "can wait for RVALID ... before it asserts RREADY". No READY timeout exists, so the "design rule" label in snapshot B stays correct.

**uvm-core behaviours re-read this round.**
- Config DB trace: `CFGDB/SET` and `CFGDB/GET` are issued with `` `uvm_info(id, msg, UVM_LOW) ``, and a failed lookup prints "null (failed lookup)" (`uvm_config_db_implementation.svh:215, 428, 470-487`). The lookup matches on type, through `uvm_resource#(T)::get_type()` (`:210`), so `int` against `bit [15:0]` misses. On failure `get` returns 0 before it assigns `value` (`:219-226`).
- Phase skip and timeout: "No objections raised, skipping phase" (`PH/TRC/SKIP`) is checked one NBA region after the phase starts (`uvm_phase_hopper.svh:487, 518`). The watchdog is `` `uvm_delay(top.phase_timeout) `` (`:561`). The outstanding-objection dump at the timeout is a `UVM_PH_TRACE`, so it appears only with `+UVM_PHASE_TRACE` (`:579`; `uvm_phase.svh:692-695`). Phase threads are killed in `cleanup_phase`.
- `try_next_item` performs `m_wait_for_sequences_count` (default 1) NBA waits and no time delay (`uvm_sequencer.svh:244-305`; `uvm_sequencer_base.svh:445`).
- Report summary: the "--- UVM Report Summary ---", "** Report counts by severity" and `"%s :%5d"` formats, and "Quit count reached!", match the log in `debug-read-first-failure-log` (`uvm_report_server.svh:983-996`).
- Report catchers run in the server before `UVM_COUNT` (`uvm_report_server.svh:649`). So the honest-verdict claim that `CAUGHT` drops a message before it is counted holds.
- `RNTST` "Running test ...", `INVTST` fatal, `SEQ` fatal, `OBJTN_TRC` and `UVM_DEFAULT_TIMEOUT 9200s` are as cited.

**Traced examples (by hand).** Every cycle table and answer key holds:
- Assertion window: fails at edge 5; `ack` is first seen as 1 at edge 6, 4 cycles after `$rose(req)`.
- Race table: A gives 03/07/09 and B gives 07/09/09.
- X-prop table: `a5`/`5a` for RTL, `xx`/`5a` for gates, and the `$isunknown` assertion fires at edges 1–4.
- Config DB: three bugs, and the order is not a bug.
- Override: two bugs, and the order is not a bug.
- Snapshot B: the circular wait is read correctly.

**Code legality (by inspection; nothing compiled).**
- The covergroup, including its cross `ignore_bins` with `binsof ... intersect ... && binsof(cp_kind.atomic)`.
- The clocking block and clocking drive.
- The reset-gated `$isunknown` property.
- The report catcher (`action_e catch()`, `uvm_report_cb::add(null, qc)`).
- The `check_phase` macros inside `if`: `` `uvm_error `` expands to `begin ... end`, per `uvm_message_defines.svh:130-145, 188-191`.
- The reworked `try_next_item` loop, and the `$test$plusargs` guard.
