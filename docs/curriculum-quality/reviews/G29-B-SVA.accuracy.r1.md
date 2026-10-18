# G29-B-SVA accuracy review, round 1: `sva-formal.json`

Reviewer: accuracy lens, round 1 (re-run). Date: 2026-10-18. Scope: all 20 questions in `content/interview-questions/sva-formal.json` as they stand in the working tree (`git diff HEAD`). The author log `G29-B-SVA.author.md` includes "Fix round 1", which answered an earlier round-1 accuracy pass dated 2026-10-11. This file replaces that pass. It re-checks the whole bank after those fixes against `analysis/G29.md` (SVA-01 to SVA-07, gap rows), `G29.verify.md` (SVA-V01, gap 4, author notes) and the primary sources.

**Sources I checked**
- IEEE 1800-2023 (`sources/t1_lrm_clean.txt`). I read the text of every clause the bank's argument depends on: §4.4.2.6, §9.2.2.2.2, §16.3, §16.4, §16.4.1, §16.4.2, §16.5.1, §16.7, §16.9.2, §16.9.2.1, §16.9.3, §16.9.5, §16.9.6, §16.9.8, §16.9.9, §16.9.10, §16.10, §16.11, §16.12 (disable iff text and Table 16-3), §16.12.2, §16.12.3, §16.12.7, §16.12.9, §16.12.12, §16.12.13, §16.12.15, §16.12.21, §16.13.1, §16.13.2, §16.13.3, §16.14.1 to §16.14.6 (with §16.14.6.2), §16.14.8, §16.15, §17.2, §17.7, §19.3, §19.8, §19.8.1, §20.9, §20.11, §20.12, §21.7.1.2, §23.11. Every cited clause exists and has the title the bank relies on.
- Arm IHI0022E (`sources/arm_axi.txt`): A3.1.2, A3.2.1, A3.3.1 (including the AXI4 write response dependency), A3.4.1, A5.3.1, A5.3.2, A5.3.5, A5.4.
- I hand-traced every cycle table and code sample. For the multiclock question I traced the synchronizer timing for coincident and non-coincident clock alignment under both `|->` and `|=>`.

**Verdict: does not pass. One S2 is open.** There is no S1. The two inherited S1s (G29-SVA-01 and G29-SVA-V01, `sva-repetition-operators`) are fixed correctly: I re-traced the 2-, 1- and 3-cycle pulses and the late rise against §16.9.2.1. All 11 findings of the earlier round-1 pass are fixed in the file. One of those fixes introduced the new S2: the multiclock question now argues that `|->` gets the synchronizer window wrong, and my trace shows the opposite (finding 1).

## Findings

