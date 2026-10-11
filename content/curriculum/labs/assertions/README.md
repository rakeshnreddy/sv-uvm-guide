# Lab: catch a valid/ready bug with assertions

**Module:** I-SV-4A SVA Fundamentals. Read the [module page](/curriculum/T2_Intermediate/I-SV-4A_SVA_Fundamentals/index) first, especially "Three kinds of assertion", "Assertions read the past", "Every edge starts an attempt", "Sampled-value functions", "Vacuity: green does not mean checked", "disable iff and reset", "assert, assume and cover" and "Action blocks, severity and assertion control". The lab also assumes the scheduling regions (Preponed, Active, NBA, Observed, Reactive, Re-NBA) from [F3B](/curriculum/T1_Foundational/F3B_Scheduling_Regions/index) and clocking blocks from [F4C](/curriculum/T1_Foundational/F4C_Clocking_Blocks/index).

**Goal.** You write the protocol checks for a small design, prove with covers that they were exercised, and let them pinpoint a deliberate bug that a scoreboard can only notice later. Along the way you will:

1. choose an immediate, a deferred or a concurrent assertion for each check;
2. choose `|->` or `|=>` from a one-sentence rule, and predict at which edge a check fails and which sampled values it compared;
3. write valid/ready checks with `$stable`, `$past` and `disable iff`;
4. use `assert`, `assume` and `cover property` for the right jobs, and see a run pass vacuously;
5. read a failure from its action-block message and fix the design.

**Time:** about 45 minutes. **You need:** a simulator that supports IEEE 1800-2023 immediate, deferred and concurrent assertions. No UVM library is needed.

## The bench

```text
            in_valid  ->                    out_valid ->
 source     in_data   ->     hs_slice       out_data  ->     sink + scoreboard
 (tb_top)   in_ready  <-     (rtl/)         out_ready <-     (tb_top)
                                 |
                  hs_slice_sva (u_sva) watches all eight signals
```

| File | What it holds | You edit it? |
|---|---|---|
| `rtl/hs_slice.sv` | `hs_slice`, the design: a one-word valid/ready register slice. It contains one deliberate bug. | Only in Step 5 |
| `tb/hs_slice_sva.sv` | `hs_slice_sva`, the checker module: two given checks and four TODOs | Yes |
| `tb/tb_top.sv` | `tb_top`: clock, reset, source, sink, scoreboard, end-of-test check | No |
| `solution/hs_slice_sva.sv`, `solution/hs_slice.sv` | The completed checker and the fixed design | Read them after Step 5 |
| `Makefile` | Example compile-and-run recipes | No |

Terms used below:
- A **transfer** happens at a rising clock edge where `valid` and `ready` are both 1. The side that drives `valid` and the data is the *source* of that port; the side that drives `ready` is the *sink*.
- A **stall** (or backpressure) is an edge where `valid` is 1 and `ready` is 0: the word is offered but not taken.
- `hs_slice` is the sink of the upstream port (`in_*`) and the source of the downstream port (`out_*`). It takes a word when it is empty or when its word leaves at the same edge (`in_ready = !out_valid || out_ready`), and offers that word one edge later.

