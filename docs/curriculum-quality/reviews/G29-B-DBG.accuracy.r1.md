# G29-B-DBG accuracy review, round 1: `content/interview-questions/debug.json`

Reviewer: accuracy lens, round 1 (review-only pass, 2026-10-18). Scope: all 19 questions in the bank as of `git diff HEAD` (6 kept, 13 new). The bank file is unchanged since the author run (mtime 2026-10-11 18:26), so this review matches the current text. An earlier accuracy r1 file for this bank (2026-10-11) is replaced by this one. Its findings were re-checked and are kept below, and one S2 it missed is added (A1).

Sources checked:
- IEEE 1800-2023 (`t1_lrm_clean.txt`).
- IEEE 1800.2-2020 (`uvm_lrm.txt`).
- Arm IHI0022E (`arm_axi.txt`).
- uvm-core 2020.3.1 source (`~/Downloads/1800.2-2020.3.1/src`). Files read: `uvm_message_defines.svh`, `uvm_factory.svh`, `uvm_port_base.svh`, `uvm_sqr_connections.svh`, `uvm_tlm_defines.svh`, `uvm_driver.svh`, `uvm_sequencer.svh`, `uvm_sequencer_base.svh`, `uvm_sequence_base.svh`, `uvm_globals.svh`, `uvm_global_defines.svh`, `uvm_phase_hopper.svh`, `uvm_root.svh`, `uvm_objection.svh` and `uvm_report_server.svh`.

**Verdict: fail. There is 1 S2 finding.** There are also 3 S3 and 7 S4 findings, and no S1. The G29 analysis fixes for this bank (DBG-01 to DBG-09) and the verify notes it applies (UVM-05/06, V02, the heartbeat follow-up and the AXI design-rule label) are in place and correct. No bare "(secondary)" source remains. `exclude_bin`, the §4.6 citation and `-xprop` appear only where the bank says they are wrong or do not exist. Every `modules` entry resolves to a lesson file.

## Findings

