# G29-B-SVA completeness review, round 1: `sva-formal.json`

Reviewer: completeness and usefulness lens. Date: 2026-10-18. Read-only except for this file.

This file replaces an earlier round-1 completeness note dated 2026-10-11. That note was written before the author's "Fix round 1" (author log, 2026-10-11 18:42). This review is of the bank as it stands now, after that fix round. Each finding the earlier note raised is re-checked below; the ones still open are carried forward with their current status.

**Inputs read:**
- `docs/curriculum-quality/README.md`.
- `analysis/G29.md`: the `sva-formal.json` section, "## Coverage gaps" (the sva-formal rows) and "## Requests for the lead".
- `analysis/G29.verify.md`: G29-SVA-01 and G29-SVA-V01, completeness gaps 4 and 7, and "## Notes for the implementation author".
- `curriculum-spine.md`: the I-SV-4A, I-SV-4B, I-SV-4C and E-INT-1 cards.
- `reviews/G29-B-SVA.author.md` (including Fix round 1) and `reviews/G29-B-SVA.accuracy.r1.md`.
- All 20 questions in `content/interview-questions/sva-formal.json`, and `git diff HEAD` for that file.

**LRM spot checks** (IEEE 1800-2023, `sources/t1_lrm_clean.txt`): §16.12.2, §16.12.3 (the `not (a ##1 b)` example, "the assertion a1 will fail"), §16.12.12, §16.12.14, §16.12.21, §16.16.

## Verdict

**Pass. No S1 or S2 remains.** Open findings: 0 S1, 0 S2, 3 S3, 7 S4.

## Checks run

