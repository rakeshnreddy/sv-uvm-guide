# G29-B-SVA accuracy review, round 1: `sva-formal.json`

Reviewer: accuracy lens, round 1. Date: 2026-10-11. Scope: all 20 questions in `content/interview-questions/sva-formal.json` (working tree, `git diff HEAD`), checked against the author log `G29-B-SVA.author.md`, `analysis/G29.md` / `G29.verify.md` (SVA-01, SVA-V01, gap rows) and the primary sources.

**Sources checked myself**
- IEEE 1800-2023 (`scratchpad/audit/t1_lrm_clean.txt`). Every cited clause number exists and has the title the bank relies on: 4.4.2.6, 16.3, 16.4, 16.4.1, 16.4.2, 16.5, 16.5.1, 16.7, 16.9.2, 16.9.2.1, 16.9.3, 16.9.5, 16.9.6, 16.9.8, 16.9.9, 16.9.10, 16.10, 16.11, 16.12, 16.12.2, 16.12.3, 16.12.7, 16.12.9, 16.12.12, 16.12.13, 16.12.15, 16.12.21, 16.13.1, 16.13.2, 16.13.3, 16.14.1 to 16.14.6, 16.14.8, 16.15, 17.2, 17.3, 17.7, 19.3, 19.8, 19.8.1, 20.9, 20.11, 20.12, 21.7.1.2, 23.11.
- Arm IHI0022E (`scratchpad/axiE.txt`): A3.1.2 (reset, AxVALID low, earliest drive point), A3.2.1 (VALID held, information stable), A3.3.1, A3.4.1, A5.3.1 (same-ID reads to different slaves), A5.3.5 (interconnect use of IDs), A5.4 (removal of write interleaving).
- Hand traces of every cycle table and code sample against the clause text.

**Verdict: does not pass yet. One S2 is open.** No S1. The two inherited S1s (G29-SVA-01, G29-SVA-V01) are fixed correctly. I traced `$rose(req) |=> (!ack)[*0:3] ##1 ack[*2] ##1 !ack` against the §16.9.2.1 empty-match rules for the 2-, 1- and 3-cycle pulses and the late rise, and every row of the table is right. The `|-> !ack ##1 (!ack)[*0:3] ...` variant is right too. The rubric now marks both incomplete forms as incomplete.

## Findings