What the bench does (edge *k* is at 5 + 10*k* ns; reset is released at 22 ns):
- The **source** offers the words `a0` to `a5` back to back from the edge at 25 ns, and holds each word until an edge where `in_ready` is 1.
- The **sink** takes a word at every edge, except that after its second word it holds `out_ready` low for two edges (65 ns and 75 ns). `+NO_STALL` removes that stall; `+PAUSE=<n>` makes it *n* edges long.
- The **scoreboard** compares every word the sink takes with the order the source sent, using a simple immediate assertion `a_sb_match`.
- The source and the sink read and drive the design only through the clocking block `cb` (F4C): they read the values sampled just before an edge and drive new values just after it, so the design and the checks see each new value at the next edge.
- When six words have arrived, the bench waits two edges, runs the immediate assertion `a_end_of_test` (word count, scoreboard mismatches, and `u_sva.n_fail`, the checker's failure count) and calls `$finish`. A watchdog ends the run after 100 edges if words stop arriving, so the bench always terminates.

## The rules

These are the valid/ready rules for the downstream port, plus two checks of the design's own behaviour.

| Rule | In one sentence | Check | Kind | Who must obey it |
|---|---|---|---|---|
| R0 | Out of reset, `in_ready` is never X or Z. | `a_in_ready_known` (given) | deferred immediate `assert final` | the design |
| R1 | Once `out_valid` is high, it stays high until the sink takes the word. | `a_out_valid_hold` (TODO 1) | concurrent `assert property` | the design |
| R2 | While the port is stalled, `out_data` does not change. | `a_out_data_stable` (TODO 2) | concurrent `assert property` | the design |
| R3 | After a stalled edge, `out_ready` is 1 at one of the next `MAX_STALL` (4) edges. | `m_sink_ready_bounded` (TODO 3) | concurrent `assume property` | the environment (the sink in `tb_top`) |
| R4 | A word the slice takes appears on `out_data` at the next edge. | `a_accept_to_out` (given) | concurrent `assert property` | the design |
| C1 | A downstream transfer happened. | `c_transfer` (TODO 4) | `cover property` | evidence |
| C2 | A stall happened and ended in a transfer. | `c_stall_then_ready` (TODO 4) | `cover property` | evidence |

What the kinds in the table mean (you test *why* each check has its kind in Step 2, Q0):
- A **simple immediate** assertion, `assert (expr)`, is a procedural statement: it checks `expr` with the values it reads at the moment the statement runs (IEEE 1800-2023 §16.3). The bench's scoreboard check `a_sb_match` is one.
- A **deferred immediate** assertion, `assert final (expr)`, is checked like an immediate one, but a failure report is only queued: with `final` it matures at the end of the time step, and it is discarded if the process that checked it runs again in the same time step (§16.4). Written outside any procedure, as R0 is, it behaves as if it were inside an `always_comb` (§16.4.3).
- A **concurrent** assertion, `assert property (...)`, starts a new **attempt** at every rising edge of `clk`, judges **sampled values** (the values the signals had just before the edge, in the Preponed region; §16.5.1), and can follow its attempt over several edges. Here every one is **disabled** while `rst_n` is low.
- R3 is a promise the testbench makes, not the design, so it is an assumption. In simulation an assumption is checked and reported exactly like an assertion (§16.14.2); a formal tool would use it to restrict `out_ready` instead.
- A cover records that a scenario happened (§16.14.3). Without C2 you cannot tell whether R1 and R2 ever had a stall to judge.

## Run it

Run every command from this folder. Pick one of the example recipes in the `Makefile` with `SIM=questa`, `SIM=xcelium` or `SIM=vcs`, or pass your own commands with `COMPILE="..." RUN="..."`. The recipes are examples: check the switches against your simulator's manual. Support for concurrent assertions in open-source simulators varies, so check your tool's documentation first.

| Command | What it compiles and runs |
|---|---|
| `make run SIM=<tool>` | your checker (`tb/hs_slice_sva.sv`) on the design in `rtl/` |
| `make nostall SIM=<tool>` | the same with `+NO_STALL` |
| `make run SIM=<tool> PLUSARGS=+PAUSE=6` | the same with a six-edge stall |
| `make solution SIM=<tool>` | the solution checker on the design as given (with its bug) |
| `make solution-fixed SIM=<tool>` | the solution checker on the fixed design |

The compile order is `hs_slice.sv`, `hs_slice_sva.sv`, `tb_top.sv`, and the top module is `tb_top`.

**About the logs below.** They were traced by hand, edge by edge, from the IEEE 1800-2023 rules (§16.5.1, §16.9.3, §16.12, §16.14), not captured from a simulator. Every line that reports an event starts with its own `[<time> ns]` tag, so the times match on any simulator (the plusarg banner and the final `[SVA] summary` line carry no time). A `$error` line also gets a tool-specific prefix with the severity, the file, the line and the scope (§20.10), and your simulator adds its own `$finish` and assertion-summary lines. Those are left out here.

## Step 1: Run the starter and read the scoreboard error

Run `make run SIM=<tool>` on the files as given. Expected output:

```text
[85 ns] [TB] scoreboard: expected a2, got a3
[135 ns] [TB] FAIL: 6 words received, 1 scoreboard mismatch(es), 0 assertion failure(s)
[SVA] summary: 0 check failure(s); c_stall_then_ready hit 0 time(s); c_transfer hit 0 time(s)
```

The two given checks pass. The scoreboard knows that the third word the sink took was wrong (`a3` instead of `a2`). It cannot tell you when the design went wrong, or which rule it broke: it only sees words when they leave. Write down your guess before you go on.

## Step 2: Predict, then write R1 and R2

Answer these on paper first (answers at the end of this README):

0. **Q0. Test the Kind column.** For each change, say what would go wrong:
   - (a) R0 written as a simple immediate `assert (!rst_n || !$isunknown(in_ready));` inside an `always_comb`. Hint: `in_ready` is computed combinationally from `out_valid` and `out_ready`, and an `always_comb` can run several times in one time step.
   - (b) R2 written as a simple immediate `assert` inside `always_ff @(posedge clk)`. What would you have to build by hand to compare `out_data` at two edges, and what does the concurrent form give you instead?
   - (c) The scoreboard check `a_sb_match` in `tb_top.sv` is a simple immediate assertion. Why is that enough there?
1. **Q1.** R2 says "while the port is stalled, `out_data` does not change". Someone writes it as `(out_valid && !out_ready) |-> $stable(out_data)`. `$stable` compares the sampled value at the current edge with the sampled value at the previous edge (§16.9.3). On a *correct* design, at the edge where a freshly loaded word is first stalled, what does this version report?
2. **Q2.** Someone writes R1 as `(out_valid && !out_ready) |-> out_valid`. Can it ever fail?

Then complete TODO 1 and TODO 2 in `tb/hs_slice_sva.sv`:
- clock each check with `@(posedge clk)` and reset it with `disable iff (!rst_n)`;
- the trigger (antecedent) of both rules is a stalled edge: `out_valid && !out_ready`;
- choose `|->` (the obligation starts at the same edge) or `|=>` (it starts at the next edge) from your answers to Q1 and Q2;
- in the fail action, increment `n_fail` and use the message given in the file. In R2's message print `$past(out_data)` and `$sampled(out_data)`: the action block runs in the Reactive region, after the design has updated `out_data`, so plain `out_data` could print a value the check never compared (§16.9.3).

Do not run yet: a run with stalls would show a failure before you have the covers that tell you what the run exercised.

## Step 3: Add the assumption and the covers, then run without stalls

Complete TODO 3 and TODO 4:
- `m_sink_ready_bounded`: `assume property`, the same trigger as R1 and R2, and a bounded window `##[1:MAX_STALL] out_ready` (prefer a bound over an open-ended `##[1:$]`: an open-ended wait can never fail during the run);
- `c_transfer` and `c_stall_then_ready`: `cover property` of a **sequence**, not an implication (an implication "succeeds" vacuously on every edge where its trigger is false). The pass statement increments `n_transfer` or `n_stall_then_ready`.

Now run `make nostall SIM=<tool>`. Expected output:

```text
[TB] +NO_STALL: the sink never stalls
[115 ns] [TB] PASS: 6 words received in order, no assertion failures
[SVA] summary: 0 check failure(s); c_stall_then_ready hit 0 time(s); c_transfer hit 6 time(s)
```

Everything passes, and the bug is still in the design. **Q3.** Why does this green run prove nothing about R1 and R2? Which number in the summary tells you so?

## Step 4: Run with stalls and read the failure

Run `make run SIM=<tool>`. Expected output:

```text
[75 ns] [SVA] a_out_data_stable: out_data changed from a2 to a3 while out_valid was high and out_ready low
[85 ns] [TB] scoreboard: expected a2, got a3
[135 ns] [TB] FAIL: 6 words received, 1 scoreboard mismatch(es), 1 assertion failure(s)
[SVA] summary: 1 check failure(s); c_stall_then_ready hit 1 time(s); c_transfer hit 6 time(s)
```

The edge-by-edge trace behind it (values are the sampled values at each edge; "stall" means `out_valid` = 1 and `out_ready` = 0):

| Edge (ns) | `in_valid` / `in_data` / `in_ready` | `out_valid` / `out_data` / `out_ready` | What happens |
|---|---|---|---|
| 35 | 1 / a0 / 1 | 0 / 00 / 1 | slice takes a0 |
| 45 | 1 / a1 / 1 | 1 / a0 / 1 | sink takes a0; slice takes a1 |
| 55 | 1 / a2 / 1 | 1 / a1 / 1 | sink takes a1; slice takes a2 |
| 65 | 1 / a3 / **0** | 1 / a2 / **0** | **stall**; the source keeps offering a3; R2's attempt from this edge waits for the next edge. Just after this edge (NBA region) the design changes `out_data` to a3; no check samples that value until 75 ns |
| 75 | 1 / a3 / 0 | 1 / **a3** / 0 | stall continues; `out_data` is now a3: **R2 fails** (a2 at 65 ns, a3 at 75 ns) |
| 85 | 1 / a3 / 1 | 1 / a3 / 1 | sink takes a3 but expected a2: scoreboard error; C2 matches (stall at 75, transfer at 85) |
| 95 to 115 | | | a3, a4, a5 reach the sink; six words in all, so the bench ends at 135 ns |

If your output differs, run `make solution SIM=<tool>`: it runs the solution checker on the same buggy design and prints exactly the output above. Compare, then use the hints below.

**Q4.** The design changed `out_data` right after the edge at 65 ns. Why does R2 report at 75 ns and not at 65 ns?
**Q5.** At the 65 ns edge `in_ready` was 0, so the slice could not take a word. Which signal must the payload register have looked at to load a3 anyway?

## Step 5: Fix the design and confirm a clean run

Find the line in `rtl/hs_slice.sv` that loads `out_data`, and fix it so that the payload changes only when the slice actually takes a word. It is a one-line change. Rerun `make run SIM=<tool>`. Expected output:

```text
[135 ns] [TB] PASS: 6 words received in order, no assertion failures
[SVA] summary: 0 check failure(s); c_stall_then_ready hit 1 time(s); c_transfer hit 6 time(s)
```

Now compare your files with `solution/hs_slice_sva.sv` and `solution/hs_slice.sv` (`make solution-fixed` runs them; its output is the same as above).

**Checklist before you finish:**
- [ ] Your R1 and R2 use `|=>`, and you can say why `|->` is wrong for each.
- [ ] Your fail messages print `$past` and `$sampled` values, not current ones.
- [ ] You can say, for R0, R2 and `a_sb_match`, why each has its kind and what would go wrong with another kind (Q0).
- [ ] You can explain why the `+NO_STALL` run passed although the bug was there, and which cover count (`c_stall_then_ready` = 0) showed that the stall path was never exercised.
- [ ] You can say why R3 is an `assume`, not an `assert`, in this bench.
- [ ] You can name the edge where R2 failed, the edge where the design misbehaved, and why they differ.

## Hints

Read one at a time, and stop as soon as you are unstuck. Each hint is folded; open it only when you need it.

<details>
<summary>Hint 1: no failure at 75 ns</summary>

Check that R2's trigger is the stalled edge (`out_valid && !out_ready`), that you used `|=>`, and that the obligation is `$stable(out_data)`. Check that the assertion is not inside an `initial` block (there it would make a single attempt, at time 0); put it next to the given ones.

</details>

<details>
<summary>Hint 2: a failure at 65 ns, or on the fixed design</summary>

You used `|->` in R2: see Q1.

</details>

<details>
<summary>Hint 3: R2 fails but the message prints a3 twice</summary>

You printed `out_data` instead of `$past(out_data)` for the earlier value.

</details>

<details>
<summary>Hint 4: both covers stay at 0 on the stalled run</summary>

The pass statement must increment the counter (`n_transfer++;` and `n_stall_then_ready++;`). Without it the cover still matches, but the summary has nothing to count.

</details>

<details>
<summary>Hint 5: a cover counts far more often than the summaries above</summary>

You covered an implication, for example `(out_valid && !out_ready) |=> (out_valid && out_ready)`. An implication succeeds vacuously at every edge where its trigger is false, and a cover's pass statement runs for every successful attempt (§16.14.3), so the counter climbs on every idle edge. Cover the sequence instead: `(out_valid && !out_ready) ##1 (out_valid && out_ready)`.

</details>

<details>
<summary>Hint 6: finding the bug</summary>

In `hs_slice`, `out_valid` only moves when `in_ready` is 1. Does `out_data` follow the same rule?

</details>

## Push further

Predict each result before you run it; the expected results are in Answers.

- **Break the environment's promise.** With the fixed design, run `make run SIM=<tool> PLUSARGS=+PAUSE=6`. Which check fails first, at which edge, and how does the bench end? Is the design wrong? (An assumption is checked in simulation exactly like an assertion, §16.14.2.)
- **Switch a check off.** In a local copy of `tb_top.sv`, add `$assertoff(0, tb_top.u_sva.a_out_data_stable);` just before `#22 rst_n = 1'b1;`, and run on the buggy design. What does the log print? Then move the call to a separate `initial #70 $assertoff(0, tb_top.u_sva.a_out_data_stable);`, after R2's attempt from 65 ns has started, and predict again. Finally try `$assertkill` in its place at 70 ns (§20.11).
- **Choose a severity.** R2's fail action calls `$error`. In a local copy of your checker, change it to `$fatal(1, ...)` (the first argument of `$fatal` is the finish number, so the message comes second; §20.10) and run on the buggy design. What does the log print, and what do you lose? When is `$fatal` the right choice?
- **Reset in the middle of an attempt.** Suppose `rst_n` fell at 78 ns. What happens to R2's attempt that started at the stalled edge at 75 ns and would be judged at 85 ns?
- **Why no `$past(rst_n)` guard?** The module page recommends a `$past(rst_n) |->` guard on checks that look back. R2 and R4 look back, yet they do not need it in this bench. Why?
- **Where these checks go next.** I-SV-4B adds repetition, local variables and data-integrity checks across a deeper pipeline; I-SV-4C puts checks like these into a `checker` and attaches them to the design with `bind` instead of instantiating them by hand.

## Answers

- **Q0 (a).** A simple immediate assertion reports every time its statement runs. An `always_comb` can run several times in one time step while its inputs settle, so a value that exists only for a moment (a glitch, for example a short X while reset and the registers settle) could be reported as a failure although it is gone by the end of the time step. The `assert final` form queues the report, discards it if the process runs again in the same time step, and reports only at the end of the time step (§16.4). In this bench R0 never fails either way; the deferred form is the safe habit for combinational checks.
- **Q0 (b).** An immediate assertion sees only the values at the moment it runs; it has no notion of the previous edge. You would have to keep the previous `out_data` and the previous stall state in your own registers, write their reset, and make sure you read them before they update. Its reads also happen in the Active region, where they can race with other processes woken by the same edge. The concurrent form judges the Preponed samples (§16.5.1), `|=>` and `$stable` relate the two edges for you (§16.9.3, §16.12.7), and `disable iff` handles reset.
- **Q0 (c).** `a_sb_match` runs once per edge inside the sink's procedural loop and compares `cb.out_data`, a value the clocking block sampled just before the edge (§14.3), with the word the scoreboard expects. It needs no history and no attempt that spans edges, so a check of one moment is enough.
- **Q1.** It fails at 65 ns even on a correct design. At 65 ns the slice has just loaded a2 (it held a1 at 55 ns), so `$stable(out_data)` compares a2 with a1 and is false. The rule is about the *next* edge ("the word offered at a stalled edge is still there at the next edge"), so R2 needs `|=>`.
- **Q2.** No. With `|->` the obligation `out_valid` is checked at the same edge as the trigger `out_valid && !out_ready`, where it is always true. A check that cannot fail is worse than none, because it looks like coverage. R1 needs `|=>`.
- **Q3.** Without a stall, the trigger `out_valid && !out_ready` is never true, so every attempt of R1, R2 and R3 succeeds vacuously (§16.14.8): the check passed without judging anything. `c_stall_then_ready hit 0 time(s)` is the evidence; `c_transfer hit 6` only shows that data moved.
- **Q4.** A concurrent assertion judges sampled values: the values from just before each edge. The design's nonblocking update at the 65 ns edge happens after that edge's sampling, so the new value a3 is first sampled at 75 ns. The attempt that started at 65 ns compares those two samples and fails at 75 ns.
- **Q5.** `in_valid`. The payload register loaded whenever the source offered a word, without asking whether the slice could take it (`in_ready`). The fix in `solution/hs_slice.sv` loads `out_data` only when `in_valid && in_ready`.
- **Break the environment's promise.** `m_sink_ready_bounded` fails first, at 105 ns: the attempt that started at the stalled edge at 65 ns saw `out_ready` low at 75, 85, 95 and 105 ns, the whole `##[1:4]` window. The attempt from 75 ns fails at 115 ns. The log:

  ```text
  [TB] +PAUSE: the sink stalls for 6 edges
  [105 ns] [SVA] m_sink_ready_bounded: out_ready stayed low for 4 edges after a stalled edge
  [115 ns] [SVA] m_sink_ready_bounded: out_ready stayed low for 4 edges after a stalled edge
  [175 ns] [TB] FAIL: 6 words received, 0 scoreboard mismatch(es), 2 assertion failure(s)
  [SVA] summary: 2 check failure(s); c_stall_then_ready hit 1 time(s); c_transfer hit 6 time(s)
  ```

  The design is correct (no scoreboard mismatch); the testbench broke its own rule, and the assumption caught it (§16.14.2).
- **Switch a check off.** With `$assertoff` at time 0, R2 starts no attempts, so only the scoreboard reports:

  ```text
  [85 ns] [TB] scoreboard: expected a2, got a3
  [135 ns] [TB] FAIL: 6 words received, 1 scoreboard mismatch(es), 0 assertion failure(s)
  [SVA] summary: 0 check failure(s); c_stall_then_ready hit 1 time(s); c_transfer hit 6 time(s)
  ```

  At 70 ns the log is the same as in Step 4, failure at 75 ns included: `$assertoff` stops new attempts, but attempts that are already running, and their action blocks, are not affected (§20.11, Off). `$assertkill` at 70 ns also aborts the attempt in flight, so the log matches the time-0 one above (§20.11, Kill). Either way, pair every `$assertoff` or `$assertkill` with an `$asserton` and keep the reason in a comment.
- **Choose a severity.** The run stops at the first failure. `$fatal` calls `$finish` implicitly (§20.10), and the checker's `final` procedure still runs when the simulation ends (§9.2.3):

  ```text
  [75 ns] [SVA] a_out_data_stable: out_data changed from a2 to a3 while out_valid was high and out_ready low
  [SVA] summary: 1 check failure(s); c_stall_then_ready hit 0 time(s); c_transfer hit 2 time(s)
  ```

  You lose the scoreboard's confirmation at 85 ns, the end-of-test check and the cover counts for the rest of the run. Use `$error` for a protocol violation, so the run goes on collecting evidence, and keep `$fatal` for states where going on is pointless or misleading, such as an X on a control signal or a broken environment. `$warning` flags something suspicious but legal; `$info` is a note.
- **No `$past(rst_n)` guard.** R2 and R4 look back only to the edge where their own attempt started, and only attempts that start at an edge where `rst_n` is already 1 are enabled (the attempts at 5 and 15 ns are disabled). Here reset is released at 22 ns, between two edges, so the first enabled attempt (25 ns) already sampled out-of-reset values (§16.5.1). If reset were released by a flop at an edge, the attempt at that edge would be enabled, because the disable condition uses current values (§16.12), while its samples were taken in reset; then add the guard.
- **Reset at 78 ns.** The attempt is disabled at 78 ns: it neither passes nor fails, and its action block does not run. The disable condition uses current values, not sampled ones, and is checked throughout the attempt, not only at clock edges (§16.12, §16.14.1).

## References

IEEE Std 1800-2023:
- §16.3 immediate assertions; §16.4 deferred assertions, including the single-subroutine-call rule for their action blocks; §16.4.3 deferred assertions outside procedural code;
- §16.5.1 sampling; §16.9.3 sampled value functions (`$sampled`, `$stable`, `$past`, and their use in action blocks);
- §16.12 declaring properties (the `disable iff` condition uses current values); §16.12.7 implication;
- §16.14.1 assert, §16.14.2 assume, §16.14.3 cover statements; §16.14.5 concurrent assertions outside procedural code; §16.14.8 nonvacuous evaluations;
- §14.3 clocking blocks (default skews: input 1step, output 0); §14.10 clocking block events; §14.16 synchronous drives (Re-NBA region);
- §9.2.3 final procedures (they still run when `$fatal` ends the simulation);
- §20.9 `$isunknown`; §20.10 severity tasks; §20.11 assertion control (`$assertoff`, `$asserton`, `$assertkill`); §21.6 command-line input (`$test$plusargs`, `$value$plusargs`).
