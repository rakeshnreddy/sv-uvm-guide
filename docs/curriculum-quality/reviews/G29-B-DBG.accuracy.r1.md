# G29-B-DBG accuracy review, round 1: `content/interview-questions/debug.json`

Reviewer: accuracy lens, round 1. Scope: all 19 questions in the bank as of `git diff HEAD` (6 kept, 13 new), checked against IEEE 1800-2023 (`t1_lrm_clean.txt`), IEEE 1800.2-2020 (`uvm_lrm.txt`), Arm IHI0022E (`l40b/axi.txt`) and uvm-core 2020.3.1. The uvm-core files were read in `scratchpad/uvmcore`, and these were fetched from the `2020.3.1` tag into `scratchpad/g29dbg_acc`: `uvm_factory.svh`, `uvm_config_db_implementation.svh`, `uvm_sequencer.svh`, `uvm_sequence_base.svh`, `uvm_driver.svh`, `uvm_globals.svh`, `uvm_component.svh`, `uvm_report_server.svh` and `uvm_root.svh`.

**Verdict: pass.** I found no S1 or S2 issues. There are 3 S3 findings and 5 S4 findings. Every G29 analysis fix for this bank (DBG-01 to DBG-09) and the verify notes it applies (UVM-05/06, V02, the heartbeat follow-up and the AXI design-rule label) are in place and correct. No bare "(secondary)" source remains. `exclude_bin`, the §4.6 citation and `-xprop` now appear only where the bank says they are wrong or do not exist.

## Findings

| # | Sev | Question | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| A1 | S3 | debug-read-first-failure-log | The model answer says "One lost item at index 4 explains all three lines." In the log, each `act` is the previous `exp` (`act` 0x00, 0x3c, 0x91 against `exp` 0x3c, 0x91, 0x07). So the actual stream has one *extra* item (0x00), or the expected stream skipped one. "Lost" also contradicts the answer's own next paragraph, which explains `act=0x00` as an underflow pop, that is, an extra item. | Write: "One extra item in the actual stream at index 4 (or one item missing from the expected stream) explains all three lines." Keep "one-item slip" in the rubric. | The log in the item's own `code` |
| A2 | S3 | debug-seed-reproduction | Puzzle 2 says: "Every object created after that point in that thread gets a different seed, so the stimulus of every seed changes." The first half is right. The conclusion does not follow for an edit inside the scoreboard. Under thread and object stability, a clone or helper object created in the scoreboard's own `run_phase` thread changes only the RNG of that thread and its descendants. Stimulus threads, seeded earlier from their own parents, keep their streams. Stimulus moves only when the edit creates objects or threads, or draws random numbers, in a thread that later seeds the stimulus. Examples are a constructor or `build_phase` running in the phase process before the run-phase threads are forked, or a change to the order in which components are created. | Say when the edit moves stimulus: "...if the edit creates an object or thread, or draws a random number, in a thread that later seeds the stimulus (for example in the scoreboard's constructor or `build_phase`, which run in the phase process before the run-phase threads are forked), every object and thread created after it gets a different seed, so the stimulus changes. A clone inside the scoreboard's own `run_phase` loop only shifts that thread's stream." Optionally add that UVM's own seeding (`reseed`, §5.3.3.3) narrows this further. | IEEE 1800-2023 §18.14.1 (thread stability: "its RNG is seeded with the next random value from its parent thread"; object stability: "seeded with the next random value from the thread that creates the object") |
| A3 | S3 | debug-simulation-performance | The model answer says the `uvm_info` macro, "in uvm-core ... tests `uvm_report_enabled` first". It does not. In uvm-core 2020.3.1, `` `uvm_info `` expands to `` `uvm_report_begin ``, which calls `get_report_verbosity_level` and `get_report_action` directly. `uvm_report_enabled` checks only verbosity. The item's own `sources` line ("uvm_report_begin guard") is correct, so the answer and its source disagree. | Write: "in uvm-core the `` `uvm_report_begin `` guard checks the verbosity (and the action) before the message is evaluated". | uvm-core `src/macros/uvm_message_defines.svh:130-158`; `src/base/uvm_report_object.svh:147-155`; IEEE 1800.2-2020 B.1.1.1 |
| A4 | S4 | debug-override-not-taking-effect | The answer says "the factory warns `TYPDUP` ... and changes nothing". `set_type_override_by_type` does not return after the `TYPDUP` warning. It still pushes a `bus_driver`→`bus_driver` override entry, which is exactly what the answer's own Evidence bullet says `print()` shows. The effect is nil, but something is recorded. | Write: "...warns `TYPDUP` and records a `bus_driver`→`bus_driver` override, which has no effect". | uvm-core `src/base/uvm_factory.svh:1113-1185` (warning at 1123/1129, no return; new entry at 1176-1184) |
| A5 | S4 | debug-x-propagation | The cycle table shows `y (gates)` as `xx` for edges 0–4, with a = 8'h11 and b = 8'h22. Bits 7, 6, 3 and 2 are 0 in both inputs. An X-select mux with equal data bits gives 0 on those bits, so the result is 8'b00xx_00xx. The answer's own `?:` alternative does the same (bitwise combine, §11.4.11 with Table 11-20). By the Verilog hex display convention, a partly-X nibble prints as `X`, not `x`. | Pick inputs that differ in every bit (for example a = 8'h5A and b = 8'hA5), so that `xx` is exact. Or show `00xx_00xx` in binary. | IEEE 1800-2023 §11.4.11 ("combined bit by bit using Table 11-20") |
| A6 | S4 | debug-methodology-first-steps | "A `PH_TIMEOUT` fatal means something held `run_phase` open." The watchdog runs in the run-phase branch. Because the run-time phases run in parallel with `run_phase`, it also fires when an objection holds `main_phase` (or another run-time phase) open. | Write: "...something held `run_phase`, or a run-time phase such as `main_phase`, open". | uvm-core `src/base/uvm_phase_hopper.svh:547-590`; G29.verify "Notes for the implementation author" (objections and timeouts) |
| A7 | S4 | debug-hang-time-not-advancing | The answer presents the zero-delay loop as spinning forever with time frozen. That is the common case. Some simulators instead stop a run that never leaves one time step with an iteration or delta-limit error. That would be useful evidence for the "time stuck" family. | Optional: add "some simulators abort such a loop with an iteration-limit error (tool-dependent)" to the "Time stuck" bullet. | Tool note; uvm-core `src/base/uvm_globals.svh:506-523` (`uvm_wait_for_nba_region` loops through the NBA region without advancing time) |
| A8 | S4 | debug-coverage-hole-triage (lead request 5) | Lead request 5 asks to add `exclude_bin` to the citation lint's known-wrong phrases. The bank itself mentions `exclude_bin` three times, each time to say that it does not exist (in the rubric, the model answer and `common_mistakes`). A plain phrase match would flag those correct sentences. | When the lead adds the phrase, let it pass where it appears in a negation (for example "no `exclude_bin`" or "non-existent `exclude_bin`"), or allowlist this item. | `content/interview-questions/debug.json` lines 482, 483, 490 |

