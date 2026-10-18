# G29-B-SVA author log: `sva-formal.json`

Author: G29-B-SVA. Date: 2026-10-11. Verdict carried in: **major** (analysis G29, confirmed by G29-V).
File edited: `content/interview-questions/sva-formal.json` only. Bank `id`, `topic` and `title` unchanged; the description was widened to match the new scope.

**Result:** 6 → 20 questions. Levels: junior 3, mid 9, senior 6, staff 1, senior-staff 1. Categories: concept 6, coding 5, trick 4, waveform-debug 3, staff-system-design 2. Every question has `modules`, `follow_ups` (4 each) and `common_mistakes` (4 each). Every coding item contains code; every waveform-debug item carries a text cycle table in `code`.

**Sources.** Every IEEE 1800-2023 clause cited was checked in `scratchpad/audit/t1_lrm_clean.txt` (title and the specific statement the answer relies on). Arm IHI0022E sections were checked in `scratchpad/axiE.txt` (A3.1.2, A3.2.1, A3.3.1, A5.3.1; A3.4.1, A5.3.5, A5.4 also confirmed by the G29 analyst). Tool behaviour (end-of-test reporting of pending attempts, vacuity and witness reports, induction engines, cut points, formal coverage metrics) is labelled "tool-dependent" in the text and cited as `{doc, verified: false}`.

## Findings and resolution

