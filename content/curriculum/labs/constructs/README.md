# Lab: Race-aware interface testbench with clocking blocks

This lab belongs to module F4C. Do it after [F4C: Synchronizing with Clocking and Program Blocks](/curriculum/T1_Foundational/F4C_Clocking_Blocks/index). It is milestone M1 of the course: a directed testbench, still without UVM, that drives and samples the DUT through clocking blocks in an interface, so its verdict does not depend on the order in which the simulator runs processes.

F4C's worked example builds the M1 bench for `pipe2`, a two-stage pipeline. Here you build the same bench, piece by piece, for its sibling `rot_pipe`, which has one more register and a different function. The names (`pipe_if`, `cb`, `mon_cb`, `wait_cycles`, `tb_top`, `send`, `monitor`, `exp_q`, `report`) are F4C's, and the self-checking conventions (`!==`, one `PASS=<n> FAIL=<m>` line, a watchdog) are F2E's from lab `simple-dut-1`. One thing is new: the monitor checks *when* each result arrives as well as its value, because that is where a testbench race shows up. Before you start, solve the race debug challenge in [F3C](/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index) and review modports and interfaces in [F4B](/curriculum/T1_Foundational/F4B_Interfaces_and_Modports/index).

## What you will practise

- An interface with two clocking blocks, one per role: a default clocking `cb` for the driver and an input-only `mon_cb` for the monitor (IEEE 1800-2023 §14.3, §14.12).
- Explicit skews: inputs sampled `#1step`, the value from just before the edge (§4.4.2.1, §14.13); outputs driven `#0`, which changes the signal in the Re-NBA region of the edge's own time slot (§14.16).
- A driver that waits on the clocking block event `@(bus.cb)` and drives only through `bus.cb`.
- A monitor that waits on `@(bus.mon_cb)` and reads only `bus.mon_cb`. The block triggers that event in the Observed region, after it has stored the edge's samples (§14.10, §14.13).
- An asynchronous reset written directly, between edges, never through a clocking block.
- Cycle delays `##` where a default clocking is in scope, and `@(bus.cb)` where it is not (§14.11, §14.12).
- A check of each result's value **and** arrival cycle, and proof that the bench fails on planted bugs.
- Proof that a bench without clocking blocks has a race: one piece of code, two legal process orders, two verdicts (§4.7).

## Files

- `work/rot_pipe.sv`: the DUT. Read its specification below, not its RTL.
- `work/pipe_if.sv`: the starter interface. It has the signals; you add the clocking blocks and `wait_cycles` in step 2.
- `work/tb_top.sv`: the starter testbench. It compiles and runs, but checks nothing. Each `TODO step N` comment marks code you write in step N. The clock, the DUT connection, the scoreboard type `exp_t`, the reference model `model_rotl` and the test `run_test` are given.
- `work/tb_racy.sv`: a complete copy of the same test with no interface and no clocking blocks, for step 7. Do not copy its driver.
- `solution/pipe_if.sv` and `solution/tb_top.sv`: one reference solution. Open them only after you finish.

Every design element declares `timeunit 1ns; timeprecision 1ps;`: a design in which some modules have a time unit and others do not is an error (§3.14.2.3).

## The DUT: a three-register rotate pipeline

| Port | Direction | Meaning |
|---|---|---|
| `clk` | input | Clock. Everything happens on its rising edge. |
| `rst_n` | input | Asynchronous reset, active low. |
| `in_vld` | input | `in_data` holds an item at this edge. |
| `in_data` | input, 8 bits | The item. |
| `out_vld` | output | `out_data` holds a result. |
| `out_data` | output, 8 bits | The item rotated left by one bit. |