## Checked and correct (no change needed)

**IEEE 1800.2-2020 clause numbers.** Each one was found as a heading in `uvm_lrm.txt` with matching content:

- Factory: 8.2.3.2.5 `set_type_override`; 8.3.1.4.2 (where "The original type shall be a super class of the override_type" is in the text); 8.3.1.7.1 `find_override_by_type`; 8.3.1.7.5 `print`.
- Phases and objections: 9.3.1.7.1 `get_objection`; 9.3.1.7.2 `raise_objection`; 10.5.1.3.3; 10.5.1.5.1 `get_objectors`; 10.6 `uvm_heartbeat`.
- Components: 13.1.4.1.7 `check_phase`; 13.1.7.13 `set_recording_enabled`. 13.1.7.13 matches the standard text. The uvm-core annotation `13.1.6.13` is the one that is off.
- Sequences: 14.2.3.1 `start`; 14.2.4.2 `set_starting_phase`; 14.2.4.4 `set_automatic_phase_objection`; 15.2.1.2.1 and 15.2.1.2.2.
- Reporting: 6.6, 6.6.5 (`action_e {UNKNOWN_ACTION, THROW, CAUGHT}`, `catch`); 6.5.1.2.6; 6.5.1.2.14; B.1.1.1.
- Configuration: C.4.2.2.1 and C.4.2.2.2 (`get` returns `bit`); C.4.2.3.1 (`uvm_config_int` is `uvm_config_db#(uvm_bitstream_t)`).
- Root and seeding: F.7.3.3 `set_timeout`; F.7.4.2 `print_topology`; 5.3.3.1; 5.3.3.3.
- Command-line plusargs: G.2.2 to G.2.7. The `time` form of `+uvm_set_verbosity` and `_ALL_` match G.2.3. `+UVM_MAX_QUIT_COUNT=<count>,<YES|NO>` matches G.2.6. `+uvm_set_action=...,UVM_ERROR,UVM_NO_ACTION` is the G.2.4 example.

**Labelled uvm-core-only, and correct.** These have 0 occurrences in 1800.2: `+UVM_CONFIG_DB_TRACE`, `+UVM_OBJECTION_TRACE`, `+UVM_PHASE_TRACE`, `+UVM_TIMEOUT` and `debug_create_by_type`. Each exists in uvm-core 2020.3.1.

**IEEE 1800-2023 clause numbers.** Each was found as a heading with matching content:

