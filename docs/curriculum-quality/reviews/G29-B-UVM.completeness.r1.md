# G29-B-UVM completeness review, round 1: `uvm.json`

Reviewer: completeness and usefulness lens. Date: 2026-10-18 (this re-runs the 2026-10-11 round-1 pass; the bank has not changed since then, mtime 2026-10-11 18:33). Read-only except for this file.

Inputs read:
- `docs/curriculum-quality/README.md`.
- `analysis/G29.md`: the `uvm.json` section (G29-UVM-01 to -14), "## Coverage gaps" and "## Requests for the lead".
- `analysis/G29.verify.md`: the adjustments (UVM-06 to S3, UVM-07 scope), the missed issues UVM-V01/V02, completeness gaps 1, 3 and 7, and "## Notes for the implementation author".
- `curriculum-spine.md`: the UVM cards, including I-UVM-1D, I-UVM-3B, I-UVM-3C, I-UVM-4, I-UVM-5, I-UVM-6 and A-UVM-9.
- `reviews/G29-B-UVM.author.md`.
- The whole bank (30 questions, read in full) and `git diff HEAD -- content/interview-questions/uvm.json` (+843/−47).
- `src/app/(learning)/interview-prep/page.tsx` and `interview-banks.ts` (rendering), `tests/app/interview-prep-banks.test.ts` (pinned id).

Sources checked: IEEE 1800.2-2020 text (`sources/uvm_lrm.txt`, searched with Python); uvm-core 2020.3.1 at `/Users/Rakesh/Downloads/1800.2-2020.3.1/src/` (labelled as the implementation below).

## Verdict

**Pass: no S1 or S2 remains.** 0 S1, 0 S2, 3 S3, 6 S4.

## Checks run