- **R1.** While `rst_n` is 0, every register, `out_vld` and `out_data` are 0. The reset does not wait for a clock edge.
- **R2.** An item is accepted at a rising edge where `in_vld` is 1. If it is accepted at edge *c*, `out_vld` is 1 and `out_data` holds its result from edge *c*+2 until edge *c*+3. The pipeline never stalls.
- **R3.** The result is `in_data` rotated left by one bit: bit 7 moves to bit 0, so `8'h80` gives `8'h01` and `8'hC3` gives `8'h87`.
- **R4.** `out_vld` is 0 after every edge that has no item to present.

The parameter `BUG` plants a known bug for step 6; leave it at 0 until then.

**The timing rule your bench relies on.** `send` drives an item through `cb` just after edge *k*. With output skew `#0` the item reaches the DUT's inputs in the Re-NBA region after edge *k*, after the flops have read their inputs at *k*, so the DUT accepts it at edge *k*+1 (R2: *c* = *k*+1). The output register takes the result at edge *k*+3. `mon_cb` samples with `#1step`, the value from just before each edge, so it first sees the result at edge *k*+4. With rising edges every 10 ns, an item driven after the 15 ns edge is checked at 55 ns. That is why `tb_top` declares `SAMPLE_EDGES = 4`.

## Step 1: Run the starter