| # | Sev | Question | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| A1 | **S2** | debug-test-ends-at-time-zero (model answer, "Other ways a sequence never runs", bullet 2) | The answer says that when the driver's `seq_item_port` is not connected, "the sequence then blocks in `start_item`/`finish_item` until `PH_TIMEOUT`". That is the wrong symptom. In uvm-core, `uvm_seq_item_pull_port::get_next_item` is `this.m_if.get_next_item(t)`. `m_if` is set only when the port has at least one connection: `resolve_bindings` calls `set_if(0)` only `if (size())`. The port's `min_size` is 0, so no connection error is raised either. The driver's first `get_next_item` (or `try_next_item`) call therefore goes through a null handle. That access is illegal, and simulators normally stop the run with a null-object error in the driver's `run_phase`, long before any `PH_TIMEOUT`. A learner told to expect a timeout misreads the real log. | Write: "The driver's `seq_item_port` is not connected: uvm-core warns `DRVCONNECT` at end of elaboration. The driver's first `get_next_item` then calls through a null interface handle, which is illegal (IEEE 1800-2023 §8.4). The simulator normally stops with a null-object access error in the driver (tool-dependent message), while the sequence waits in `start_item` for a grant that never comes. The `DRVCONNECT` warning just before the crash is the lead." Add §8.4 and `src/tlm1/uvm_sqr_connections.svh` / `src/base/uvm_port_base.svh` to `sources`. | uvm-core `src/tlm1/uvm_sqr_connections.svh:56-59` (`UVM_SEQ_ITEM_PULL_IMP(this.m_if, ...)`); `src/macros/uvm_tlm_defines.svh:587-588`; `src/tlm1/uvm_tlm_imps.svh:200-203` (`min_size=0`); `src/base/uvm_port_base.svh:455-461, 898-901` (`if (size()) set_if(0);`); `src/comps/uvm_driver.svh:99-102` (DRVCONNECT); IEEE 1800-2023 §8.4 ("Accessing ... virtual methods ... via a null object handle is illegal ... implementations may issue an error") |
| A2 | S3 | debug-read-first-failure-log | The model answer says "One lost item at index 4 explains all three lines." In the log, each `act` is the previous `exp`: `act` 0x00, 0x3c, 0x91 against `exp` 0x3c, 0x91, 0x07. So the actual stream has one *extra* item (0x00), or the expected stream skipped one. The answer's own next paragraph explains `act=0x00` as an underflow pop, which is also an extra item. | Write: "One extra item in the actual stream at index 4 (or one item missing from the expected stream) explains all three lines." Keep "one-item slip" in the rubric. | The log in the item's own `code` |
| A3 | S3 | debug-seed-reproduction | Puzzle 2 says: "Every object created after that point in that thread gets a different seed, so the stimulus of every seed changes." The first half is right. The conclusion does not follow for an edit inside the scoreboard's `run_phase`. Under thread and object stability, a clone or helper object created in the scoreboard's own run-phase thread changes only the RNG of that thread and of the threads and objects it creates. Stimulus threads, seeded earlier from their own parents, keep their streams. Stimulus moves only when the edit creates objects or threads, or draws random numbers, in a thread that later seeds the stimulus. Examples are the scoreboard's constructor or `build_phase`, which run before the run-phase threads are forked, or a change to the order in which components are created. | Write: "...if the edit creates an object or thread, or draws a random number, in a thread that later seeds the stimulus (for example in the scoreboard's constructor or `build_phase`, before the run-phase threads are forked), everything created after it gets a different seed, so the stimulus changes. A clone inside the scoreboard's own `run_phase` loop shifts only that thread's stream." Optionally add that UVM seeding (`reseed`, 1800.2 §5.3.3.3) narrows this further. | IEEE 1800-2023 §18.14.1 (thread stability: "its RNG is seeded with the next random value from its parent thread". Object stability: "seeded with the next random value from the thread that creates the object") |
| A4 | S3 | debug-simulation-performance | The model answer says the `uvm_info` macro "in uvm-core ... tests `uvm_report_enabled` first". It does not. In uvm-core 2020.3.1, `` `uvm_info `` expands to `` `uvm_report_begin ``. That macro calls `get_report_verbosity_level(SEVERITY, ID) >= VERBOSITY` and `get_report_action(SEVERITY, ID) != UVM_NO_ACTION` directly. The item's own `sources` line ("uvm_report_begin guard") is correct, so the answer disagrees with its own source. | Write: "in uvm-core the `` `uvm_report_begin `` guard checks the verbosity (and the action) before the message expression is evaluated". | uvm-core `src/macros/uvm_message_defines.svh:130-158`; IEEE 1800.2-2020 B.1.1.1 |
| A5 | S4 | debug-override-not-taking-effect | The answer says the factory "warns `TYPDUP` ... and changes nothing". `set_type_override_by_type` does not return after the `TYPDUP` warning. It still records a `bus_driver`→`bus_driver` override entry, which is what the answer's own Evidence bullet says `print()` shows. The entry has no effect: `m_find_override_by_type` does not recurse when the override type equals the requested type, so there is no `OVRDLOOP`. | Write: "...warns `TYPDUP` and records a `bus_driver`→`bus_driver` override, which has no effect". | uvm-core `src/base/uvm_factory.svh:1113-1185` (warning at 1123/1129, no return; new entry at 1176-1185); `:1785-1880` |
| A6 | S4 | debug-x-propagation | The cycle table shows `y (gates)` as `xx` for edges 0–4, with a = 8'h11 and b = 8'h22. Bits 7, 6, 3 and 2 are 0 in both inputs. The answer itself says a mux cell outputs X for "an X select and different data inputs", so the bits where the inputs agree give 0, and the result is 8'b00xx_00xx. The answer's `?:` alternative behaves the same way (§11.4.11, Table 11-20). | Pick inputs that differ in every bit (for example a = 8'h5A and b = 8'hA5), so that `xx` is exact. Or show `00xx_00xx` in binary. | IEEE 1800-2023 §11.4.11 ("combined bit by bit using Table 11-20") |
| A7 | S4 | debug-methodology-first-steps | "A `PH_TIMEOUT` fatal means something held `run_phase` open." The watchdog runs in the run-phase branch. Because the run-time phases run in parallel with `run_phase`, it also fires when an objection holds `main_phase` (or another run-time phase) open. | Write: "...something held `run_phase`, or a run-time phase such as `main_phase`, open". | uvm-core `src/base/uvm_phase_hopper.svh:547-590`; G29.verify "Notes for the implementation author" (objections and timeouts) |
| A8 | S4 | debug-test-ends-at-time-zero (bullet 3) | "The driver never calls `item_done()`: the sequence blocks in `finish_item`...". This is right for a driver that blocks after its first item. A typical `forever` driver loop that omits `item_done` instead calls `get_next_item` again. uvm-core then reports an error, "get_next_item/try_next_item called twice without item_done or get in between", and returns. That error is the evidence a learner will actually see. | Add: "If the driver loops back to `get_next_item` without `item_done`, uvm-core reports 'get_next_item/try_next_item called twice without item_done or get in between'." | uvm-core `src/seq/uvm_sequencer.svh:244-247` |
| A9 | S4 | debug-assertion-failure-triage (follow-up 2) | "Reset is deasserted at edge 3 in another run, during an attempt." `rst_n` is already deasserted (1) throughout the shown run. The scenario the model answer covers ("a reset in the middle of an attempt disables it") needs reset *asserted* (`rst_n` low) at edge 3. As written, the question is ambiguous. | Write: "Reset is asserted (`rst_n` low) at edge 3 in another run, during the attempt from edge 2. Does the attempt fail, pass or neither?" | IEEE 1800-2023 §16.12 (disable condition uses current values; a disabled attempt neither passes nor fails) |
| A10 | S4 | debug-hang-time-not-advancing | The answer presents the zero-delay loop as spinning forever with time frozen. That is the common case. Some simulators instead stop a run that never leaves one time step with an iteration or delta-limit error, which would be useful evidence for the "time stuck" family. | Optional: add "some simulators abort such a loop with an iteration-limit error (tool-dependent)" to the "Time stuck" bullet. | Tool note; uvm-core `src/base/uvm_globals.svh:506-523` (`nba <= next_nba; @(nba);` does not advance time); `src/seq/uvm_sequencer.svh:251-262`, `uvm_sequencer_base.svh:1380-1382` |
| A11 | S4 | debug-coverage-hole-triage (lead request 5) | Lead request 5 asks to add `exclude_bin` to the citation lint's known-wrong phrases. The bank mentions `exclude_bin` three times, each time to say that it does not exist: in the rubric, the model answer and `common_mistakes`. A plain phrase match would flag those correct sentences. | When the lead adds the phrase, let it pass where it appears in a negation (for example "no `exclude_bin`" or "non-existent `exclude_bin`"), or allowlist this item. | `content/interview-questions/debug.json` (rubric, model_answer, common_mistakes of this item) |