| # | Sev | Question | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S2 | `sva-multiclock-clock-flow` (model answer "Why not `\|->`", rubric "Reason") | The answer says that on a coincident edge `\|->` lands one destination tick early, "so the same window measures a different latency for those attempts only", and that a window tuned on non-coincident attempts "is then off by one tick on coincident ones". The rubric grades the same reason. The trace shows the reverse. The source launches `a` at T0 < T. The first flop captures it at the first `dst_clk` tick strictly after T0. That tick is never later than L′, the first destination tick at or after T, which is where `\|->` lands. So the synchronized `b` is sampled high by L′+2 in every alignment, and `\|-> @(posedge dst_clk) ##[1:2] b` is exact for every alignment. With `\|=>`, a coincident attempt lands at T + 1 destination tick even though capture happened at or before T. Then `b` is high by landing+1, and the `##[1:2]` window has a spare tick. A three-flop synchronizer would pass `a_sync` on coincident edges. "The result changes when someone changes a clock period" is also unsupported: both forms pass a correct two-flop design in every alignment. As written, the key teaches a wrong timing model and would mark down a correct and tighter `\|->` answer. | Replace the "Why not `\|->`" bullet and the rubric's last "Reason" sentence. Say that both `\|->` and `\|=>` followed by `##[1:2]` pass a correct two-flop synchronizer when the source holds the level. With `\|->` the window is exact in every alignment, because the first flop captures no later than the first destination tick at or after T. With `\|=>`, coincident attempts land one tick later than needed, so the upper bound has a tick of slack there. Recommend `\|-> ... ##[1:2] b` when the latency bound matters, or keep `\|=>` and state the slack. Keep the true part of "Why `\|=>`": with no extra delay, `\|=>` is the form that can see a capture at a coincident edge, and `\|->` would sample `b` at T, before the capture. Accept both operators in the rubric when the window is justified. | IEEE 1800-2023 §16.13.1 (`##1` to the nearest strictly subsequent tick, `##0` to the nearest possibly overlapping tick), §16.13.2 (multiclock `\|->`/`\|=>`), §16.5.1 (Preponed sampling); hand trace of both alignments |
| 2 | S3 | `sva-goto-vs-nonconsecutive` (model answer last paragraph, rubric "Strong answers") | "If `done` never arrives, `a_noncon` never fails in simulation (§16.12.2)" is true only while `beat` stays low. By §16.9.2, a `[=3]` match ends "before any later match of the operand". So a fourth `beat` with no `done` kills every alternative, and the attempt fails at that tick, even though the sequence is weak. A learner could come away thinking `beat[=3] ##1 done` can wait forever whatever happens. | Write "if `done` never arrives and `beat` stays low, `a_noncon` never fails in simulation (the consequent is weak); a fourth `beat` before `done` still fails it". Make the same change in the rubric. | §16.9.2 (nonconsecutive repetition definition and expansion `b[->n] ##1 !b[*0:$]`), §16.12.2 |
| 3 | S4 | `sva-formal-overconstraint` (model answer, sanity kit) | "Here `cov_write` and `cov_full` are unreachable." In the planted harness, `cov_wr_rd` (needs `wr_en`) and `cov_refill` (needs `full`) are unreachable too. Also, "Out of reset ... Nothing is checked" leaves out that the inverted disable *enables* every assertion and assumption while `rst_n` is 0, so reset cycles are checked. | Write "all four covers are unreachable". Change "Nothing is checked" to "only reset cycles are checked". | §16.15, §16.12; hand reasoning over the harness |
| 4 | S4 | `sva-axi-handshake-properties` (code) | `p_aw_payload_stable` covers `AWID, AWADDR, AWLEN, AWSIZE, AWBURST, AWLOCK, AWCACHE, AWPROT`. A3.2.1 requires all information on the channel to stay stable, and AXI4 also has `AWQOS`, `AWREGION` and `AWUSER`. The prompt says "address and control". | Add the AXI4 fields, or add a comment such as "add `AWQOS`, `AWREGION`, `AWUSER` when present". | IHI0022E A3.2.1 |
| 5 | S4 | `sva-strong-weak-liveness` (model answer) | "A weak obligation that was never met holds; a strong one is pending." §16.12.21 classifies outcomes by bad states seen and *future obligations*. Weak operators create no future obligation, so "weak obligation" reads oddly. | Write "a weak property with no bad state seen holds; a strong one whose requirement is still unmet is pending". | §16.12.21, §16.12.15 |

## Statements I checked and confirmed (no change needed)

- **Immediate, deferred, concurrent** (`sva-concurrent-vs-immediate`, `sva-deferred-assertions-glitch`):
  - Deferred reports are queued per process and flushed at flush points, including the `always_comb` resume.
  - `#0` reports mature in Observed and their action runs in Reactive. `final` reports mature in Postponed, and the Reactive-loop caveat is right (§16.4.1, §16.4.2).
  - A deferred action block is a single subroutine call. By-value arguments are evaluated with the expression; `ref`/`const ref` arguments read current values in Reactive or Postponed (§16.4).
  - `always_comb` runs at time 0 (§9.2.2.2.2), and an `x` result fails an immediate assertion (§16.3).
  - Concurrent action blocks run in Reactive, as the `a1_bad`/`a2_ok` example shows (§16.9.3, §16.14.1).
  - The default sampled value is the declaration initializer or the type default, and the time-0 sample is the default value (§16.5.1).
  - Follow-up 3 is backed by the procedural-assertion flush points (§16.14.6.2).
- **Sampled values** (`sva-sampled-value-functions`, `sva-past-sampling`):
  - `$rose`/`$fell` look only at the LSB, and the first tick compares against the default sampled value (§16.9.3).
  - `$past` returns the default sampled value when too few ticks exist. `n` must be an elaboration-time constant, and the gating expression skips ticks.
  - An action block uses the leading clock (§16.9.3).
  - Both cycle tables are right, including `$fell(valid)` = 1 at edge 1.
- **Assert, assume, cover, restrict** (`sva-assert-assume-cover`, `sva-cover-property-vs-covergroup`):
  - Assumptions are checked in simulation (§16.14.2). `restrict` is not checked in simulation and has no action block (§16.14.4).
  - Action blocks cannot hold concurrent assert, assume or cover (§16.14.1).
  - `cover property` counts at most one success per attempt and counts vacuous successes separately. Disabled evaluations count only as attempts. `cover sequence` counts every match (§16.14.3).
  - The latency covergroup sample is legal: local variable, `++` match items, a match item on `!gnt` before `[*0:15]` (not on an empty-matching sequence), and `sample()` as a void method called in Reactive (§16.10, §16.11, §19.8, §19.8.1). The range 1 to 16 matches the bins.
- **Implication and vacuity** (`sva-implication-operators`):
  - `s |=> p` ≡ ``s ##1 `true |-> p`` (§16.12.7). Each antecedent match starts its own consequent check.
  - The "not considered a pass or a failure" wording comes from §16.14.8.
  - The pass action runs on vacuous success by default, and VacuousOff stops it (§20.11). `#-#` is followed-by (§16.12.9).