Compile `work/rot_pipe.sv`, `work/pipe_if.sv` and `work/tb_top.sv` (commands under [Running the lab](#running-the-lab)) and run `tb_top`. Captured from Verilator 5.052, without its own `$finish` banner:

```text
PASS=0 FAIL=0
```

The run ends at 0 ns. Before you read on: is it a pass?

<details>
<summary>Answer: a vacuous pass</summary>

No. The tasks are empty, so `run_test` takes no time, nothing is driven and nothing is compared. A script that looks only for `FAIL=0` would mark this run green. Step 5 makes `report()` turn "nothing was checked" into a failure.

</details>

## Step 2: Two clocking blocks in the interface

In `work/pipe_if.sv`:

1. **The driver's block.** Declare `default clocking cb @(posedge clk);` with `default input #1step output #0;` written out, `output in_vld, in_data;` and `input out_vld, out_data;`. The driver never reads `out_vld` here, but a driver that must react to the DUT (a `ready` signal, say) reads it through `cb`.
2. **The monitor's block.** Declare `clocking mon_cb @(posedge clk);` with `input rst_n, in_vld, in_data, out_vld, out_data;` and nothing else.
3. **`wait_cycles(n)`.** Add `task automatic wait_cycles(input int n);` with the body `repeat (n) ##1;`.

<details>
<summary>Why is rst_n in mon_cb but not in cb?</summary>

`rst_n` is asynchronous. A drive through `cb` waits for the next clocking event and lands in Re-NBA (§14.16), after the flops have already made their normal capture at that edge: the DUT would run one more edge than you asked for, and the release would always be aligned to an edge. So `main` writes `bus.rst_n` directly, between edges (step 5). The monitor still needs to know whether a sample was taken in reset, so `mon_cb` samples it.

`mon_cb` has inputs only, so code that uses it cannot drive anything. Writing an input clockvar, or reading an output clockvar, is illegal (§14.3): that is why the monitor can read `mon_cb.in_vld` but could not read `cb.in_vld`.

</details>

<details>
<summary>Why default clocking, and why repeat (n) ##1 rather than ##(n)?</summary>

`##` counts clocking block events of the **default clocking**; without one in scope it does not compile (§14.11). The default applies in `pipe_if` and in what is nested inside it, not in `tb_top`, which instantiates it (§14.12). So `##` is legal in `wait_cycles` and nowhere in `tb_top`, which calls `bus.wait_cycles(n)` instead.

`##(n)` with an expression is legal SystemVerilog (§14.11). Verilator 5.052 stopped with an internal error on it during this lab's validation, so the lab uses `repeat (n) ##1;`, which means the same thing and compiles there too.

</details>

## Step 3: The driver

In `work/tb_top.sv`:

1. **`send(data)`.** Drive `bus.cb.in_vld <= 1'b1;` and `bus.cb.in_data <= data;`. Push the expectation:

   ```systemverilog
   exp_q.push_back(exp_t'{din: data, dout: model_rotl(data),
                          due: $time + SAMPLE_EDGES * CLK_PERIOD});
   ```

   Then wait with `@(bus.cb);`. `send` is called right after a clocking block event, at edge *k*, and returns at edge *k*+1, ready to drive the next item.
2. **`idle(n)`.** Drive `bus.cb.in_vld <= 1'b0;`, then `repeat (n) @(bus.cb);`.

Code-review rules from F4C: no `@(posedge clk)` in testbench code, no raw write to `bus.in_vld` or `bus.in_data`, and every synchronous drive uses `<=`, its only form (§14.16).

<details>
<summary>Why wait on @(bus.cb) and not on @(posedge clk)?</summary>

A process woken by `@(posedge clk)` runs in the Active region with the DUT's flops, in an order the simulator chooses (§4.7). For a drive through `cb` that is harmless, because the drive matures in Re-NBA whatever order the processes run in. A **read** of a clockvar there is not: the process may run before or after the block stores the new samples (§14.13). Waiting on the event of the block you use avoids both questions. Make it a habit for drives too, so that every testbench process keeps the same rhythm.

</details>

## Step 4: The monitor

Fill in `monitor()`. Inside `forever`:

1. Wait with `@(bus.mon_cb);` and read nothing but `bus.mon_cb`.
2. If `bus.mon_cb.rst_n !== 1'b1`, `continue`: ignore samples taken in reset.
3. If `$isunknown(bus.mon_cb.out_vld)`, count a failure with `$error`.
4. Otherwise, if `out_vld` is 1: with an empty `exp_q`, count a failure ("nothing was sent"); else pop the oldest expectation `e` and count a failure if `$time != e.due` (wrong cycle) or if `bus.mon_cb.out_data !== e.dout` (wrong value). Count `pass_cnt++` and print a `PASS` line otherwise.

`initial monitor();` is already there, so the monitor runs for the whole simulation.

<details>
<summary>Why check the arrival time? The queue already keeps the order.</summary>

A queue checks order and values, not cycles. A result that arrives one cycle late, or one cycle early, still pops the right expectation and matches it. Step 6 shows a DUT that is one register too long passing a value-only check, and step 7 shows a racy bench whose results all arrive one cycle early passing it too. The DUT's latency is part of its specification (R2), so the bench checks it.

Reading `$time` in the monitor and in `send` is deterministic: both run after a clocking block event of the same clock, and time does not depend on process order. The scoreboard queue is shared by the two threads, which is safe only because a result is never checked in the same time slot as its own push: here they are four edges apart (F4C, "One clock, many testbench threads").

</details>

## Step 5: Reset, drain, verdict and watchdog

1. **`report()`.** Before the `PASS=%0d FAIL=%0d` line: add `exp_q.size()` to `fail_cnt` (with an `$error`), because those results never arrived; and if `pass_cnt == 0 && fail_cnt == 0`, count a failure.
2. **`main`.** Replace the starter's three lines with a `fork`. Its first branch:

   ```systemverilog
   bus.cb.in_vld <= 1'b0;             // no clocking event yet: lands at the 5 ns edge
   #12 bus.rst_n = 1'b1;              // asynchronous: written directly, between edges
   @(bus.cb);                         // the 15 ns edge
   run_test();
   bus.wait_cycles(SAMPLE_EDGES + 2); // the last result, then two quiet edges
   ```

   A drive executed between clocking events acts as if it had been executed at the next one (§14.16), which is why the time-0 drive lands at 5 ns. The second branch is the watchdog: `#(TIMEOUT);`, `fail_cnt++;`, `report();`, `$fatal(1, ...)`. Close with `join_any` (§9.3.2), then `disable fork;` (§9.6.3), `report();` and `$finish;`.

## Expected log

Captured from Verilator 5.052 with the reference solution and `.BUG(0)`, without Verilator's own `$finish` lines:

```text
55 ns PASS in=01 out=02
65 ns PASS in=80 out=01
75 ns PASS in=c3 out=87
105 ns PASS in=5a out=b4
115 ns PASS in=ff out=ff
PASS=5 FAIL=0
```

The run ends at 155 ns. Check the first line against the timing rule: `send(8'h01)` drives after the 15 ns edge, the DUT accepts it at 25 ns, the output register takes it at 45 ns, and `mon_cb` sees it at 55 ns. The gap from 75 to 105 ns is the two `idle` cycles.

## Step 6: Prove that the bench can fail

Plant each bug, **predict** the summary line, run, then compare with the table.

1. **`BUG=1`, shift instead of rotate.** In `tb_top`, change `.BUG(0)` to `.BUG(1)`: bit 7 is lost and bit 0 becomes 0. Which of the five items have bit 7 set?
2. **`BUG=2`, one register too many.** Set `.BUG(2)`: every result is right, one edge late.
3. **A value-only check.** Keep `.BUG(2)` and, in your monitor, change `if ($time != e.due)` to `if (1'b0)`. Run again. Then restore the check.
4. **Your own bug: rotate right.** Set `.BUG(0)` and, in `work/rot_pipe.sv`, change `{in_data[6:0], in_data[7]}` to `{in_data[0], in_data[7:1]}`. Which item can never catch this bug?
5. Undo your bug, set `.BUG(0)` and rerun: `PASS=5 FAIL=0`.

Summary lines, captured from Verilator 5.052:

| DUT | Time check on | Time check off |
|---|---|---|
| correct | `PASS=5 FAIL=0` | `PASS=5 FAIL=0` |
| `BUG=1` (shift) | `PASS=2 FAIL=3` | `PASS=2 FAIL=3` |
| `BUG=2` (late) | `PASS=0 FAIL=5` | `PASS=5 FAIL=0`, escapes |
| rotate right | `PASS=1 FAIL=4` | `PASS=1 FAIL=4` |

`BUG=1`, captured from Verilator 5.052. Here `[error @ t]` stands for your simulator's own `$error` prefix, which includes the time, file and line:

```text
55 ns PASS in=01 out=02
[error @ 65 ns] CHK in=80: out=00, expected 01
[error @ 75 ns] CHK in=c3: out=86, expected 87
105 ns PASS in=5a out=b4
[error @ 115 ns] CHK in=ff: out=fe, expected ff
PASS=2 FAIL=3
```

`BUG=2`:

```text
[error @ 65 ns] CHK in=01: result at 65 ns, expected at 55 ns
[error @ 75 ns] CHK in=80: result at 75 ns, expected at 65 ns
[error @ 85 ns] CHK in=c3: result at 85 ns, expected at 75 ns
[error @ 115 ns] CHK in=5a: result at 115 ns, expected at 105 ns
[error @ 125 ns] CHK in=ff: result at 125 ns, expected at 115 ns
PASS=0 FAIL=5
```

What the table teaches:

- **A bug hides from stimulus that does not provoke it.** `BUG=1` changes only items with bit 7 set: `01` and `5A` pass. `FF` rotated right is still `FF`, so the all-ones item cannot catch the rotate-right bug.
- **A latency bug hides from a value-only check.** With the time check off, the late DUT passes every item. The next step shows that a testbench race can hide the same way.

## Step 7: Prove that a bench without clocking blocks races

`work/tb_racy.sv` runs the same five items with the same checks, value and time, but it has no interface and no clocking blocks. Its driver is the pattern F4C converts:

```systemverilog
// snippet: the racy driver in tb_racy.sv (do not copy)
@(posedge clk);          // wakes with the DUT's flops
in_vld  = 1'b1;          // blocking writes at the edge the flops sample
in_data = data;
```

At that edge the driver and the DUT's `always_ff` are both ready in the Active region, and the standard lets the simulator run them in either order (§4.7):

| Order | What the flops capture at edge *k* | When the result is seen | Verdict |
|---|---|---|---|
| the flops first | the old inputs; the item is accepted at *k*+1 | edge *k*+4, as `due` says | `PASS=5 FAIL=0` |
| the driver first | the new inputs; the item is accepted at *k* | edge *k*+3, one cycle early | `PASS=0 FAIL=5` |

1. Compile `work/rot_pipe.sv` with `work/tb_racy.sv` (top `tb_racy`) and run it. Note which order your simulator picked.
2. Run it again with `+DUT_FIRST`. That replays the "flops first" order on any simulator: the driver writes with `<=` instead, and a nonblocking update lands in the NBA region, after every Active-region process, the flops included, has read the old value (§4.4.2.4). The flops therefore see exactly what they see when they run before the blocking writes.

Captured from Verilator 5.052, which ran the driver first in this bench:

```text
[error @ 45 ns] CHK in=01: result at 45 ns, expected at 55 ns
[error @ 55 ns] CHK in=80: result at 55 ns, expected at 65 ns
[error @ 65 ns] CHK in=c3: result at 65 ns, expected at 75 ns
[error @ 95 ns] CHK in=5a: result at 95 ns, expected at 105 ns
[error @ 105 ns] CHK in=ff: result at 105 ns, expected at 115 ns
PASS=0 FAIL=5
```

With `+DUT_FIRST`:

```text
55 ns PASS in=01 out=02
65 ns PASS in=80 out=01
75 ns PASS in=c3 out=87
105 ns PASS in=5a out=b4
115 ns PASS in=ff out=ff
PASS=5 FAIL=0
```

Then answer:

<details>
<summary>Is the racy bench wrong, or the simulator?</summary>

The bench. Both orders are legal, so both verdicts are legal results of the same code: that is the definition of a race. Your simulator may well run the flops first and print `PASS=5 FAIL=0` on every run, and the bench is still broken: another simulator, another version, or an unrelated edit can change the order. Note also what the race looks like: every value is right and every result is one cycle early, so a value-only scoreboard would pass in both orders and the race would never be seen.

</details>

<details>
<summary>Why does your tb_top give PASS=5 FAIL=0 in every order?</summary>

Its driver never writes a DUT input in the Active region. `bus.cb.in_vld <= 1'b1` matures in the Re-NBA region (§14.16), after the flops have read their inputs, whatever order the processes ran in. Its monitor never reads a live signal: it reads `mon_cb`'s `#1step` samples after the clocking block event (§14.13). Neither result depends on process order, so there is only one legal verdict.

</details>

<details>
<summary>Why is tb_racy a separate file, and not a +RACY switch in tb_top?</summary>

A variable that a clocking block drives may also be written by ordinary procedural assignments (§14.16.2), so a switch would be legal. But a synchronous drive and a nonblocking assignment to one variable in one time step take effect in an arbitrary order (§14.16.2), and F4C's advice is to give such a variable one kind of writer. During validation, Verilator 5.052 warned (`MULTIDRIVENPROC`) about a `tb_top` that mixed both kinds of writes on `in_vld`, and its result changed between builds of the same source. A separate bench keeps the experiment clean.

</details>

## Running the lab

Compile the DUT, the interface and one testbench, then run `tb_top` (nothing instantiates it, so it is the top). These are typical invocations; check your simulator's documentation, because options differ between tools and versions.

```bash
# Synopsys VCS
vcs -sverilog work/rot_pipe.sv work/pipe_if.sv work/tb_top.sv
./simv

# Siemens Questa
vlib work
vlog work/rot_pipe.sv work/pipe_if.sv work/tb_top.sv
vsim -c tb_top -do "run -all; quit"

# Cadence Xcelium
xrun work/rot_pipe.sv work/pipe_if.sv work/tb_top.sv

# Verilator 5 (open source): the commands used to capture this README's logs
verilator --binary --timing -Wno-fatal --top-module tb_top work/rot_pipe.sv work/pipe_if.sv work/tb_top.sv
./obj_dir/Vtb_top +verilator+error+limit+100
```

For step 7, compile `work/rot_pipe.sv` with `work/tb_racy.sv` only, with top `tb_racy`, and pass `+DUT_FIRST` for the second run. For the reference solution, use `solution/pipe_if.sv` and `solution/tb_top.sv` instead of the `work/` copies. Add `+DUMP` to `tb_top` to write `tb_top.vcd` for a waveform viewer.

Notes on the open-source route:

- **Verilator** needs version 5 with `--timing` for the delays, the clocking blocks, `fork ... join_any` and `disable fork`. By default its `$error` stops the run at the first failure; `+verilator+error+limit+100` lets the run continue, so step 6 and step 7 show every failure and the summary line. It is a 2-state simulator: x becomes a known value, so the `$isunknown` and `!==`-on-x checks never fire there. With `-Wall` it also warns (`UNDRIVEN`, `UNUSEDSIGNAL`) about interface signals that are driven or read only through the clocking blocks; those warnings do not stop the run.
- **Icarus Verilog** is not listed: its support for clocking blocks, `##` and the other constructs here was not checked for this lab.
- Without a local simulator, EDA Playground runs the lab in a browser: put `rot_pipe` in the design pane and `pipe_if` with `tb_top` in the testbench pane.

## How a run reports PASS or FAIL

- **The summary line is the verdict.** Each run prints exactly one `PASS=<n> FAIL=<m>` line, and a clean run matches `^PASS=\d+ FAIL=0$`. A missing line (a crash, a killed job) is a failure.
- **`$error`** reports a failed check and lets the run continue (on Verilator, with the error-limit option above). **`$fatal`** ends the run at once and is for a broken bench, here the watchdog (§20.10). **`$finish`** ends a normal run.
- **Exit status is tool-dependent.** Decide PASS or FAIL from the summary line, not from the process exit status.

## How the step checks work

The site's checks for steps 2 to 5 read the structure of your `pipe_if.sv` and `tb_top.sv`, with comments ignored: for example, that `cb` is the default clocking with `#1step` and `#0` skews and no `rst_n` output, that `mon_cb` has inputs only, that `send` drives only through `bus.cb` and records a due time, that the monitor waits on `@(bus.mon_cb)`, reads only `mon_cb` and compares the arrival time, that no testbench code waits on `@(posedge clk)` or uses `##`, and that `main` releases reset directly and races the test against a watchdog. They do not compile or simulate your code. The simulator runs, the expected log and the failures in steps 6 and 7 are the real check.

## Completion checklist

- [ ] `cb` is the default clocking, samples `#1step`, drives `#0`, and does not list `rst_n`.
- [ ] `mon_cb` has inputs only, `rst_n` among them.
- [ ] Every DUT input except `rst_n` is written only through `bus.cb`, with `<=`.
- [ ] Every clockvar read follows `@(bus.cb)` or `@(bus.mon_cb)`; `tb_top` contains no `@(posedge clk)` and no `##`.
- [ ] Every result is checked for its value with `!==` and for its arrival time against `due`.
- [ ] Leftover expectations and a run that checked nothing count as failures; a watchdog ends a hung run with `$fatal`.
- [ ] With `.BUG(0)` the log ends `PASS=5 FAIL=0`.
- [ ] I have seen `FAIL` greater than 0 for `BUG=1`, `BUG=2` and my own bug, and I know which item cannot catch a rotate-right bug.
- [ ] I have run `tb_racy` with and without `+DUT_FIRST`, and I can explain from §4.7 why it has two legal verdicts while `tb_top` has one.

> **Ready to compare?** Open `solution/pipe_if.sv` and `solution/tb_top.sv` after you finish. From Tier 2 on, the driver and the monitor become classes that reach `cb` and `mon_cb` through a virtual interface, as F4C's class preview shows; the timing you practised here does not change.