## Checked and correct (no change needed)

**IEEE 1800.2-2020 clause numbers.** Each was found as a heading in `uvm_lrm.txt`, with matching content:
- Seeding: 5.3.3.1 `get_uvm_seeding` and 5.3.3.3 `reseed`.
- Reporting: 6.5.1.2.6 `get_severity_count`, 6.5.1.2.14 `process_report_message`, 6.6 `uvm_report_catcher`, and 6.6.5 `catch` with `{UNKNOWN_ACTION, THROW, CAUGHT}`.
- Factory: 8.2.3.2.5 `set_type_override`, 8.3.1.4.2, 8.3.1.7.1 `find_override_by_type` and 8.3.1.7.5 `print`.
- Phases and objections: 9.3.1.7.1 `get_objection`, 9.3.1.7.2 and 10.5.1.3.3 `raise_objection`, 10.5.1.5.1 `get_objectors`, and 10.6 `uvm_heartbeat`.
- Components: 13.1.4.1.7 `check_phase` and 13.1.7.13 `set_recording_enabled`.
- Sequences: 14.2.3.1 `start`, 14.2.4.2 `set_starting_phase` and 14.2.4.4 `set_automatic_phase_objection`.
- Sequencer interface: 15.2.1.2.1 `get_next_item` and 15.2.1.2.2 `try_next_item` ("otherwise returns with the t set to null").
- Message macros: B.1.1.1 `` `uvm_info ``.
- Configuration: C.4.2.2.1 `set` (full scope `{cntxt,".",inst_name}`, build-time precedence), C.4.2.2.2 `get` (returns `bit`) and C.4.2.3.1 `uvm_config_int`.
- Root: F.7.3.3 `set_timeout` and F.7.4.2 `print_topology`.
- Command-line plusargs, G.2.2 to G.2.7:
  - The `time` form of `+uvm_set_verbosity` and `_ALL_` match G.2.3.
  - `+UVM_MAX_QUIT_COUNT=<count>,<YES|NO>` matches G.2.6.
  - The `+uvm_set_action` form matches G.2.4.

**Labelled uvm-core-only, and correct.** `+UVM_CONFIG_DB_TRACE`, `+UVM_OBJECTION_TRACE`, `+UVM_PHASE_TRACE`, `+UVM_TIMEOUT` and `debug_create_by_type` are not in 1800.2 and exist in uvm-core 2020.3.1.

**IEEE 1800-2023 clause numbers.** Each was found as a heading in `t1_lrm_clean.txt`, with matching content:
- §4.7 ("active events can be taken off the Active or Reactive event region and processed in any order") and §4.8.
- §6.3.1, and §6.8 with Table 6-7 (4-state integral default `'x`).
- §10.4.2.
- §11.4.5, and §11.4.11 (an ambiguous condition combines the operands bit by bit).
- §12.4 ("has a zero value or the value is x or z") and §12.5.
- §14.13, and §14.16 (zero-skew drives "shall schedule new values in the Re-NBA region").
- §16.5.1 and §16.9.3; §16.12 (disable condition: "current simulation cycle, i.e., not sampled"); §16.12.7 and §16.14.8.
- §18.14, §18.14.1 and §18.14.3. §18.14.1 has the hierarchical seeding and the "new objects, threads, and random numbers can be created after existing objects" advice.
- §19.5.5, §19.5.6, §19.6.2, §19.6.3 and §19.11.
- §20.9 (`$isunknown`), §20.10, §20.11 and §20.14.1 (`$random`).
- §21.6 and §21.7.1.3 (`$dumpoff`/`$dumpon`).
- §31.3 (lists `$setup`, `$hold`, `$setuphold`, `$recovery`, `$removal` and `$recrem`), §31.4 and §31.6.
- Clause 32 ("Backannotation using the standard delay format").