| # | Sev | Question | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S2 | `sva-interval-operators` (follow-up 1) | The follow-up asks "Why does `lock throughout beat[->4] ##0 last` without parentheses mean something different?" The premise is false. In Table 16-3, `##` binds tighter than `throughout`, so the unparenthesized form parses as `lock throughout (beat[->4] ##0 last)`, which is the same sequence. A learner who answers the follow-up as asked will learn the wrong precedence. | Turn the premise around: "Does `lock throughout beat[->4] ##0 last` need parentheses? (No. `##` binds tighter than `throughout`. But `throughout` binds tighter than `intersect`, so keep the parentheses when an `intersect` follows.)" Or drop the follow-up. | IEEE 1800-2023 §16.9 Table 16-3 / §16.12 Table 16-3 (precedence: `[*] [=] [->]`, then `##`, then `throughout`, then `within`, then `intersect`) |
| 2 | S3 | `sva-multiclock-clock-flow` (model answer, rubric) | The prompt asks which property should check "a signal that crosses through a two-flop synchronizer". The answer says "use `\|=>`" and stops there. `a \|=> @(posedge dst_clk) b` checks `b` at the first destination tick, which matches only the output of the first flop. A two-flop synchronizer's output needs one more destination tick. The justification also mixes up the value the assertion samples at source tick T (launched before T) with "a value launched at a source tick". The correct reason is that a coincident destination flop captures exactly the value sampled at T, and that capture becomes visible to the assertion at the next destination tick, strictly after T. | Keep `\|=>` for the clock switch, then state the synchronizer latency in destination ticks, for example `a \|=> @(posedge dst_clk) ##1 b` for the second-flop output, or a `##[1:2]` window when the source can launch between edges. Reword the reason as above. | §16.13.1, §16.13.2 (`\|=>` goes to the nearest strictly later tick, `\|->` to the nearest tick at or after), §16.5.1 (sampling); hand trace |
| 3 | S3 | `sva-formal-overconstraint` (follow-up 1) | "After both fixes, `ast_count` gets a counterexample in which `wr_en` and `rd_en` are both high." Whether that can happen depends on which assumption is removed. Follow-up 2 implies that `asm_rd_with_wr` is the one rewritten. If `asm_one_op` stays, `wr_en && rd_en` is excluded and that counterexample cannot occur. | Say which fix is meant, for example "after fixing the polarity and deleting `asm_one_op`". Or change the follow-up to a counterexample that is reachable with `asm_one_op` kept. | Hand reasoning over the harness; §16.14.2 |
| 4 | S4 | `sva-interval-operators` (model answer) | "`##0` fuses the two, §16.9.2": `##0` fusion is defined in §16.7 (Sequences), not in §16.9.2 (Repetition). | Cite §16.7 for `##0`, and add it to `sources`. | §16.7, §16.9.2 |
| 5 | S4 | `sva-sampled-value-functions` (cycle table) | `data` is `-` (don't care) at edge 1, but `$stable(data)` at edge 2 is shown as `0`. With a don't-care previous value, the result is undetermined. | Give `data` a concrete value at edge 1 (for example `B`, so `$stable` = 0), or show `-` for `$stable(data)` at edge 2. | §16.9.3 |
| 6 | S4 | `sva-concurrent-vs-immediate` (follow-up 2), `sva-sampled-value-functions` | "the default sampled value of the type, `1'bx` for `logic`" is true only for a variable with no declaration initializer. §16.5.1 says that for a static variable the default sampled value is the value assigned in its declaration. | Add "(unless the declaration initializes it)". | §16.5.1 |
| 7 | S4 | `sva-deferred-assertions-glitch` (model answer) | "the arguments of that call are captured when the report is queued" holds only for arguments passed by value. `ref`/`const ref` arguments read current values in the Reactive region (`#0`) or the Postponed region (`final`). | Add "(by-value arguments; `ref` arguments are read when the action runs)". | §16.4 |
| 8 | S4 | `sva-deferred-assertions-glitch` (code) | The author lists `glitch_demo` as a complete unit for compile checks. When run, `always_comb` executes at time 0 and may see `valid_n` still `x` before the continuous assignment updates it. `x != 0` evaluates to `x`, so `a_simple` can also report at time 0. The answer only discusses time 10, so it is not wrong. Someone who runs the code will still see an unexplained message. | Add one line: "`a_simple` may also report at time 0 for the same reason." Or initialize with `assign valid_n = !valid;` plus `logic valid_n = 1'b1;`. | §9.2.2.2.2 (always_comb at time 0), §16.3, §16.4.2 |
| 9 | S4 | `sva-formal-convergence-signoff` | "Every undetermined property has a bounded depth N" depends on the tool. A depth is reported only when a bounded engine ran on that property. | Add "(when a bounded engine ran; tool-dependent)". | Tool behaviour, already labelled `verified: false` |
| 10 | S4 | `sva-axi-handshake-properties` | "name the bundle so the message says which field moved": naming the concatenation does not identify the field. | Say "use one `$stable` per field (or print `$past` and `$sampled` of each field) so the message says which field moved". | — |
| 11 | S4 | `sva-disable-iff-reset` | "Put one `default disable iff` in each interface or checker (§16.15)": §16.15 covers modules, interfaces, programs and generate blocks. Checkers get `default disable iff` from the §17.2 grammar. | Cite §16.15 and §17.2, or say "module or interface". | §16.15, §17.2 |

## Statements I checked and confirmed (no change needed)

- **Immediate, deferred, concurrent (`sva-concurrent-vs-immediate`, `sva-deferred-assertions-glitch`):**
  - Report queues and flush points, including the `always_comb` resume (§16.4.1, §16.4.2).
  - Observed reports mature in the Observed region and the action runs in Reactive; final reports mature in Postponed. The Reactive-loop caveat is right (§16.4.1).
  - The action block allows only a single subroutine call (§16.4).
  - The Reactive-region action block and the `a1_bad`/`a2_ok` example are right (§16.9.3, §16.14.1).
- **Sampled values (`sva-sampled-value-functions`, `sva-past-sampling`):**
  - `$rose`/`$fell` look at the LSB, and the first tick compares against the default sampled value (§16.9.3).
  - `$past` returns the default sampled value when too few ticks exist. `n` must be an elaboration-time constant. `$past` in an action block uses the leading clock (§16.9.3).
  - The N/N+1 table in `sva-past-sampling` is right.
- **Assert, assume, cover, restrict (`sva-assert-assume-cover`):**
  - Assumptions are checked and reported in simulation (§16.14.2).
  - `cover property` statistics: attempts, at most one success per attempt, vacuous successes counted separately, disabled evaluations counted only as attempts (§16.14.3). `cover sequence` counts every match.
  - `restrict` is not checked in simulation and has no action block (§16.14.4).
  - Action blocks cannot contain concurrent assert, assume or cover (§16.14.1).
- **Implication and vacuity (`sva-implication-operators`):**
  - `s |=> p` ≡ `s ##1 \`true |-> p` (§16.12.7).
  - The "not considered a pass or a failure" wording is supported (§16.14.8).
  - The pass action runs on vacuous success by default, and VacuousOff stops it (§20.11).
- **Disable iff (`sva-disable-iff-reset`):**
  - The disable condition uses current values and is checked from the attempt's start in the Observed region (§16.12).
  - `$sampled` in a disable condition is "meaningful" (§16.9.3). Other sampled value functions there need an explicit clock (§16.12).
  - A disabled evaluation runs no action block (§16.14.1, §16.14.2).
  - The edge-1 trace is right.
- **Repetition and interval operators (`sva-goto-vs-nonconsecutive`, `sva-interval-operators`):**
  - The `[->n]`/`[=n]` expansions, Boolean-only operands and the match-item ban (§16.9.2).
  - All three predictions in the goto trace (fail at 3, fail at 6, pass at 7).
  - `throughout` ≡ `[*0:$] intersect` (§16.9.9), `within` (§16.9.10), `and` ending at the later match (§16.9.5).
  - `weak(s)` ≡ `weak(first_match(s))` (§16.12.2).
  - The burst trace passes at 6.
- **Strong, weak and liveness (`sva-strong-weak-liveness`):**
  - In assert and assume a sequence defaults to weak; in cover it defaults to strong (§16.12.2).
  - The four finite-run levels (§16.12.21).
  - `not` switches strength, and the `not (a ##1 b)` follow-up matches the standard's own example (§16.12.3).
- **Multiclock (`sva-multiclock-clock-flow`):**
  - `##1`/`|=>` go to the nearest strictly later tick; `##0`/`|->` to the nearest tick at or after (§16.13.1, §16.13.2).
  - The table (A: 30/30; B: 45/30) is right.
  - The nonempty-match legality example is right (§16.13.1).
- **Bind and checkers (`sva-bind-and-checkers`):**
  - Actuals resolve from the target's viewpoint, and `$unit` is not visible (§23.11).
  - An interface target accepts only interface or checker instantiations (§23.11).
  - Checker ports default to input. Checkers cannot declare or instantiate modules, interfaces or programs (§17.2).
  - Covergroup declarations and instances are allowed in a checker (§17.2).
  - `rand const` free variables (§17.7).
- **Assertion control (`sva-assertion-control`):**
  - Control types 3, 4, 5 and 9 have the stated semantics.
  - Off leaves executing attempts alone. Kill aborts them and flushes queued deferred reports.
  - Action control does not change the statistics counters.
  - `levels` follows `$dumpvars` (§20.11, §21.7.1.2).
- **Covergroup latency sample (`sva-cover-property-vs-covergroup`):** the local variable, `++` match items and a `sample()` override called from a match item are legal (§16.10, §16.11, §19.8.1). The latency range is 1 to 16 and fits the bins.
- **AXI:**
  - VALID held and information stable (A3.2.1).
  - Reset drive-low and the earliest drive point (A3.1.2). This supports `(!ARESETn || $rose(ARESETn)) |-> !AWVALID`.
  - The slave may wait for VALID before READY, with no time limit (A3.3.1).
  - 4KB (A3.4.1), same-ID reads to different slaves (A5.3.1), interconnect ID extension (A5.3.5), and removal of write interleaving (A5.4).
  - "VALID eventually gets READY" is correctly labelled a design requirement.
- **Tool behaviour:** every tool-specific claim in the bank (pending-attempt reporting, vacuity and witness reports, induction engines, cut points, proof-core and mutation coverage, lasso traces) is labelled tool-dependent and cited `verified: false`.

## To close round 1

Fix finding 1 (S2). Findings 2 and 3 (S3) should be fixed in the same pass. Findings 4 to 11 are polish.