| Check | Result |
|---|---|
| JSON parses (`python3 -c "import json;json.load(...)"`) | OK |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts` | 4 files, 863 tests, all pass (run 2026-10-18). |
| Pinned id | `uvm-factory-purpose` kept; first module `I-UVM-1B_The_UVM_Factory/index` (`tests/app/interview-prep-banks.test.ts:138`). |
| `modules` refs | All 30 questions resolve to `content/curriculum/*/<Module>/<lesson>.mdx` (glob check). Each question's first module is the lesson that teaches its core; the test "resolves every modules entry" also passes. |
| Levels | junior 7, mid 8, senior 9, staff 4, senior-staff 2. At least 3 junior (target in G29.md was ≥5 junior and ≥5 staff-or-above: met). |
| Coding / waveform items | All 5 `coding` items carry full code in `model_answer` (the code is the answer). The `waveform-debug` item has a Run A log and a Run B per-clock cycle table in `code`. 9 further concept/trick items carry code or a trace in `code` or the answer. |
| Rubrics | All 30 describe a strong answer and end with a specific "weak answer" sentence naming the wrong move (e.g. "receives a copy", roles reversed, `join_none`, priority under FIFO, idle-driver passive agent). They discriminate. |
| `follow_ups` / `common_mistakes` | Present on all 30 (3–4 each), specific, and rendered by the page (`page.tsx:136-137`). |
| Known-wrong phrases | "receives a copy", "safety net", "sub-phases", "hangs forever", "95%" appear only as corrections in `common_mistakes` or rubrics. |

## S1/S2 resolution (G29.md and G29.verify.md)

| ID | Sev | Status |
|---|---|---|
| G29-UVM-01 | S1 | **Resolved.** `uvm-tlm-analysis-port`: same handle to every subscriber, reused-object monitor bug in `code`, fix by new item per transaction plus clone-before-store, zero subscribers legal, no flow control, unbounded analysis FIFO. |
| G29-UVM-02 | S1 | **Resolved.** Missing drop ends in PH_TIMEOUT at 9200 s (`set_timeout` F.7.3.3; `+UVM_TIMEOUT` labelled uvm-core); drain time starts after zero (§10.5.1.3.7). Repeated in `uvm-end-of-test-drain`, `uvm-phase-concurrency-trap` and the hang item. Watchdog text matches uvm-core `uvm_phase_hopper.svh:561-589`. |
| G29-UVM-03 | S2 | **Resolved.** No raise: phase skipped after one NBA region, visible with `+UVM_PHASE_TRACE`; late raise too late; objections in test or top sequence. |
| G29-UVM-04 | S1 | **Resolved.** APB master + AXI slave responder with memory model and knobs; explicit predictor, auto-predict off; volatile/`predict()`/W1C; interrupt monitor; address-keyed memory-image scoreboard; passive SoC reuse. |
| G29-UVM-05 | S2 | **Resolved.** Messages print when issued; BDTYP warning + null; missing macro is a compile error; INVTST fatal; failed `get()` returns 0. |
| G29-UVM-07 | S2 | **Resolved.** All sources replaced by verified clauses or labelled uvm-core files; "debug guide" gone; `uvm_tlm_fifo` cited as §12.2.8.2 per the verifier's caution. |
| G29-UVM-14 | S2 | **Resolved.** 20 new questions covering RAL, callbacks, reporting, object vs component, active/passive, handshake, TLM FIFOs, field macros vs `do_*`, lock/grab, end of test, phase order, scoreboards and performance. |
| Navigation S2 | S2 | Lead-side and done: `/interview-prep` renders the bank; `modules` gives "Learn it in" links. |
| UVM-06/V01/V02 (S3) and UVM-08–13 | S3/S4 | Addressed as the author log describes (checked in the bank text). |

## Coverage gaps assigned to `uvm`

Filled: object vs component; hierarchy and active/passive; phase order; reporting (catcher in `uvm-mid-test-reset`); handshake and responses; TLM 1 ports/exports/imps, FIFOs, `uvm_analysis_imp_decl`; field macros vs `do_*`; arbitration/lock/grab; RAL core; callbacks vs factory; scoreboards; end of test; phase jumping and domains; performance; VIP; UVM-ML/pyuvm/cocotb; and the verifier's additions (I-SV-9, I-UVM-5 with `uvm_event`/`uvm_barrier`, `uvm_heartbeat` as follow-up, command-line overrides, the derived-class TYPDUP trap).

Not filled: layered sequences (finding 1); spine module I-UVM-3C and the `tb_top`/`run_test()` handoff (finding 2); parts of the RAL and TLM 1 rows, sequence libraries, recording and TLM 2 (findings 4–7).

## Findings

| # | Sev | Question id | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S3 | (bank); `uvm-virtual-sequencer` | Gap row "Layered sequences and protocol layering (senior, uvm)" is unfilled. The author log says "Follow-up only", but no follow-up, answer or `modules` entry mentions layering (grep: no "layered seq", "translat", "upper layer"; no question in any bank maps `I-UVM-3B_.../layered-sequences`). Protocol layering is an I-UVM-3B must-cover. | Add a senior coding or verification-plan question ("Layer a packet protocol over a byte-stream agent"): upper sequencer, translation sequence on the lower sequencer pulling upper items through a `seq_item_pull_port`, response/ID routing upward, monitor-side reassembly. Map to `I-UVM-3B_Advanced_Sequencing_and_Layering/layered-sequences`. Minimum: a layering follow-up on `uvm-virtual-sequencer` with that module ref. Correct the author log line. | G29.md Coverage gaps; spine I-UVM-3B card (must-cover "protocol layering"); grep of all banks; lesson file exists |
| 2 | S3 | (bank) | Spine module I-UVM-3C (`content/curriculum/T2_Intermediate/I-UVM-3C_First_Complete_Testbench/index.mdx`) has no question in any bank. The commonest junior UVM question, how the virtual interface reaches the driver (top module `uvm_config_db` set, `run_test()`, null-vif fatal), is not asked: `run_test` has 0 hits in `uvm.json`. The I-UVM-3C misconceptions (vif set by hierarchical reference from the test; zero-transaction scoreboard counted as a pass) and I-UVM-1D misconception 4 (`run_test("x")` wins over `+UVM_TESTNAME`) are untested. | Add a junior question: "Walk through `tb_top` from clock/reset to `run_test()`; how does the driver get its vif?" Put a short `tb_top` plus agent `build_phase` in `code`. Answer: `set(null, "uvm_test_top.*", "vif", vif)` scope, checked `get` with `uvm_fatal`, `+UVM_TESTNAME` beats the `run_test()` argument (F.7.3.1 steps d/e; G.2.1), INVTST for an unknown name, and the four I-UVM-3C bring-up failures. Map to `I-UVM-3C_First_Complete_Testbench/index`, `I-UVM-2C_Configuration_and_Resources/index`, `I-UVM-1D_Reporting_and_Run_Control/index`. | Spine I-UVM-3C and I-UVM-1D cards; 1800.2 F.7.3.1, G.2.1 (read in `uvm_lrm.txt`); grep of all banks |
| 3 | S3 | `uvm-driver-sequencer-handshake` | The forgotten-`item_done()` symptom omits the most visible clue. In uvm-core, the second `get_next_item()` logs the "called twice" error and then still calls `m_safe_select_item`, which `peek`s the request FIFO, so the same item comes back: the driver re-drives one transaction every loop iteration, one error per iteration, and the DUT sees duplicates. The rubric rewards only "stuck `finish_item` plus the error". | In the "Forgetting `item_done()`" paragraph add: "the next `get_next_item()` returns the same item again, so the driver re-drives it forever and logs the error each time; time advances, so the run ends at PH_TIMEOUT unless `+UVM_MAX_QUIT_COUNT` stops it first" (label as uvm-core). Add "re-drives the same item" to the rubric. | uvm-core 2020.3.1 `seq/uvm_sequencer.svh:218-232`; `seq/uvm_sequencer_param_base.svh:508-549` (`m_req_fifo.peek(t)`) |
| 4 | S4 | `uvm-ral-mirror-prediction`, `uvm-tlm1-ports-exports-imps` | Parts of two assigned gap rows are missing. (a) RAL row "built-in sequences": no mention of `uvm_reg_hw_reset_seq`, `uvm_reg_bit_bash_seq` or the `NO_REG_TESTS` resource. (b) TLM 1 row "blocking vs non-blocking": `try_put`/`can_put`/`try_get` and the blocking/nonblocking port variants never appear. | (a) RAL follow-up: "Which built-in register sequences run first on a new block, and how do you exclude a register with side effects?" (E.1, E.2.2, `NO_REG_TESTS`/`NO_REG_HW_RESET_TEST` in `REG::`). (b) One paragraph or follow-up in the TLM 1 item: `try_put` (§12.2.4.2.4) is a function returning a status bit at once, `put` is a task; the port variant decides which methods exist. | G29.md Coverage gaps (RAL, TLM 1 rows); 1800.2 E.1, E.2.2, §12.2.4.2.4 (read in `uvm_lrm.txt`) |
| 5 | S4 | `uvm-performance-hotspots` (I-UVM-6) | I-UVM-6 is linked only as a cost to switch off. No item asks what transaction recording is or how to enable it (`begin_tr`/`end_tr`, `uvm_tr_database`, `uvm_tr_stream`, `recording_detail`), and the I-UVM-6 misconception "recording is on by default" is untested. The verifier listed I-UVM-6 among modules needing a question. | Add a follow-up to `uvm-performance-hotspots` or the hang item: "How would you record driver transactions as streams for the waveform viewer, and what turns it on?" citing §5.4.2.4, §7.1, §7.2, with the uvm-core default (`recording_detail` UVM_NONE) labelled. | G29.verify.md completeness gap 1; spine I-UVM-6 card; 1800.2 §5.4.2.4, §7.1, §7.2 |
| 6 | S4 | `uvm-multi-language-strategy`, `uvm-tlm1-ports-exports-imps` (TLM 2) | TLM 2 sockets and the generic payload appear only at the language boundary; no item lets a candidate explain what TLM 2 adds over TLM 1. Deferral is reasonable at 30 items. | Follow-up on `uvm-tlm1-ports-exports-imps`: "What does UVM TLM 2 add over TLM 1, and when would an SV bench use it?" (generic payload §12.3.4.2, sockets §12.3.5, `b_transport`/`nb_transport` with timing annotation, typically at a SystemC boundary). | G29.verify.md completeness gap 3; 1800.2 §12.3.4.2, §12.3.5 |
| 7 | S4 | `uvm-sequence-arbitration-lock-grab` | `uvm_sequence_library` and its selection modes (an I-UVM-3B must-cover, §14.4) appear nowhere in the bank. | Add a follow-up: "When would you use a `uvm_sequence_library`, and what do its selection modes do?" with module ref `I-UVM-3B_.../sequence-libraries`. | Spine I-UVM-3B card; 1800.2 §14.4 (read in `uvm_lrm.txt`) |
| 8 | S4 | `uvm-staff-debug-hanging-sim`, `uvm-reporting-verbosity`, `uvm-phase-concurrency-trap` | Three items are really debug or predict-the-output items, but `VALID_CATEGORIES` in the schema test lacks `debug` and `predict-output` (author request 2). Also, `AnalysisBroadcastVisualizer` is not linked from `uvm-tlm-analysis-port` because the schema has no visual field (author request 3; verify note). | No author action now. When the lead adds the categories and a `visual` field, recategorize these three and link the visualizer. | `tests/interview-questions/bank-schema.test.ts`; author log requests 2–3; G29.verify.md visuals note |
| 9 | S4 | (lead request 5) | The proposed known-wrong-phrase lint ("receives a copy", "safety net", "sub-phases") would flag this bank's own corrections in `common_mistakes` and rubrics. | Scope the lint to `model_answer` and the strong-answer part of `rubric`, or match only un-negated phrasing. | grep of `uvm.json` |

## Notes for the author (round 2)

- Findings 1–3 are the only ones that need bank edits for this lens; 4–7 are optional follow-up additions. No test caps the question count.
- Keep `uvm-factory-purpose` and its first module unchanged.
- Correct the author log's "Layered sequences: Follow-up only" line.