**Arm IHI0022E.**
- A3.1.2: the master must drive ARVALID, AWVALID and WVALID LOW, and the slave must drive RVALID and BVALID LOW.
- A3.2.1: "Once VALID is asserted it must remain asserted until the handshake occurs".
- A3.3.1: the receiver "can wait until it detects a VALID signal before it asserts its corresponding READY signal". There is no READY timeout, and no rule makes RREADY independent of ARREADY. The "design rule" label in snapshot B is therefore correct.

**uvm-core behaviours.**
- `PH/TRC/SKIP` "No objections raised, skipping phase" is at `uvm_phase_hopper.svh:518`, at `UVM_LOW`.
- `PH_TIMEOUT` "%s timeout of %0t hit, indicating a probable testbench issue" is at line 587. `PH/TRC/TIMEOUT/OBJCTN` is at line 579. `UVM_DEFAULT_TIMEOUT` is 9200s, defined in `uvm_global_defines.svh:85`.
- `try_next_item` calls `wait_for_sequences()`, which calls `uvm_wait_for_nba_region()` (`nba <= next_nba; @(nba);`). No simulation time passes, so the time-stuck diagnosis is correct.
- `SEQ` fatal "neither the item's sequencer nor dedicated sequencer has been supplied" is at `uvm_sequence_base.svh:1062`.
- `DRVCONNECT` is a warning in `end_of_elaboration_phase` (`uvm_driver.svh:101`).
- `TYPDUP` (`uvm_factory.svh:1123/1129`). `RNTST` and `INVTST` (`uvm_root.svh:572-600`). `OBJTN_TRC` (`uvm_objection.svh:203`). "Quit count reached!" (`uvm_report_server.svh:988`).
- `` `uvm_error `` and `` `uvm_warning `` are guarded by the action check in `` `uvm_report_begin ``. So the honest-verdict claim that a `UVM_NO_ACTION` error "is never even created" is correct.

**Answer keys and traced examples.** Each was traced by hand:
- **Assertion window.** `$rose(req)` is true at edge 2. The sampled `ack` is 0 at edges 3–5, so the attempt fails at edge 5.
- **Race table.** A gives 03/07/09 and B gives 07/09/09. Both are legal under §4.7.
- **X-prop table.** RTL `y` is 22 until `sel` loads at edge 4. The `$isunknown` assertion fires at edges 1–4, as follow-up 2 says.
- **Config DB.** The three bugs are the scope, the type and `void'`. The order is correctly declared not a bug.
- **Override.** The two bugs are `new()` and the missing macro. The order is not a bug. A derived class without the macro inherits the static `get_type()`, so the override maps the type to itself.
- **Zero-time test.** No objection is raised; both fixes are correct.
- **Snapshot B.** The circular wait is correctly read.

**Code legality, by inspection; nothing was compiled.**
- The covergroup with `with function sample`, `illegal_bins`, and the cross `ignore_bins` with `binsof(...) intersect ... && binsof(cp_kind.atomic)`.
- The clocking block (`default input #1step output #0`).
- The `$isunknown` property with `disable iff`.
- The report catcher (`action_e catch()`, `uvm_report_cb::add(null, qc)`).
- The `check_phase` macros inside `if` (the macros expand to `begin ... end`).
- The reworked `try_next_item` loop.
- The `$test$plusargs` guard.
