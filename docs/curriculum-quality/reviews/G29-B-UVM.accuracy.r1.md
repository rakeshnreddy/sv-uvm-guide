# G29-B-UVM accuracy review, round 1: `content/interview-questions/uvm.json`

Reviewer: accuracy lens, round 1. Date: 2026-10-18. Read-only except this file.

**Result: pass.** No S1 or S2 findings. 4 S3 and 3 S4 findings remain for the author's fix round.

## What I checked

- **Inputs:** README brief, `analysis/G29.md` (uvm section, Coverage gaps, Requests for the lead), `analysis/G29.verify.md` (adjustments, missed issues, notes for the author), the author log, and all 30 questions in the bank, field by field.
- **IEEE 1800.2-2020 citations:** I extracted every 1800.2 clause cited in `sources` (about 120 distinct clauses and annexes) and matched each one against its heading in `uvm_lrm.txt`. All resolve to the named class, method or annex entry, including Annex G.2.2, G.2.6 and G.2.7, F.2.1.7, F.2.4.1, F.7.3.3, B.1.1.1, B.3.3, B.4.1, B.4.3, B.5.22 and C.3.2/C.4.2.2.x. `uvm_tlm_fifo` is correctly cited as 12.2.8.2 (12.2.8.2.1: `size = 1`, 0 means unbounded). I found no invented clauses.
- **Normative text checked against the LRM:**
  - 8.3.1.5: instance overrides before type overrides, recursive overrides.
  - 8.2.3.2.6: relative path with a parent, absolute without one.
  - 9.8.1 and 9.8.1.1–9.8.1.9: everything before run executes at time 0; build and final are top-down, the rest bottom-up.
  - 9.8.2: run-time phases start after start_of_simulation, and extract waits for them.
  - 6.3: default actions per severity.
  - 10.5.1.3.7: drain time is measured from the last drop.
  - 14.2.3.1 and 14.2.5.2: root priority is 100, and a child inherits its parent's.
  - 14.2.5.5 and 14.2.5.6: lock is arbitrated; grab goes to the front of the queue.
  - F.2.4.1: FIFO is the default; WEIGHTED is random by weight.
  - 18.2.5.2: auto-predict is off by default; use a predictor to see all bus traffic.
  - 10.7.2.3.1: a null object means type-wide.
  - 10.1.1.2.4 and 10.1.1.2.5: the wait_trigger race and wait_ptrigger.
  - 12.2.8.3: the analysis FIFO is unbounded.
  - 14.2.4.4: the `forever` note.
  - 15.3.2.14: stop_sequences.
  - 13.1.4.4.1: set_domain.
  - 9.3.1.9.1: jump.