| Check | Result |
|---|---|
| JSON parses (`python3 json.load`) | OK |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts tests/lib/practice-links.test.ts` | 5 files, 1059 tests passed |
| Every `modules` entry resolves to `content/curriculum/*/<module>/<page>.mdx` | All refs across the 20 questions resolve (glob check). Every SVA lesson page is targeted at least once: I-SV-4A index and immediate-vs-concurrent; I-SV-4B index, local-variables and multi-clocking; I-SV-4C index; E-INT-1 index. |
| Levels | junior 3, mid 9, senior 6, staff 1, senior-staff 1. That meets the minimum of 3 junior and spans junior to senior staff. |
| Coding and waveform items carry code or a cycle table | Coding: `sva-repetition-operators`, `sva-axi-handshake-properties`, `sva-bind-and-checkers`, `sva-interval-operators` and `sva-local-variables-data-integrity` all have reference code in `model_answer`; repetition and interval also have traces. Waveform-debug: `sva-disable-iff-reset`, `sva-goto-vs-nonconsecutive` and `sva-multiclock-clock-flow` have a cycle table in `code`. Trick items carry code or a table. |
| `follow_ups` and `common_mistakes` | Every question has at least 4 of each (multiclock has 5 and 5; deferred-glitch has 5 common mistakes). They are specific and probe the next level. |
| Rubrics separate strong from weak answers | 13 of 20 name a weak or incomplete answer. The other 7 use "Must" and "Strong" tiers but never describe a weak answer (finding 6). |
| Tool behaviour labelled | Vacuity and witness reports, pending-attempt reporting, induction engines, cut points and formal coverage are all labelled tool-dependent. The tool entries in `sources` are marked `verified: false`. |

## S1/S2 resolution (G29.md and G29.verify.md)

| ID | Sev | Status |
|---|---|---|
| G29-SVA-01 | S1 | **Resolved.** The answer is now `$rose(req) \|=> (!ack)[*0:3] ##1 ack[*2] ##1 !ack`. Its trace shows a 2-cycle pulse passing at 3, a 1-cycle pulse failing at 2, a 3-cycle pulse failing at 3 and a late rise failing at 4. The answer explains why the `##[1:4]` version passes a 3-cycle pulse, and gives the `\|-> !ack ##1 ...` variant from the verify notes. |
| G29-SVA-V01 | S1 | **Resolved.** The rubric names the exact-length reference property. It marks both `##[1:4] ack[*2]` and `##[1:4] (ack[*2] ##1 !ack)` as incomplete, with the reason. |
| G29-SVA-07 | S2 | **Resolved.** 14 new questions (6 → 20). Each sva-formal gap row has at least one question (see the next section). |
| Navigation S2 (banks unreachable) | S2 | Lead-side and outside this bank. `/interview-prep` renders the bank, and `modules` takes precedence in `getInterviewQuestionLessons`. |
| SVA-02 to SVA-06 (S3/S4) | — | All addressed: the §16.12.7 and §16.14.8 citations, deferred forms plus the `$sampled` tip, the formal sanity kit, the staff technique layer with liveness labelled a design requirement, and `$past` in `sva-past-sampling`. |
| Verify gap 4 | — | Closed. Deferred assertions and assertion control each have their own question. The `assert(obj.randomize())` trap is now in `systemverilog.json`, citing §20.11. |
| Accuracy r1 #1 (S2, interval precedence follow-up) | S2 | **Resolved** in fix round 1. The follow-up and a model-answer bullet now give the correct Table 16-3 precedence. |

## Coverage gaps assigned to `sva-formal` (G29.md "Coverage gaps")

| Gap row | Filled by | Status |
|---|---|---|
| Sampled-value functions | `sva-sampled-value-functions` | Filled |
| `disable iff` and reset | `sva-disable-iff-reset` | Filled |
| Goto and nonconsecutive repetition; throughout, within, intersect, first_match | `sva-goto-vs-nonconsecutive`, `sva-interval-operators` | Filled |
| Local variables | `sva-local-variables-data-integrity` | Filled |
| Strong vs weak, `s_eventually`, until/`s_until`, liveness in simulation vs formal | `sva-strong-weak-liveness` | Partly filled: until/`s_until` appear only in an unanswered follow-up (finding 1) |
| Multi-clock assertions and clock inference | `sva-multiclock-clock-flow` | Clock flow is filled. Clock resolution and inference (§16.16) are not explained (finding 7). |
| `bind`, checkers, packaging in VIP | `sva-bind-and-checkers`, `sva-assertion-control` | Filled |
| `cover property` vs covergroup | `sva-cover-property-vs-covergroup` | Filled |
| Formal methodology (cut points, black-boxing, abstraction, k-induction, proof depth, formal coverage) | `sva-staff-formal-strategy`, `sva-formal-convergence-signoff`, `sva-formal-overconstraint` | Filled |
| AXI handshake SVA as a write-the-property item | `sva-axi-handshake-properties` | Filled |
| Verify gap 4: deferred assertions, assertion control | `sva-deferred-assertions-glitch`, `sva-assertion-control` | Filled |

**Spine misconceptions:**
- **I-SV-4A:** all 4 are targeted.
- **I-SV-4B:** all 4 are targeted. The `##0` misconception is targeted through common mistakes.
- **I-SV-4C:** all 3 are targeted.
- **E-INT-1:** misconception 2 is targeted. Misconception 1 is now partly targeted, by `sva-formal-overconstraint` follow-up 1 (which has an answer). Misconception 3 is not targeted (finding 2).

## Findings

| # | Sev | Question id | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S3 | sva-strong-weak-liveness | The gap row lists until/`s_until`, and the I-SV-4B objective names `not`, `until`/`s_until` and `always`. The model answer covers weak and strong sequences, `s_eventually` and `strong()`. But follow-ups 1 (`not (a ##1 b)` when the clock stops) and 2 (`until` vs `s_until` at end of run) have no answer anywhere in the item, although the item cites §16.12.3 and §16.12.12. A learner who studies the answer cannot answer two of its own four follow-ups. *Still open from the earlier note.* | Add a short paragraph with answers. (1) `not` switches strength (§16.12.3). In an assertion `a ##1 b` is weak, so if the clock stops after `a` the weak sequence holds and `not (a ##1 b)` fails, which is the standard's own example; `not strong(a ##1 b)` avoids this. (2) `a until b` is weak: on a finite run where `b` never came it holds. `a s_until b` is strong: the same run leaves it pending (§16.12.12, §16.12.21). Or add the answers in parentheses, as other follow-ups do. | §16.12.3 text and its a1/a2 example; §16.12.12; §16.12.21 |
| 2 | S3 | (bank) sva-assert-assume-cover, sva-formal-overconstraint | The E-INT-1 card asks the learner to explain how assumptions relate to constraints without being equivalent, to diagnose under-constraint (spurious counterexamples), and to replay a counterexample in simulation. Its misconception 3 ("constraints and assumptions are interchangeable") is answered nowhere. Under-constraint, the mirror image of the well-covered over-constraint, appears in no model answer. *Partly improved since the earlier note:* overconstraint follow-up 1 now asks "design bug, missing assumption or incomplete assertion" and answers it. | Add an "assume vs constraint" paragraph to `sva-assert-assume-cover`. An assumption restricts the input traces formal considers; a UVM constraint restricts generated stimulus; neither implies the other. Or add one senior item (for example `sva-formal-cex-triage`) with a short counterexample cycle table that asks: design bug, missing assumption, or wrong property? Its answer would cover replaying the trace in simulation (the export format is tool-dependent) and checking each assumption as an assertion in the UVM regression. Map it to E-INT-1. | Spine E-INT-1 card (objectives 2–3, misconceptions 1 and 3); §16.14.2 |
| 3 | S3 | sva-formal-overconstraint | The answer finds both planted bugs but never gives the corrected harness for the second one. It does not say which assumption to delete, or how to write "reads follow writes" without forbidding writes. Follow-up 2 asks exactly that and is unanswered. "Here `cov_write` and `cov_full` are unreachable" is also incomplete. Under `asm_one_op` plus `asm_rd_with_wr`, `wr_en` can never be high, so `cov_wr_rd` (which needs `wr_en`) and `cov_refill` (which needs `full`) are unreachable too. A learner can read the sentence as saying those two covers are fine. *The earlier note's follow-up-1 part is fixed; this part is still open.* | Say that all four covers are unreachable. Add one or two sentences on the fix: delete `asm_rd_with_wr`, because `wr_en \|-> rd_en` is not "reads follow writes". If the environment really guarantees reads eventually follow writes, write it as a fairness or liveness assumption (for example `!empty \|-> s_eventually rd_en`) and discharge it on the consumer. | Harness in `code`; §16.14.2; §16.14.3; §16.15 |
| 4 | S4 | sva-disable-iff-reset | In the `code` cycle table, the `a_inc result` row has 3 entries for 5 edge columns, so edges 3 and 4 show nothing. In the model answer, step 4 says "Edge 2 onwards: attempts compare 1 with 0+1". The first passing comparison is at edge 3, for the attempt that started at edge 2. | Fill the row as `-  -  FAIL  pass  pass`. Change step 4 to "Edge 3 onwards". | Bank text; hand trace (`cnt` sampled 0, 0, 0, 1, 2) |
| 5 | S4 | sva-local-variables-data-integrity | The key insight, that `out_vld[->1]` pairs a byte with an older byte's output, is given only in prose. This is a predict-the-failure item, and the bank's other predict items all carry a cycle table. *Still open from the earlier note.* | Add a short table: `in_vld`, `in_data`, `out_vld`, `out_data`, sampled `in_cnt`/`out_cnt`, and the A and B attempt results under `p_data_one` and `p_data_in_order`. | Bank text |
| 6 | S4 | sva-disable-iff-reset, sva-axi-handshake-properties, sva-goto-vs-nonconsecutive, sva-formal-overconstraint, sva-local-variables-data-integrity, sva-strong-weak-liveness, sva-staff-formal-strategy | These rubrics have no "Weak answers ..." sentence. `sva-formal-overconstraint` is also an all-"Must" list with no strong tier. The other 13 rubrics let a grader place a weak answer on the scale. *Still open.* | Add one sentence to each, drawn from the item's first common mistake. Examples: "Weak answers say `disable iff` is sampled at the edge." "Weak answers treat `[->n]` and `[=n]` as the same." "Weak answers call a fast proof proven." "Weak answers call VALID→READY an AXI rule." | Bank text |
| 7 | S4 | sva-concurrent-vs-immediate (or sva-multiclock-clock-flow) | Clock resolution (§16.16) is an I-SV-4A must-cover item, and the assigned gap row says "clock inference". No answer explains how a concurrent assertion gets its clock: an explicit clock, a clocked sequence or property, inference from an `always` block, a clocking block, or `default clocking`, with an error if none applies. Three items use `default clocking` without explaining it. *Still open.* | Add two sentences, with the error case, to the procedural-assertion paragraph of `sva-concurrent-vs-immediate`. Or add an answered follow-up. | §16.16 "Clock resolution" (lists the five ways to specify a clock); §16.14.6 |
| 8 | S4 | sva-disable-iff-reset (or sva-strong-weak-liveness) | Abort properties (`accept_on`, `reject_on`, `sync_*`) are an I-SV-4B "awareness" must-cover item. They are the natural contrast with `disable iff`: an abort produces true or false, while a disable produces "disabled". No question mentions them. *Still open.* | Add an answered follow-up: "How does `reject_on (err)` differ from `disable iff (err)` in the result it reports? (`reject_on` turns the evaluation into a failure; `disable iff` makes it disabled, neither pass nor fail.)" | §16.12.14 (abort condition true → result true for accept, false for reject) |
| 9 | S4 | sva-local-variables-data-integrity, sva-multiclock-clock-flow, sva-disable-iff-reset | The module refs resolve but are weakly relevant. A-UVM-6 has no SVA content. F3C has no multiclock content; it fits only the coincident-edge NBA argument. `sva-disable-iff-reset` is single-clock but links `I-SV-4B/multi-clocking`, while the spine puts `disable iff` semantics in I-SV-4A, which the item also links. *Still open, and acceptable as related reading.* | Keep them if the intent is related reading, but list the most relevant lesson first. Otherwise drop A-UVM-6 from the local-variables item. | Spine I-SV-4A, I-SV-4B and A-UVM-6 cards |
| 10 | S4 | (bank) | All 3 junior items are `concept`. None asks a junior to predict outcomes on a trace, yet the I-SV-4A objective "predict, on a waveform, each attempt's start, its Preponed samples and its outcome" is junior core. `sva-sampled-value-functions` contains a trace but does not ask the candidate to predict it. *Still open; optional.* | Change the prompt of `sva-sampled-value-functions` to also ask for the property's result at each edge of a given trace, and move the trace into `code`. | Spine I-SV-4A objectives |

## Earlier-note findings now closed

- **Multiclock latency (earlier #1, S3):** fixed. `$rose(a) \|=> @(posedge dst_clk) ##[1:2] b` is given, with the source-hold assumption stated and a pulse-vs-level follow-up added.
- **Overconstraint follow-up 1 (part of earlier #2):** fixed. It names `asm_one_op` as the deleted assumption and answers the triage question. The rest of earlier #2 is carried forward as finding 3.
- **Deferred glitch at time 0 (earlier #6, S4):** fixed. There is a time-0 paragraph, a matching common mistake, and a §9.2.2.2.2 citation.

## Deferred items (agree with the author)

- **Rendered pictures** need the lead's `visual` schema field (G29-V gap 7). These are `SvaSequenceWaveformVisualizer`, `TemporalLogicExplorer` and a `<TimingDiagram>` for SVA-01. Text cycle tables are in place for every waveform item.
- **Recategorizing to `debug` and `predict-output`** needs `bank-schema.test.ts` widened. That is lead-side.
- **Compile check:** no simulator was available. `glitch_demo` and `fifo_props` plus its bind are the complete units.
- **Second staff-level item:** not required. The staff and senior-staff items together fill the formal-methodology gap row.