| ID | Sev | Question | Finding (short) | Resolution |
|---|---|---|---|---|
| G29-SVA-01 | S1 | `sva-repetition-operators` | `##[1:4] (ack[*2] ##1 !ack)` passes 3- to 5-cycle pulses | Fixed. Answer is now `$rose(req) \|=> (!ack)[*0:3] ##1 ack[*2] ##1 !ack`, with a cycle table for 2-, 1-, 3-cycle and late pulses, a trace of why the old property passes a 3-cycle pulse, and the `\|-> !ack ##1 ...` variant for "ack low in the req cycle" (wording from the verify notes). Cites §16.9.2, §16.9.2.1, §16.12.7. |
| G29-SVA-V01 | S1 | `sva-repetition-operators` | Rubric rewarded `##[1:4] ack[*2]` | Fixed. Rubric names the exact-length property as reference and marks both `##[1:4] ack[*2]` and `##[1:4] (ack[*2] ##1 !ack)` as incomplete, with the reason. |
| G29-SVA-02 | S3 | `sva-implication-operators`, `sva-past-sampling` | §16.12.6 cited for implication; LRM equivalence misstated; §16.5.1 not cited | Fixed. Implication cites §16.12.7, vacuity §16.14.8; equivalence stated as `s \|=> p` ≡ `s ##1 1'b1 \|-> p` (the standard spells the constant as a `true` macro; written this way because the page's inline-code renderer cannot nest backticks), and `\|-> ##1 q` noted as equivalent only for a sequence consequent. `sva-past-sampling` now cites §16.5.1 and §16.9.3. |
| G29-SVA-03 | S3 | `sva-concurrent-vs-immediate` | Omitted deferred assertions and Reactive action blocks; generic "§16" source | Fixed. Answer covers simple, deferred (`#0`, `final`, flush points) and concurrent assertions, the Reactive-region action block and `$sampled` (the §16.9.3 `a1_bad`/`a2_ok` example). Cites §16.3, §16.4, §16.4.1, §16.4.2, §16.5, §16.5.1, §16.9.3, §16.14.5, §16.14.6. |
| G29-SVA-04 | S3 | `sva-formal-overconstraint` | Only "over-constrained assumptions"; "§16.14 (assume)"; waveform-debug with no waveform | Fixed. Rewritten as a `trick` item with a harness in `code` that plants two causes (inverted `default disable iff`, contradictory assumptions). Answer lists all causes (over-constraint, stuck disable, clock/reset setup, unreachable antecedent, genuinely easy proof) and the sanity kit (reached covers, assumption removal, replay assumptions in simulation, tool reports labelled tool-dependent). Cites §16.14.2, §16.14.3, §16.14.8, §16.12, §16.15. Category changed from `waveform-debug` to `trick` because a proof result has no waveform (see lead request 1). |
| G29-SVA-05 | S3 | `sva-staff-formal-strategy` | Missing formal-technique layer; liveness presented as an AXI rule | Fixed. Added assume-guarantee structure, symbolic tracked transaction (constant free checker variable, §17.7), abstraction, helper invariants and k-induction, `restrict` case splits, bounded-then-full CI, sign-off covers, and same-ID reads to different slaves (A5.3.1). "Every VALID eventually gets READY" is labelled a design requirement (A3.3.1 lets a receiver wait for VALID and sets no time limit). |
| G29-SVA-06 | S4 | `sva-past-sampling` | Id says "past" but no `$past` | Fixed without renaming (the id is mapped in `INTERVIEW_QUESTION_LESSONS`): the prompt now asks what `$rose(req)` and `$past(req)` return at the passing edge, with a cycle table. |
| G29-SVA-07 | S2 | (bank) | 6 questions; gaps in sampled-value functions, disable iff, local variables, interval operators, goto/nonconsecutive, strong/weak and liveness, multiclock, bind and checkers, cover vs covergroup, SVA debug, formal methodology | Fixed. 14 new questions, one or more per gap row (see map). |
| Verify gap 4 | — | (bank) | Deferred assertions need their own question; assertion control missing | Fixed: `sva-deferred-assertions-glitch`, `sva-assertion-control`. |
| Verify gap 4 | — | (bank) | `assert(obj.randomize())` trap belongs in SVA or debug list | Deferred (see below). |
| Verify gap 7 | — | `sva-repetition-operators` | `<TimingDiagram>` for 1/2/3-cycle ack pulses | Partly: a text cycle table is in the answer. A rendered picture needs a schema field (lead request 2). |
| Analysis R8 | — | (bank) | Citations unreliable / generic | Fixed: every source is a verified clause, an IHI0022E section, or a labelled `verified: false` tool reference. No "§16 (assertions)" or "(secondary)" sources remain. |

## Question map

All 1800-2023 and IHI0022E citations below were verified by me in the source text; "(tool)" entries are `verified: false`.

| id | level | category | modules | sources |
|---|---|---|---|---|
| `sva-concurrent-vs-immediate` (kept) | junior | concept | I-SV-4A/immediate-vs-concurrent, I-SV-4A/index, F3B/index | §16.3, §16.4, §16.4.1, §16.4.2, §16.5, §16.5.1, §16.9.3, §16.14.5, §16.14.6 |
| `sva-sampled-value-functions` (new) | junior | concept | I-SV-4A/index | §16.9.3, §16.5.1, §16.12.7, §20.12 |
| `sva-assert-assume-cover` (new) | junior | concept | I-SV-4A/index, E-INT-1/index | §16.14.1, §16.14.2, §16.14.3, §16.14.4 |
| `sva-implication-operators` (kept) | mid | concept | I-SV-4A/index | §16.12.7, §16.12.9, §16.14.3, §16.14.8, §20.11 |
| `sva-repetition-operators` (kept) | mid | coding | I-SV-4B/index, I-SV-4A/index | §16.9.2, §16.9.2.1, §16.12.7, §16.9.3, §16.12.2 |
| `sva-deferred-assertions-glitch` (new) | mid | trick | I-SV-4A/immediate-vs-concurrent, F3B/index, F3C/index | §16.3, §16.4, §16.4.1, §16.4.2, §4.4.2.6 |
| `sva-disable-iff-reset` (new) | mid | waveform-debug | I-SV-4A/index, I-SV-4B/multi-clocking | §16.12, §16.5, §16.5.1, §16.9.3, §16.14.1, §16.15 |
| `sva-axi-handshake-properties` (new) | mid | coding | B-AXI-1/index, I-SV-4A/index | IHI0022E A3.2.1, A3.1.2, A3.3.1; §16.9.3, §16.12.7, §20.9 |
| `sva-goto-vs-nonconsecutive` (new) | mid | waveform-debug | I-SV-4B/index | §16.9.2, §16.9.2.1, §16.12.2, §16.12.7 |
| `sva-cover-property-vs-covergroup` (new) | mid | concept | I-SV-4A/index, I-SV-4B/index, I-SV-3A/index | §16.14.3, §16.12.9, §16.10, §16.11, §19.3, §19.8, §19.8.1 |
| `sva-bind-and-checkers` (new) | mid | coding | I-SV-4C/index | §23.11, §17.2, §17.3, §17.7, §16.15 |
| `sva-assertion-control` (new) | mid | concept | I-SV-4A/index, A-UVM-7/index, I-SV-4C/index | §20.11, §21.7.1.2, §16.12, §16.4.1 |
| `sva-past-sampling` (kept) | senior | trick | I-SV-4A/index, F3B/index | §16.5.1, §16.9.3, §16.12.7 |
| `sva-formal-overconstraint` (kept) | senior | trick (was waveform-debug) | E-INT-1/index, I-SV-4C/index | §16.14.2, §16.14.3, §16.14.8, §16.12, §16.15; tool |
| `sva-interval-operators` (new) | senior | coding | I-SV-4B/index | §16.9.2, §16.9.5, §16.9.6, §16.9.8, §16.9.9, §16.9.10, §16.12.2, §16.12.7 |
| `sva-local-variables-data-integrity` (new) | senior | coding | I-SV-4B/local-variables, A-UVM-6/index | §16.10, §16.9.2, §16.7, §16.12.7 |
| `sva-strong-weak-liveness` (new) | senior | trick | I-SV-4B/index, E-INT-1/index | §16.12.2, §16.12.3, §16.12.12, §16.12.13, §16.12.15, §16.12.21; tool |
| `sva-multiclock-clock-flow` (new) | senior | waveform-debug | I-SV-4B/multi-clocking, F3C/index | §16.13.1, §16.13.2, §16.13.3, §16.12.2, §16.9.3, §16.12 |
| `sva-staff-formal-strategy` (kept) | staff | staff-system-design | E-INT-1/index, B-AXI-1/index, B-AXI-3/index, B-AXI-5/index | IHI0022E A3.2.1, A3.3.1, A3.4.1, A5.3.1, A5.3.5, A5.4; §16.12.13, §16.14.2, §16.14.4, §17.7; tool |
| `sva-formal-convergence-signoff` (new) | senior-staff | staff-system-design | E-INT-1/index, I-SV-4C/index | §16.14.2, §16.14.3, §16.14.4, §16.14.8, §17.7; tool |

Module refs use full folder names in the JSON (for example `I-SV-4A_SVA_Fundamentals/immediate-vs-concurrent`); the table abbreviates them. All refs resolve (checked by `tests/app/interview-prep-banks.test.ts`, "resolves every modules entry").

Key semantic points checked against the LRM text while writing (so reviewers can spot-check): the disable condition uses current values and disabled evaluations run no action (§16.12, §16.14.1); `$sampled` in a disable condition is "meaningful" (§16.9.3); `$rose`/`$fell` use the LSB and compare with the default sampled value at the first tick (§16.9.3, §16.5.1); `$assertoff` does not affect attempts already executing, `$assertkill` aborts them and flushes deferred reports, action-control tasks do not change statistics counters, `levels` follows `$dumpvars` where 0 means the scope and everything below (§20.11, §21.7.1.2); pass actions run on vacuous success unless VacuousOff (§20.11); `cover property` counts at most one success per attempt and reports vacuous successes separately, `cover sequence` counts all matches (§16.14.3); weak/strong defaults and `weak(seq)` ≡ `weak(first_match(seq))` (§16.12.2); the four finite-run outcomes (§16.12.21); multiclock `##1`/`|=>` strictly after vs `##0`/`|->` at-or-after, and the nonempty-match rule (§16.13.1, §16.13.2); bind actuals resolve in the target scope and `$unit` is not visible (§23.11); checker contents and the ban on module/interface/program instances (§17.2); constant free variables (`rand const`, §17.7).

Code was hand-traced against the LRM rules; no simulator or formal tool was run (none available in this session).

## Ids removed or renamed

None. All six original ids survive: `sva-concurrent-vs-immediate`, `sva-implication-operators`, `sva-past-sampling`, `sva-formal-overconstraint`, `sva-repetition-operators`, `sva-staff-formal-strategy`.

New ids (14): `sva-sampled-value-functions`, `sva-assert-assume-cover`, `sva-deferred-assertions-glitch`, `sva-disable-iff-reset`, `sva-axi-handshake-properties`, `sva-goto-vs-nonconsecutive`, `sva-cover-property-vs-covergroup`, `sva-bind-and-checkers`, `sva-assertion-control`, `sva-interval-operators`, `sva-local-variables-data-integrity`, `sva-strong-weak-liveness`, `sva-multiclock-clock-flow`, `sva-formal-convergence-signoff`.

## Deferred

| Item | Reason |
|---|---|
| `assert(obj.randomize())` trap (verify gap 4, SV-12) | It is a randomization/debug trap rather than an SVA concept, and I did not verify an LRM statement on whether a disabled immediate assertion evaluates its expression. Better owned by the `systemverilog.json` or `debug.json` author with a verified clause. |
| Rendered pictures (verify gap 7: `<TimingDiagram>` for SVA-01, `SvaSequenceWaveformVisualizer` links) | The bank schema has no `visual`/`diagram` field. Text cycle tables are in place for every waveform item. See lead request 2. |
| Compile check of code blocks | No simulator in this session. All code is short, hand-traced, and marked `// snippet` where it is a fragment. See lead request 3. |
| Second staff-level item ("assertion IP architecture across block sim, formal, SoC sim and emulation") | Bank already reaches 20 items; VIP packaging is covered in `sva-bind-and-checkers` and `sva-assertion-control`, and reuse across engines in the two staff items. Can be added if the lead wants two items per level. |

## Requests for the lead

1. **Categories.** The page already labels `debug` and `predict-output`, but `tests/interview-questions/bank-schema.test.ts` allows only the six original categories. If the test is widened, recategorize: `sva-formal-overconstraint` → `debug`; `sva-deferred-assertions-glitch`, `sva-goto-vs-nonconsecutive`, `sva-past-sampling` → `predict-output`. I kept them as `trick`/`waveform-debug` so the current test passes.
2. **Visual field.** Add an optional `visual: {component, props}` (verify gap 7) so `sva-repetition-operators` and `sva-goto-vs-nonconsecutive` can open `SvaSequenceWaveformVisualizer`/`TemporalLogicExplorer`, and `sva-multiclock-clock-flow` the multiclock picture in I-SV-4B/multi-clocking. Check each visualizer's model against the corrected answers before linking.
3. **Compile gate.** If the lead's pipeline compile-checks bank `code`, the complete units here are `sva-deferred-assertions-glitch` (module `glitch_demo`) and `sva-formal-overconstraint` (module `fifo_props`, needs a `fifo` with matching port names for the `bind ... (.*)`); the rest are snippets.
4. **Practice map.** `INTERVIEW_QUESTION_LESSONS` entries for the six kept ids are now shadowed by each question's `modules` (which take precedence in `getInterviewQuestionLessons`). Consider syncing or removing them so there is one source; if the reverse lookup (lesson → questions) reads only the map, add the 14 new ids or make it read `modules`.
5. **Lesson cross-links.** I-SV-4A, I-SV-4B (index, local-variables, multi-clocking), I-SV-4C and E-INT-1 have "Interview angles" sections; they could link to the matching `/interview-prep#q-<id>` anchors (owned by those lessons' groups).

## Validation

- `python3 -c "import json;json.load(open('content/interview-questions/sva-formal.json'))"`: OK.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, 478 tests passed.
- Extra local check: every prompt, rubric, answer and list item has balanced inline backticks and closed fences (so `RichText` renders them), every coding item contains code, every waveform-debug item has a cycle table.

## Fix round 1

All 11 findings resolved (1 S2, 2 S3, 8 S4). No ids removed or renamed; the bank still has 20 questions. Clause numbers added in this round were checked against the IEEE 1800-2023 text.

| Sev | Question | Finding | Fix |
|---|---|---|---|
| S2 | `sva-interval-operators` | Follow-up 1 claimed `lock throughout beat[->4] ##0 last` without parentheses means something different. | Follow-up rewritten. `##` binds tighter than `throughout`, so the parse is already `lock throughout (beat[->4] ##0 last)`. `throughout` binds tighter than `intersect`, so dropping the outer pair regroups to `(lock throughout ...) intersect ...`. That still matches the same intervals, but with `and`/`within` the grouping changes the meaning. Added a precedence bullet to the model answer and cited Table 16-3 in §16.12 (verified: the table sits in §16.12 and orders `[*]` > `##` > `throughout` > `within` > `intersect` > `and` > `or`). |
| S3 | `sva-multiclock-clock-flow` | "Use `\|=>`" alone checks the first flop, and "sampled at T" was mixed up with "launched at T". | Prompt now asks for the clock switch **and** the latency. Answer gives `$rose(a) \|=> @(posedge dst_clk) ##[1:2] b` for the second flop's output, with the source-hold assumption stated. Reason reworded: a coincident destination flop captures the value sampled at T, and the assertion sees it strictly after T. Each flop adds a tick, and clock alignment adds up to one more. Also explains why `\|->` shifts the window only on coincident edges and why `p1` as written sees at best the first flop. Rubric updated. Added a follow-up (pulse vs level) and a common mistake. Added §16.5.1 to sources. Hand-traced for coincident and non-coincident alignment. |
| S3 | `sva-formal-overconstraint` | Follow-up 1's counterexample (`wr_en && rd_en`) is impossible while `asm_one_op` stays. | Follow-up now says which assumption is deleted (`asm_one_op`) and that the reads-follow-writes rule is corrected. The question gives three choices (design bug / missing assumption / incomplete assertion) and adds the expected reasoning (`ast_count` must exclude simultaneous read and write if that is legal). |
| S4 | `sva-interval-operators` | `##0` cited to §16.9.2. | Now goto repetition §16.9.2 and `##0` §16.7 (verified: "The delay ##0 indicates that the beginning of the sequence that follows is at the same clock tick"). §16.7 added to sources. Rubric wording "fusion" replaced with what `##0` does. |
| S4 | `sva-sampled-value-functions` | `$stable(data)` = 0 at edge 2 with `data` = `-` at edge 1. | `data` row is now concrete (`0 A A A B`), and `$stable` is filled for every edge. While fixing it I found that `$fell(valid)` at edge 1 was wrong: x to 0 at the first tick counts as a fall (§16.9.3 compares with the default sampled value). It now reads 1, and the text says so. |
| S4 | `sva-concurrent-vs-immediate`, `sva-sampled-value-functions` | "default sampled value 1'bx for logic" without a qualifier. | Qualified per §16.5.1: a static variable's default sampled value is its declaration initializer; `1'bx` applies to a `logic` with no initializer. Updated in the answer, rubric and follow-up. |
| S4 | `sva-deferred-assertions-glitch` | Argument capture stated for all arguments. | Now: by-value arguments are evaluated when the assertion expression is evaluated. `ref`/`const ref` arguments read current values in Reactive (`#0`) or Postponed (`final`). Verified in §16.4. |
| S4 | `sva-deferred-assertions-glitch` | `a_simple` can also print at time 0. | Added a time-0 paragraph: `always_comb` runs at time 0 (§9.2.2.2.2), `valid_n` may still be `x`, `x != 0` is `x`, and an immediate assertion treats `x` as false (§16.3). The deferred reports are flushed. Added a common mistake and §9.2.2.2.2 to sources. The code is unchanged, so the time-10 trick still reads cleanly. |
| S4 | `sva-formal-convergence-signoff` | Bounded depth is stated as universal. | Now "when a bounded engine ran on it (tool-dependent)". Without a bounded result there is no depth claim. |
| S4 | `sva-axi-handshake-properties` | "Name the bundle so the message says which field moved." | Replaced: a concatenated `$stable` cannot identify the field. Use one `$stable` per field, or print each field's `$past`/`$sampled`. |
| S4 | `sva-disable-iff-reset` | §16.15 cited for checkers. | Now §16.15 for module/interface (program and generate blocks are also covered there) and §17.2 for a checker body (verified: §17.2 lists "default clocking and default disable iff declarations" among checker body items). §17.2 added to sources. |

### Validation (fix round 1)

- `python3 -c "import json;json.load(open('content/interview-questions/sva-formal.json'))"`: OK.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, 863 tests passed.
- Local check: inline backticks balanced and fences closed in every rendered field of all 20 questions.

## Fix round 1 (re-run review, 2026-10-18)

This answers `G29-B-SVA.accuracy.r1.md` dated 2026-10-18, which replaced the earlier round-1 pass above. It found 1 S2, 1 S3 and 3 S4. All 5 are resolved. No ids were removed or renamed, and the bank still has 20 questions. Only `content/interview-questions/sva-formal.json` was edited. No new clause numbers were added. The wording changes rest on the §16.13.1, §16.13.2, §16.9.2, §16.12.15 and §16.12.21 text, which I re-read in `sources/t1_lrm_clean.txt`, and on IHI0022E A3.2.1 and the AW signal table in `sources/arm_axi.txt`.

| Sev | Question | Finding | Fix |
|---|---|---|---|
| S2 | `sva-multiclock-clock-flow` | The answer said `\|->` is off by one tick on coincident edges. It is the other way round: `\|->` gives the exact window, and `\|=>` leaves a tick of slack. | Rewrote the synchronizer part of the answer. Let L be the first destination tick at or after T. The source launched `a` before T and holds it through L, so the first flop has captured it by L at the latest, and `b` is sampled high by L + 2 in every alignment. `a_sync` now uses `\|-> @(posedge dst_clk) ##[1:2] b`, which is the exact bound. A new `a_sync_loose` uses `\|=>`. It also passes a correct design, but on coincident edges it lands at L + 1, so a three-flop synchronizer would pass there too. The answer recommends `\|->` when the latency bound matters, or `\|=>` with the slack stated. The "a clock-period change flips the result" claim is gone. Kept the true part: with no extra delay, only `\|=>` sees a capture made on a coincident edge, and `p1` at best sees the first flop. The rubric now accepts both operators when the window is justified and states the slack. Added a common mistake ("`\|=>` + `##[1:2]` is not exact"). The prompt says "would you use" instead of "should". |
| S3 | `sva-goto-vs-nonconsecutive` | "If `done` never arrives, `a_noncon` never fails" holds only while `beat` stays low. | Answer: "if `done` never arrives **and `beat` stays low** ... A fourth `beat` that arrives before `done` still fails the attempt at that tick, because a `[=3]` match can extend only over ticks where `beat` is false (§16.9.2)." Made the same change in the rubric and the matching common mistake. |
| S4 | `sva-formal-overconstraint` | It said only `cov_write` and `cov_full` are unreachable, and that "nothing is checked". | Answer: with the reset polarity fixed, all four covers are unreachable, with the reason for each (`cov_write` and `cov_wr_rd` need `wr_en`; `cov_full` and `cov_refill` need `full`). As planted, the covers also inherit the inverted disable, so they can hit only in reset cycles. "Nothing is checked" is now "enabled only while `rst_n` is 0, so only reset cycles are checked", in both the answer and the rubric. |
| S4 | `sva-axi-handshake-properties` | The `$stable` bundle left out `AWQOS`, `AWREGION` and `AWUSER`. | Added a comment inside `p_aw_payload_stable`: add the AXI4 fields `AWQOS`, `AWREGION` and `AWUSER` when the interface has them, because A3.2.1 requires all channel information to stay stable. I used a comment rather than adding them to the bundle because the AW signal table marks them AXI4-only and `AWUSER` optional. |
| S4 | `sva-strong-weak-liveness` | "A weak obligation that was never met holds" used the wrong terms. | Now: "A weak property with no bad state seen holds, because weak operators impose no requirement that the terminating condition happen (§16.12.15); a strong one whose requirement is still unmet is pending." In the rubric, "make the obligation strong" became "make the requirement strong". |

**Re-trace of the multiclock fix.** I traced both alignments by hand, then checked them with a small event model in the scratchpad (not part of the repo). The model has src and dst periods from 4 to 12, every phase, and 10 launches each, for 51,840 attempts. Each flop reads its input before the NBA updates of its time slot, and the assertion samples Preponed values. Results:
- A two-flop synchronizer passes both `a_sync` and `a_sync_loose` in every attempt. This holds even when `a` is held only through L.
- A three-flop synchronizer fails `a_sync` in both alignments whenever no destination tick falls strictly between the launch and T.
- A three-flop synchronizer passes `a_sync_loose` on all 6,480 coincident attempts. That is the slack.
- `b` is first sampled high at L + 2 with no destination tick between the launch and T, at L + 1 with one, and at or before L with two or more. This matches the "When `b` rises" bullet.

### Validation (fix round 1, re-run)

- `python3 -c "import json;json.load(open('content/interview-questions/sva-formal.json'))"`: OK.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, 863 tests passed.
- Extra: `tests/lib/practice-links.test.ts` passed (196 tests). No ids changed.
- Local check: inline backticks are balanced and fences closed in every rendered field of all 20 questions. A field-by-field diff against a pre-edit copy shows changes only in the five questions above.