- **Disable iff** (`sva-disable-iff-reset`):
  - The disable condition uses current values and is tested from the attempt's start in Observed. A disabled evaluation is neither success nor failure (§16.12), and no action block runs (§16.14.1).
  - `$sampled` in a disable condition is "meaningful" (§16.9.3). Any other sampled value function there needs an explicit clock (§16.12).
  - The edge-1 trace is right: the synchronizer NBA lands before Observed, and the DUT reads the old `rst_n`. Both fixes work.
  - The `default disable iff` scopes are right (§16.15, §17.2).
- **Repetition and interval operators** (`sva-repetition-operators`, `sva-goto-vs-nonconsecutive`, `sva-interval-operators`):
  - The empty-match rule `(empty ##n seq)` ≡ `(##(n-1) seq)` (§16.9.2.1). The `[->n]`/`[=n]` expansions, the Boolean-only operand and the ban on attached match items (§16.9.2).
  - The goto trace is right: fail at 3, fail at 6, pass at 7. The burst trace is right: pass at 6, fail at 4 if `lock` drops, fail at 8 if the fourth beat is late.
  - Table 16-3 sits in §16.12 and orders `[*] [=] [->]` > `##` > `throughout` > `within` > `intersect` > `and`. The follow-up 1 parse reasoning is right, because `intersect` is associative.
  - `throughout` ≡ `(exp)[*0:$] intersect seq` (§16.9.9), `within` (§16.9.10), `and` ends at the later match (§16.9.5), and `intersect` requires the same end (§16.9.6).
  - `weak(s)` ≡ `weak(first_match(s))` (§16.12.2).
- **Local variables** (`sva-local-variables-data-integrity`):
  - Each attempt keeps its own copy (§16.10). The two-in-flight counterexample is right.
  - The ticket property pairs byte k with output k. 3-bit counters are safe at four in flight.
  - The `[=1]` trap is right. The constant free variable follow-up matches §17.7.
- **Strong, weak and liveness** (`sva-strong-weak-liveness`):
  - In assert and assume a sequence defaults to weak; elsewhere it is strong (§16.12.2).
  - The four finite-run levels (§16.12.21).
  - Strong operators require the clock to keep ticking (§16.12.15).
  - The `not (a ##1 b)` follow-up matches the standard's own §16.12.3 example.
- **Multiclock** (`sva-multiclock-clock-flow`, apart from finding 1):
  - The table is right (A: 30/30; B: 45/30), and `p3` fails at 10, 40, 50 and 60.
  - The nonempty-match legality example is right (§16.13.1). Clock flow governs `$past` (§16.13.3).
  - The claim that `p1` "at best sees the first flop" is right.
- **Bind and checkers** (`sva-bind-and-checkers`):
  - Actuals are resolved from the target's viewpoint, "as if the instance was present at the very end of the target scope", and `$unit` declarations are not visible (§23.11).
  - An interface target takes only interface or checker instantiations (§23.11).
  - The first checker port defaults to input, and a checker cannot declare or instantiate modules, interfaces or programs. Covergroup declarations and instances, `default clocking` and `default disable iff` are allowed in a checker (§17.2).
- **Assertion control** (`sva-assertion-control`):
  - Control types 3, 4, 5 and 9 behave as stated. Off leaves executing attempts alone. Kill aborts them and flushes deferred reports.
  - Control types 6 to 11 do not change the statistics counters.
  - `levels` follows `$dumpvars` (§20.11, §21.7.1.2).
- **AXI** (`sva-axi-handshake-properties`, `sva-staff-formal-strategy`):
  - VALID is held and the information is stable (A3.2.1).
  - VALID is driven low during reset, and the earliest drive point is the rising edge after ARESETn is high, so `(!ARESETn || $rose(ARESETn)) |-> !AWVALID` is exact (A3.1.2).
  - The receiver may wait for VALID with no time limit (A3.3.1). BVALID waits for AW and the last W handshake under the AXI4 response dependency (A3.3.1).
  - Bursts do not cross 4KB (A3.4.1). Same-ID reads to different slaves (A5.3.1). Interconnect ID extension (A5.3.5). Write data in address order (A5.3.2, A5.4).
- **Tool behaviour**: every tool-specific claim is labelled tool-dependent and cited `verified: false`. These are pending-attempt reporting, vacuity, witness and reset reports, induction engines, cut points, proof-core and mutation coverage, and lasso traces.

## To close round 1

Fix finding 1 (S2) in both the model answer and the rubric, and hand-trace both alignments again after the edit. Fix finding 2 (S3) in the same pass. Findings 3 to 5 are polish.