- §4.7 ("active events can be taken off ... in any order") and §4.8.
- §6.3.1; §6.8 with Table 6-7 (4-state integral default `'x`).
- §10.4.2.
- §11.4.5; §11.4.11 (an ambiguous condition combines both operands bit by bit).
- §12.4 ("zero value or the value is x or z" means the first statement does not execute); §12.5.
- §14.13 (1step input sampling); §14.16 (a zero-skew synchronous drive is scheduled "in the Re-NBA region").
- §16.5.1; §16.9.3; §16.12 (disable condition: "current simulation cycle, i.e., not sampled"); §16.12.7; §16.14.8.
- §18.14, §18.14.1 and §18.14.3. The "add new threads/objects after existing ones" advice is in §18.14.1. `$random` is not in the §18.14 list.
- §19.5.5, §19.5.6, §19.6.2, §19.6.3 and §19.11.
- §20.9, §20.10, §20.11 and §20.14.1.
- §21.6; §21.7.1.3 (`$dumpoff`/`$dumpon`).
- §31.3, §31.4 and §31.6 (notifiers). Clause 32 is SDF back-annotation.

**Arm IHI0022E.**

- A3.1.2: during reset, the master drives ARVALID, AWVALID and WVALID low, and the slave drives RVALID and BVALID low.
- A3.2.1: the handshake process.
- A3.3.1: the receiver "can wait until it detects a VALID signal before it asserts its corresponding READY signal". There is no READY timeout and no rule that forces a master to accept responses, so the design-rule label is correct.

**uvm-core behaviours.**

- Phase skip and timeout (`uvm_phase_hopper.svh`):
  - `PH/TRC/SKIP` "No objections raised, skipping phase" is at line 518, at `UVM_LOW`.
  - The watchdog is `` `uvm_delay(top.phase_timeout) `` (line 561), followed by "Explicit/Default timeout of %0t hit, indicating a probable testbench issue".
  - With phase trace on, `PH/TRC/TIMEOUT/OBJCTN` prints the outstanding objections.
  - Phase threads are killed when the phase ends (around line 690).
  - `UVM_DEFAULT_TIMEOUT` is 9200s.
- Config DB (`uvm_config_db_implementation.svh`):
  - The `get` lookup is filtered by `uvm_resource#(T)::get_type()`, so `int` and `bit [15:0]` do not match.
  - The value is left unchanged when the lookup fails.
  - `CFGDB/GET` and `CFGDB/SET` are reported through `` `uvm_info(..., UVM_LOW) ``, and a failed lookup prints `null (failed lookup)`.
- Sequences and driver:
  - `try_next_item` calls `wait_for_sequences()`, which calls `uvm_wait_for_nba_region()` (`@(nba)` on an NBA write), so no simulation time passes.
  - Without a sequencer, `start_item` raises `SEQ` fatal "neither the item's sequencer nor dedicated sequencer has been supplied".
  - An unconnected driver raises the `DRVCONNECT` warning in `end_of_elaboration_phase`.
- Reporting:
  - Report catchers run before `UVM_NO_ACTION` filtering and before `incr_severity_count` (`uvm_report_server.svh` `process_report_message`).
  - `` `uvm_error `` is guarded by the action check in `` `uvm_report_begin ``.
- Message text and IDs: `RNTST` "Running test ..." and `INVTST` (`uvm_root.svh`); `OBJTN_TRC` (`uvm_objection.svh`); the report summary layout and "Quit count reached!" (`uvm_report_server.svh:983-994`).

**Answer keys and traced examples.** Each was traced by hand:

- **Assertion window (debug-assertion-failure-triage).** `$rose(req)` is true at edge 2. The window covers edges 3–5, where the sampled `ack` is 0, so the attempt fails at edge 5. The answer key is correct.
- **Race table (debug-tb-race-clock-edge).** Simulator A gives 03/07/09 and simulator B gives 07/09/09. Both orders are legal under §4.7.
- **Config DB (debug-config-db-get-failure).** The three bugs are the scope, the type and `void'`. The `set` after `create` is correctly declared not a bug.
- **Override (debug-override-not-taking-effect).** The two bugs are `new()` and the missing macro. The order of the override is correctly declared not a bug.
- **Zero-time test (debug-test-ends-at-time-zero).** The diagnosis (no objection raised) and both fixes are correct.
- **Snapshot B (debug-waveform-protocol-hang).** The circular wait is correctly read.

**Code legality, by inspection; nothing was compiled.**

- The covergroup and its cross `ignore_bins` with `binsof(...) intersect ... && binsof(cp_kind.atomic)`.
- The clocking block (`default input #1step output #0`).
- The `$isunknown` property with `disable iff`.
- The report catcher (`action_e catch()`, `uvm_report_cb::add(null, qc)`).
- The `check_phase` macros inside `if`.
- The reworked `try_next_item` loop.