- **uvm-core 2020.3.1 behaviour** (sources at `~/Downloads/1800.2-2020.3.1/src`). Every message ID the bank quotes exists with the stated severity: ILLCRT (fatal after build), ILLCLN, SEQNOTITM, SQRBADITMDN, the "called twice" error, the "Response queue overflow" error, TYPDUP, FCTTYP, BDTYP (warning), DCLPSQ, CBUNREG, INVTST, RNTST and PH_TIMEOUT. Each one was checked against its source. I also checked:
  - The PH_TIMEOUT watchdog (`uvm_phase_hopper.svh`, run-phase branch, `` `uvm_delay ``), its message text, and the outstanding-objection listing under phase trace.
  - "No objections raised, skipping phase" after `uvm_wait_for_nba_region`.
  - `wait_for_self_and_siblings_to_drop`: `main_phase` has no `run` sibling, so the phase-concurrency trap's answer, that `main_phase` ends at time 0, holds.
  - The config_db precedence `default - cntxt.get_depth()`, so the test-vs-env answer is 50.
  - `uvm_agent::build_phase` reads `is_active` as an enum, int or string.
  - `uvm_object::copy` runs field automation and then `do_copy`.
  - The comparer's `sev = UVM_INFO`.
  - `uvm_pool::get` and `uvm_object_string_pool::get` create missing entries.
  - `wait_ptrigger` checks `triggered`.
  - `response_queue_depth = 8`, `UVM_DEFAULT_TIMEOUT 9200s`, 20 ready-to-end iterations, `recording_detail = UVM_NONE` and `m_prop_mode = 1`.
- **IEEE 1800-2023 clauses** (`t1_lrm_clean.txt`): §6.24.2, §7.8, §7.10, §8.12, §15.5.3, §16.14, §25.9, §35.5 and Annex H all match their stated topics. §35.4 does not (S4 below).
- **Arm IHI0022E §A3.4.4** is "Read and write response structure". Correct.
- **Code:** read every code block for legality and intent. All of them are legal SystemVerilog/UVM as far as reading can tell (no compile was run, same as the author). One block does not do what its answer says (S3, `uvm-end-of-test-drain`).
- **Analysis fixes:** G29-UVM-01 to -14, V01 and V02 are all fixed correctly in the bank. The text no longer says an analysis port "receives a copy", no longer calls drain time a "safety net", and no longer claims an "infinite hang". The roles in the DMA environment are correct, and the old "§3"/"§9.4"/"debug guide" citations are gone.
- **Ids and modules:** `uvm-factory-purpose` is kept (pinned by `tests/app/interview-prep-banks.test.ts:138`). Every `modules` ref resolves to an existing `.mdx` file under `content/curriculum/`.

## Findings

| # | Sev | Question id | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| A1 | S3 | `uvm-callbacks-vs-factory` | `common_mistakes`: "Forgetting `uvm_register_cb`, so `add()` only warns CBUNREG and the callback never runs." The standard requires only the warning (B.4.1). In uvm-core 2020.3.1, `uvm_callbacks::add()` issues CBUNREG and then goes on to add the callback (no `return`). `get_first()`/`uvm_do_callbacks` iterate the queue without checking registration, so the callback still runs in the simple case. "Never runs" teaches the wrong consequence. (Reading only, not simulated.) | Say: "Forgetting `uvm_register_cb`: `add()` warns CBUNREG (B.4.1), and the type/callback pairing is unchecked, so a typo or a wrong callback type goes unnoticed. Treat the warning as an error." Drop "the callback never runs", or label it as needing a simulator check. The rubric's "forgets `uvm_register_cb`" is fine as a weak-answer marker. | IEEE 1800.2-2020 B.4.1; uvm-core `base/uvm_callback.svh` add() (CBUNREG warning, then `m_add_tw_cbs` / `m_pool` add), `get_first` (no registration check) |
| A2 | S3 | `uvm-vip-architecture` | The answer says "Protocol violations are errors, not fatals, so a user can demote an expected one by ID with a catcher". `common_mistakes` says `uvm_fatal` is a problem because "users cannot selectively demote" it. Both are wrong: a report catcher "can modify the severity, id, action, verbosity" of any report, fatals included (6.6). Severity can also be overridden per ID (`+uvm_set_severity`, G.2.5; `set_report_severity_id_override`). The advice is sound; the reason given is false. | Give the real reason: a fatal ends the run by default (UVM_DISPLAY \| UVM_EXIT, 6.3), so one violation hides everything after it, and error-injection tests would need every user to add a demotion. Errors count and the run continues. Remove "cannot selectively demote". | IEEE 1800.2-2020 §6.6 (catch may modify severity), §6.3 (default actions), Annex G.2.5 |
| A3 | S3 | `uvm-end-of-test-drain` | The `phase_ready_to_end()` code is called "bounded", but it is bounded only by the iteration limit. After the `#50us` branch fires, `n_outstanding` is still non-zero. The hopper then calls `phase_ready_to_end()` again, which re-raises and waits another 50 us, until the iteration limit is reached (20 by default). The result is about 1 ms of extra time and 20 copies of SCB/DRAIN, not one bounded wait. | Add a flag, for example `bit drain_timed_out;` set in the timeout branch, and return at entry: `if (phase.get_name() != "run" \|\| n_outstanding == 0 \|\| drain_timed_out) return;`. Optionally mention that the iteration limit (9.3.1.3.5) is the backstop. | uvm-core `base/uvm_phase_hopper.svh:527-544` (ready-to-end loop re-calls `traverse_on` READY_TO_END while state is EXECUTING and count < max); `uvm_phase.svh:460` (20); IEEE 1800.2-2020 §9.3.1.3.5, §13.1.4.3.2 |
| A4 | S3 | `uvm-staff-debug-hanging-sim` (also the `uvm-factory-purpose` follow-up on creating an unregistered type) | "Creating an unregistered type by name prints a BDTYP warning and returns null" is stated as UVM behaviour without a label. IEEE 1800.2 says "an error shall be generated and a null handle returned". The warning severity is uvm-core 2020.3.1's deviation. A candidate who says "error" is right by the standard. | Write: "IEEE 1800.2 requires an error and a null handle (§8.3.1.5). uvm-core 2020.3.1 issues it as the warning BDTYP, so it is easy to miss in a log." Apply the same label in the `common_mistakes` bullet and in the rubric's "(BDTYP, ...)". | IEEE 1800.2-2020 §8.3.1.5; uvm-core `base/uvm_factory.svh:1520,1610` (`uvm_report_warning("BDTYP", ...)`) |
| A5 | S4 | `uvm-driver-sequencer-handshake` | (a) "Forgetting `item_done()`" leaves out the most visible symptom. In uvm-core, the next `get_next_item()` reports the "called twice" error and then returns the same item again (`m_safe_select_item` peeks the request FIFO). The driver therefore re-drives one transaction on every loop until PH_TIMEOUT. (b) The `get_response(rsp)` comment, "returns the response whose ids match", is imprecise: with the default `transaction_id = -1` it returns the next response queued for this sequence. The sequencer routes responses by sequence id. | (a) Add: "and returns the same item again, so the bus shows one transaction repeated". (b) Write: "returns the next response routed to this sequence (by `set_id_info`'s sequence id); pass a transaction id to wait for a specific one". | uvm-core `seq/uvm_sequencer.svh:218-232`, `seq/uvm_sequencer_param_base.svh:508-549`; IEEE 1800.2-2020 §14.2.7 (get_response) |
| A6 | S4 | `uvm-virtual-sequencer` | "There is no sequencer on which to set a default sequence or take a lock" (the `start(null)` alternative) overstates the point. A sequence started with `start(null)` can still call `lock(apb_sqr)` on a real sequencer, because 14.2.5.5 takes the sequencer as an argument and uvm-core registers the sequence on the lock request. A lock on a virtual sequencer would not lock its sub-sequencers anyway. | Write: "no sequencer on which to set a default sequence. Locks are taken on the real sequencers in either style." | IEEE 1800.2-2020 §14.2.5.5; uvm-core `seq/uvm_sequencer_base.svh:1124-1152` (`m_lock_req` calls `m_register_sequence`) |
| A7 | S4 | `uvm-multi-language-strategy` | The source "IEEE 1800-2023 §35.4, §35.5 (DPI imported tasks and functions)" is partly mislabelled. §35.4 is "Global name space of imported and exported functions"; only §35.5 is "Imported tasks and functions". | "§35.4 (global name space of imported and exported functions), §35.5 (imported tasks and functions)", or drop §35.4. | IEEE 1800-2023 clause headings in `t1_lrm_clean.txt` |

## Confirmed correct (spot list of the claims most likely to be probed)

- **Objections, drain time and the end of the run phase:**
  - A missing drop ends in PH_TIMEOUT while time advances.
  - A missing raise ends the phase after one NBA region, at time 0.
  - Drain time starts after the last drop.
  - The order is drop, then drain, then the ready-to-end iterations, then the phase end and the kill.
- **Phase-concurrency trap:**
  - With no `main_phase` objection, `main_phase` ends at time 0 and its sequence is killed.
  - `run_phase` idles until 10 us.
  - The watchdog covers a hung `main_phase`.
  - "In parallel" is correctly attributed to uvm-core's `with_phase` run. The standard only orders the run-time phases between start_of_simulation and extract.
- **Factory:** "Instance overrides before type overrides" and chaining are 8.3.1.5 nearly word for word. FCTTYP comes from the registry's typed `create()` `$cast`. The missing-utils-macro trap (inherited `get_type()`, then TYPDUP "arguments are identical: bus_driver") matches `uvm_factory.svh:1118-1131`.
- **config_db:** depth-based build-time precedence and last-wins after build both match the `set()` doc and `uvm_config_db_implementation.svh:404`. The answer key of 50 is right.
- **Analysis ports and FIFOs:** the same handle goes to every subscriber, zero subscribers is legal, `uvm_tlm_fifo` defaults to size 1, and the analysis FIFO is unbounded.
- **Sequences and arbitration:** FIFO ignores priority. WEIGHTED is random by weight. The STRICT modes serve the highest priority first. Root priority is 100 and children inherit it. Lock is arbitrated and grab goes to the front.
- **RAL:** auto-predict is off by default and sees only accesses made through the model. The predictor wiring (`map`, `adapter`, `bus_in`) is right. Volatile fields get UVM_NO_CHECK in uvm-core.
- **Reporting:** the default actions per severity are right, the verbosity rule is "at or below", the `` `uvm_info `` macro guards message formatting (B.1.1.1), and `$error` is not counted.

## Summary for the orchestrator

- S1: 0. S2: 0. S3: 4 (A1–A4). S4: 3 (A5–A7).
- Pass on the accuracy lens. The S3 items are worth fixing in the next author round, because A1 and A2 each state a false consequence that a candidate could repeat in an interview.
