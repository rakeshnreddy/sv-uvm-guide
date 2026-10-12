# G29-B-UVM completeness review, round 1: `uvm.json`

Reviewer: completeness and usefulness lens. Date: 2026-10-11. Read-only except for this file.

Inputs read:
- `docs/curriculum-quality/README.md`.
- `analysis/G29.md`: the `uvm.json` section (UVM-01 to UVM-14), Coverage gaps and Requests for the lead.
- `analysis/G29.verify.md`: the adjustments (UVM-06 moved to S3, UVM-07 scope), the missed issues UVM-V01/V02, completeness gaps 1, 3 and 7, and the notes for the implementation author.
- `curriculum-spine.md`: the UVM module cards, including the proposed I-UVM-1D, I-UVM-3C and A-UVM-9.
- `reviews/G29-B-UVM.author.md`.
- The whole bank (30 questions) and its diff (`git diff HEAD`: +843/−47).
- The loader and page: `src/app/(learning)/interview-prep/interview-banks.ts` and `page.tsx`. `src/lib/practice-links.ts`.

## Verdict

**Pass: no S1 or S2 remains.** 0 S1, 0 S2, 3 S3, 5 S4.

## Checks run

| Check | Result |
|---|---|
| JSON parses (`python3 -c "import json;json.load(...)"`) | OK |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts` | 4 files, 863 tests, all pass. This matches the author's final run. |
| Pinned id | `uvm-factory-purpose` is kept. Its `modules` start with `I-UVM-1B_The_UVM_Factory/index`, which is what `tests/app/interview-prep-banks.test.ts:138` expects. |
| Every `modules` entry resolves to `content/curriculum/*/<module>.mdx` | All 30 questions resolve (checked with glob). Each question's first module is the one that teaches its core. |
| Levels | junior 7, mid 8, senior 9, staff 4, senior-staff 2. That is at least 3 junior, the levels span junior to senior staff, and the analysis target of at least 5 junior and 5 staff-or-above items is met. |
| Coding and waveform items carry code or a cycle table | All 5 `coding` items have full code in `model_answer`, which is correct because writing the code is the task. The one `waveform-debug` item (`uvm-staff-debug-hanging-sim`) has a Run A log and a Run B cycle table in `code`. 9 further concept or trick items carry code or a trace in `code`. |
| `follow_ups` and `common_mistakes` | Present on all 30: 3–4 follow-ups and 3–4 mistakes each. They are specific; for example the time-0 `UVM_ERROR : 0` log, the level-sensitive IRQ, and the scatter-gather DMA. |
| Rubrics separate strong from weak answers | All 30 end with a "weak answer" sentence that names a specific wrong move, such as "receives a copy", reversed DMA roles, `join_none`, FIFO plus priority, or a passive agent with an idle driver. |
| Known-wrong phrases | "receives a copy", "safety net", "sub-phases", "§3 (Factory)", "§9.4 (Objections)", "debug guide" and "95%" now appear only as corrections, in `common_mistakes` or the rubric (`uvm.json:131`, `:134`, `:457`). |
| Cited 1800.2-2020 clauses (`uvm_lrm.txt`) | I checked 97 cited clauses by heading. Each matches its cited topic, including §5.3.5.2, §6.3.3.2, §6.5.1.2.3, §6.6.5, §7.1, §8.2.3.2.5/6, §8.3.1.4.1/2, §8.3.1.5, §9.3.1.3.5, §9.3.1.8.1, §9.3.1.9.1, §9.4.2.4, §9.8.1.1/4/7, §10.1.1.2.4/5, §10.4.1, §10.5.1.3.2/7, §10.7.2.3.1, §11.2, §12.2.8.2/3, §12.2.10.1.4, §12.3.4.2, §12.3.5, §13.1.4.4.1, §13.1.5.1, §14.1.2.4, §14.2.4.4, §14.2.5.2/3/5/6/8/11, §14.2.7.1, §15.3.2.14/19, §16.3, §18.1.5.3/5, §18.2.5.2, §18.4.4.1/2/3/9/13/14/15, §19.2.1.2.5/6, B.1.1.1, B.3.3, B.4.1, B.4.3, B.5.22, C.4.2.2.1/2, F.2.1.7, F.2.4.1, F.7.3.3 and G.2.2/6/7. The "approved 4 June 2020" date matches the front matter. A full accuracy pass belongs to the accuracy reviewer. |
| uvm-core message text used in answer keys | The PH_TIMEOUT text "%s timeout of %0t hit, indicating a probable testbench issue" (`uvm_phase_hopper.svh:587-589`) and the "Get_next_item called twice..." error (`uvm_sequencer.svh:226-227`) match the sources in `scratchpad/g29b/src/`. |
| Rendering | The loader formats `{doc, verified:false}` sources as "... (unverified)" (`interview-banks.ts:88-92`). `code` and fenced blocks in `model_answer` go through `RichText`. |

## S1/S2 resolution (G29.md and G29.verify.md)

| ID | Sev | Status |
|---|---|---|
| G29-UVM-01 | S1 | **Resolved.** `uvm-tlm-analysis-port` states that `write()` passes the same handle. The prompt is now a reused-object monitor bug, fixed with a new item per transaction plus clone-before-store. It covers zero subscribers, no flow control, and the unbounded analysis FIFO. |
| G29-UVM-02 | S1 | **Resolved.** A missing drop ends in a PH_TIMEOUT fatal at the 9200 s default (`set_timeout`, F.7.3.3; `+UVM_TIMEOUT`, labelled as uvm-core). Drain time starts after the count reaches zero (§10.5.1.3.7). The fix is repeated in `uvm-end-of-test-drain` and `uvm-phase-concurrency-trap`. |
| G29-UVM-03 | S2 | **Resolved.** With no raise, the phase is skipped after one NBA region, shown by `+UVM_PHASE_TRACE`. Raising after a delay is too late. Objections belong in the test or the top sequence, not in drivers. |
| G29-UVM-04 | S1 | **Resolved.** The roles are correct: an APB master agent, and an AXI slave responder with a memory model and knobs. It uses an explicit predictor with auto-predict off, volatile, `predict()` or W1C for hardware-updated fields, an interrupt monitor, a memory-image scoreboard keyed by address, and passive reuse at SoC level. |
| G29-UVM-05 | S2 | **Resolved.** The answer says messages print when issued, BDTYP is a warning that returns null, a missing macro is a compile error, INVTST is fatal, and a failed `get()` returns 0. A common mistake repeats the correction. |
| G29-UVM-07 | S2 | **Resolved.** Every source was replaced with a verified clause or a labelled uvm-core file. The "debug guide" citation is gone. `uvm_tlm_fifo` is cited as §12.2.8.2, following the verifier's caution about the annotation. |
| G29-UVM-14 | S2 | **Resolved.** Every topic the finding lists now has a question: RAL, callbacks, reporting, object vs component, active/passive, driver handshake, TLM FIFOs, field macros vs `do_*`, lock/grab, end of test, phase order, scoreboards and performance. |
| Navigation S2 (banks unreachable) | S2 | Lead-side and done: `/interview-prep` renders the bank, and every question's `modules` give "Learn it in" links. |
| Lower-severity items checked in passing | S3/S4 | UVM-06, 08, 09, 10, 11, 12 and 13, and V01 and V02, are all addressed as the author's log describes. |

## Coverage gaps assigned to `uvm`

Most gap rows in G29.md's table are filled, as are the verifier's UVM additions: `uvm_event`, `uvm_barrier` and `uvm_heartbeat`, command-line overrides, the derived-class TYPDUP trap, I-SV-9 and I-UVM-5. These are not fully filled:
- layered sequences (finding 1);
- RAL built-in sequences and TLM1 blocking vs non-blocking (finding 5);
- I-UVM-6 recording and the standalone TLM2 question (findings 4 and 6).

The new spine module I-UVM-3C has no question in any bank (finding 2).

## Findings

| # | Sev | Question id | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S3 | (bank) / `uvm-virtual-sequencer`, `uvm-sequence-arbitration-lock-grab` | The gap row "Layered sequences and protocol layering (senior, uvm)" is not filled. The author's log says it is covered as a "Follow-up only", but no follow-up, answer or `modules` entry mentions layering. A grep for "layered seq", "translation", "upper" and "sub-sequencer" finds nothing, and no question in any bank maps `I-UVM-3B_Advanced_Sequencing_and_Layering/layered-sequences`. | Add a senior question, coding or verification-plan. Example: "Layer a packet protocol over a byte-stream agent." The answer should cover an upper-layer sequencer, a translation sequence running on the lower sequencer that pulls upper items through a `seq_item_pull_port`, response and ID routing back up, and the passive-monitor reconstruction path. Map it to `I-UVM-3B_.../layered-sequences`. If the bank must stay at 30, at least add a layering follow-up to `uvm-virtual-sequencer` with that module ref, and correct the log's claim. | `G29.md` Coverage gaps row "Layered sequences"; grep of `uvm.json`; `content/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/layered-sequences.mdx` exists |
| 2 | S3 | (bank) | The spine module I-UVM-3C "Your First Complete UVM Testbench" (`content/curriculum/T2_Intermediate/I-UVM-3C_First_Complete_Testbench/`) has no question in any bank. The bank also never covers the top-module handoff: `run_test()` has 0 hits, and nothing covers the `uvm_config_db` vif set in `tb_top` or a null vif. That handoff is the most common junior UVM interview question. The I-UVM-3C card's assessment focus lists exactly the misconceptions a junior question should test: no objection, a zero-transaction scoreboard counted as a pass, and a vif set by hierarchical reference from the test. | Add a junior question such as: "How does the driver get its virtual interface? Walk through `tb_top` from clock and reset to `run_test()`." Put a short `tb_top` plus agent `build_phase` in `code`. The answer covers the `set(null, "uvm_test_top.*", "vif", vif)` scope, the checked `get` with `uvm_fatal`, the `+UVM_TESTNAME` path (G.2.1; INVTST), and the four I-UVM-3C bring-up failures from logs. Map it to `I-UVM-3C_First_Complete_Testbench/index` and `I-UVM-2C_Configuration_and_Resources/index`. | `curriculum-spine.md` I-UVM-3C card (objectives and assessment focus); `src/lib/practice-links.ts:271` (only the lab maps there); grep of all banks; 1800.2 G.2.1, C.4.2.2.1/2 |
| 3 | S3 | `uvm-driver-sequencer-handshake` | The forgotten-`item_done()` symptom is incomplete, and the rubric rewards only the incomplete version. In uvm-core, a second `get_next_item()` reports the "called twice" error and then still calls `m_safe_select_item`, which `peek`s the request FIFO. The same un-completed item comes back, so the driver re-drives one transaction on every loop iteration with one error each time. That repeated transaction on the waveform, and a log flooded with the error, is the most visible clue. A `+UVM_MAX_QUIT_COUNT` stops the run there, before PH_TIMEOUT. | In the "Forgetting `item_done()`" paragraph (`uvm.json:249`), add: "the next `get_next_item()` returns the same item again, so the driver re-drives it forever, logging the error on every iteration; the DUT sees duplicates; time advances, so the run ends at PH_TIMEOUT unless a quit count stops it first". Label this as uvm-core behaviour. Add "re-drives the same item" to the rubric's failure symptoms. | uvm-core 2020.3.1 `uvm_sequencer.svh:218-232` (error, then `m_safe_select_item(1, t)`); `uvm_sequencer_param_base.svh:508-547` (`m_req_fifo.peek(t)`) |
| 4 | S4 | `uvm-performance-hotspots` (I-UVM-6) | I-UVM-6 is linked only through one bullet: recording is a cost to switch off. No question asks what transaction recording is or how to use it: `begin_tr`/`end_tr`, `uvm_tr_database` and `uvm_tr_stream`, `recording_detail`, and viewing transactions in the waveform tool. The verifier listed I-UVM-6 among modules that needed a question. | Add a follow-up to `uvm-performance-hotspots` or `uvm-staff-debug-hanging-sim`: "How would you record driver transactions as streams for the waveform viewer, and which knob turns it off for regressions?" Its answer cites §5.4.2.4 (`begin_tr`), §7.1 and §7.2. Or add a short mid-level question later. | `G29.verify.md` completeness gap 1; 1800.2 §5.4.2.4, §7.1, §7.2 (checked in `uvm_lrm.txt`) |
| 5 | S4 | `uvm-ral-mirror-prediction`, `uvm-tlm1-ports-exports-imps` | Two parts of assigned gap rows are missing. (a) The RAL row includes "built-in sequences", but the bank never mentions `uvm_reg_hw_reset_seq`, `uvm_reg_bit_bash_seq` or the `NO_REG_TESTS` resource. (b) The TLM1 row includes "blocking vs non-blocking", but `try_put`, `can_put`, `try_get` and `can_get` and the port variants (blocking, nonblocking, combined) never appear. | (a) Add a RAL follow-up: "Which built-in register sequences run first on a new block, and how do you exclude a register with side effects?" (E.1, E.2.2, `NO_REG_TESTS` / `NO_REG_HW_RESET_TEST` in the `REG::` namespace). (b) Add one paragraph or follow-up to the TLM1 item. `try_put` (§12.2.4.2.4) and `try_get` are functions that return a status bit at once; `put` and `get` are tasks. The port variant decides which methods exist. | `G29.md` Coverage gaps (RAL row, TLM 1 row); 1800.2 Annex E.1, E.2.2, §12.2.4.2.4 (checked in `uvm_lrm.txt`) |
| 6 | S4 | `uvm-multi-language-strategy` (TLM2) | TLM2 sockets and the generic payload appear only at the language boundary. The deferral is reasonable for a 30-item bank, but no item lets a candidate show what TLM2 adds over TLM1. | Add a follow-up to `uvm-tlm1-ports-exports-imps`: "What does UVM TLM2 add over TLM1, and when would an SV bench use it?" Answer: the generic payload (§12.3.4.2), initiator and target sockets (§12.3.5), `b_transport`/`nb_transport` with timing annotation, typically at a SystemC boundary. | `G29.verify.md` completeness gap 3; 1800.2 §12.3, §12.3.4.2, §12.3.5 |
| 7 | S4 | (lead request 5) | The proposed lint for known-wrong phrases ("safety net", "receives a copy", "sub-phases") would flag this bank's own corrections. They appear in negated form in `common_mistakes` and the rubric (`uvm.json:131`, `:134`, `:457`). | When the lead adds the lint, scope it to `model_answer` and the positive part of `rubric`, or match only un-negated phrasing. Do not ask authors to reword the corrections. | grep of `uvm.json` |
| 8 | S4 | `uvm-staff-debug-hanging-sim`, `uvm-reporting-verbosity`, `uvm-phase-concurrency-trap` | 14 of 30 items are `concept`. Three are really a debug item or predict-the-output items, but the schema test's `VALID_CATEGORIES` has no such categories yet. The author already raised this as lead request 2. | No author action. When the lead adds `debug` and `predict-output`, recategorize these three as the author proposes. | `tests/interview-questions/bank-schema.test.ts` (`VALID_CATEGORIES`); author log, request 2 |

## Notes for the author (round 2)

- Findings 1–3 are the only ones that need bank edits for this lens. If two questions are added (findings 1 and 2), the bank has 32 items. No test caps the count; the schema test checks shape and unique ids only.
- Keep `uvm-factory-purpose` and its first module unchanged.
- Correct the author log's "Layered sequences: Follow-up only" line in the same round.
