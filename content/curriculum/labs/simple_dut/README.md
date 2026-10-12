# Lab: Your first self-checking testbench

This lab belongs to module F2E. Do it after [F2E: Your First Self-Checking Testbench](/curriculum/T1_Foundational/F2E_First_Self_Checking_Testbench/index). It is milestone M0 of the course: a directed testbench, without UVM, that decides PASS or FAIL by itself.

F2E builds a bench for `adder_reg`, a registered adder. Here you build the same bench, piece by piece, for its sibling `sat_adder_reg`, whose sum **saturates** at 255 instead of growing a carry bit. The names (`tb_top`, `send`, `idle`, `exp_q`, `check_result`, `report`, `drain`) are F2E's, so you can look back at the lesson whenever you get stuck. The model is new: you write it from this README's specification.

## What you will practise

- A clock with a known start value and a reset released with `<=` just after an edge.
- Stimulus tasks that drive DUT inputs with nonblocking assignments, so the DUT samples them on the next edge whatever order the simulator runs its processes in (IEEE 1800-2023 §4.7, §4.9.4).
- A reference model written from the specification, and an expected-value queue (`push_back` when you drive, `pop_front` when a result arrives).
- A checker that samples on every rising clock edge, compares with `!==` and counts passes and failures.
- Directed tests chosen from a plan, selected at run time with `+TEST=`.
- A verdict: one `PASS=<n> FAIL=<m>` line, leftovers and empty runs counted as failures, a watchdog that ends a hung run with `$fatal`, and `$finish`.
- Proof that the bench can fail: planted bugs, and the test that catches each one.

## Files

- `work/sat_adder_reg.sv`: the DUT. Read its specification below, not its RTL, when you write the model.
- `work/tb_top.sv`: the starter testbench. It compiles and runs, but checks nothing. Each `TODO step N` comment marks code you write in step N.
- `solution/tb_top.sv`: one reference solution. Open it only after you finish.

Both `tb_top.sv` files contain a module named `tb_top`, F2E's name, so compile the DUT with one of them, never both. Every module declares `timeunit 1ns; timeprecision 1ps;`: a design in which some modules have a time unit and others do not is an error (§3.14.2.3).

## The DUT: a registered saturating adder

| Port | Direction | Meaning |
|---|---|---|
| `clk` | input | Clock. Everything happens on its rising edge. |
| `rst_n` | input | Synchronous reset, active low. |
| `in_valid` | input | `a` and `b` hold an addition to perform this cycle. |
| `a`, `b` | input, 8 bits | The operands. |
| `out_valid` | output | `sum` holds a new result. |
| `sum` | output, 8 bits | `a + b`, or 255 when `a + b` does not fit in 8 bits. |

On every rising edge of `clk`:

- **R1.** If `rst_n` is 0, `out_valid` becomes 0 and `sum` becomes 0.
- **R2.** Otherwise `out_valid` becomes the value of `in_valid`: one result per valid input, one cycle later.
- **R3.** If `in_valid` is 1, `sum` becomes `a + b` when that is at most 255, and 255 when it is larger.
- **R4.** If `in_valid` is 0, `sum` keeps its value.

Only R3 differs from F2E's `adder_reg`. The parameter `BUG` plants a known bug for step 7; leave it at 0 until then.

## Step 1: Run the starter

Compile `work/sat_adder_reg.sv` with `work/tb_top.sv` (commands under [Running the lab](#running-the-lab)) and run with no plusargs. Worked out from the code, not captured from a run, the starter prints:

```text
0 ns TEST smoke
0 ns TEST corners
0 ns TEST gaps
PASS=0 FAIL=0
```

Your simulator adds its own banner and `$finish` lines. Before you read on: the line matches `PASS=<n> FAIL=0`. Is it a pass?

<details>
<summary>Answer: a vacuous pass</summary>

No. Nothing ran: there is no clock, the tasks are empty, and the whole run takes 0 ns. Nothing was compared either, so the counters are still 0. A script that looks only for `FAIL=0` would mark this run green. Step 6 makes `report()` turn "nothing was checked" into a failure. The old version of this lab had exactly this hole.

</details>

## Step 2: Clock and reset

1. Change `logic clk;` to `logic clk = 1'b0;` and add `always #5 clk = ~clk;`: a 10 ns period with rising edges at 5, 15, 25 ns. Without the initializer `clk` starts at x, `~x` is x, and the clock never toggles (§6.8).
2. Fill in `reset_dut`: drive `rst_n`, `in_valid`, `a` and `b` low with `<=`, wait `repeat (cycles) @(posedge clk);`, then release with `rst_n <= 1'b1;`.

<details>
<summary>Why release reset with <= ?</summary>

The DUT's `always_ff` reads `rst_n` on the same edge that resumes `reset_dut`. A blocking `rst_n = 1'b1;` changes the variable at once, so the DUT leaves reset on that edge or on the next one, depending on which process the simulator runs first (§4.7). A nonblocking assignment schedules its update as an NBA event (§4.9.4), after the processes woken by the edge have read the old value, so the DUT always sees the release on the next edge.

</details>

## Step 3: Reference model and drive tasks

1. **The model.** Write `model_sat_add(op_a, op_b)` from R3. Widen both operands to 9 bits (`{1'b0, op_a}`), add, and return `MAX_SUM[W-1:0]` (255) when the total is larger than `MAX_SUM`, otherwise the low 8 bits of the total. Do not copy the RTL: if the model repeats the design's expression, it repeats its bugs and can never disagree with it.
2. **`send(a_val, b_val)`.** Wait for `@(posedge clk)`, drive `in_valid <= 1'b1;`, `a <= a_val;`, `b <= b_val;`, then push the expectation:

   ```systemverilog
   exp_q.push_back(exp_t'{a: a_val, b: b_val, sum: model_sat_add(a_val, b_val)});
   ```

3. **`idle(n)`.** For `n` rising edges, drive `in_valid <= 1'b0;`.

Code-review rule from F2E: no `=` to a DUT input after `@(posedge clk)`.

## Step 4: The checker

1. **`check_result(actual)`.** If `exp_q.size() == 0`, count a failure with `$error` and return: a result nobody sent is a bug, and `pop_front` on an empty queue returns an all-x default value (§7.10.2.4). Otherwise pop the oldest expectation, compare `actual !== e.sum`, and count `pass_cnt++` or `fail_cnt++` with an `$error` that names `a`, `b`, the actual and the expected sum.
2. **The checker process.** Add `always @(posedge clk)`: while `rst_n` is low, do nothing; after reset, count a failure if `$isunknown(out_valid)`, otherwise call `check_result(sum)` when `out_valid` is 1. Use `always`, not `always_ff`: the checker writes `fail_cnt`, which `report()` also writes, and `always_ff` forbids that (§9.2.2.4).

Then answer: the old version of this lab checked with `always @(y)`, which wakes whenever the output changes. Why is that not a checker?

<details>
<summary>Answer: an event on a value fires only when the value changes</summary>

`@(sum)` waits for a change in the value of `sum` (§9.4.2). A result equal to the previous one is never compared, and a DUT whose output is stuck at a wrong value is never compared at all. In `test_corners` the seven results are 0, 255, 255, 255, 255, 255 and 200. After reset `sum` is already 0, so `sum` changes only twice, and only two of the seven results would wake the checker. The old lab had no queue and no count of unchecked results, so those misses passed silently. Sample on every rising edge and let `out_valid` say when a result is there.

Two more ways a check passes silently: `!=` instead of `!==` (an x bit makes the condition x, and `if` takes the `else` branch; §11.4.5, §12.4), and `if (out_valid)` with `out_valid` at x, which skips the compare. That is why the checker tests `$isunknown(out_valid)` first.

</details>

## Step 5: Directed tests from the plan

`test_smoke` is written for you. Write the other two from this plan:

| Plan row (rule) | Test | Stimulus | The check proves |
|---|---|---|---|
| R3 for ordinary values | `smoke` | 1 + 2, 10 + 20, 100 + 27 | the basic path works end to end |
| R3 at the saturation boundary | `corners` | 0 + 0, 255 + 0, 200 + 55 (255, the largest sum that fits), 200 + 56 (256, the smallest that saturates), 128 + 128, 255 + 255, then 100 + 100 | results stop at 255 exactly where they should, and an unsaturated result follows a saturated one |
| R2: one result per valid input | `gaps` | 5 + 5, two idle cycles, 7 + 8 and 9 + 10 back to back, one idle cycle, 11 + 12 | `out_valid` follows `in_valid` one cycle later, with no extra or missing result |

End every test with `idle(1)`. Otherwise `in_valid` stays 1 and the DUT keeps producing results that nobody sent. Pairs that sum to exactly 255 and 256 test both sides of the boundary, so a threshold that is off by one cannot slip through.

## Step 6: Verdict, drain and watchdog

1. **`report()`.** Before the `PASS=%0d FAIL=%0d` line: add `exp_q.size()` to `fail_cnt` (with an `$error`), because those are results that never arrived; and if `pass_cnt == 0 && fail_cnt == 0`, count a failure, because a run that checked nothing proves nothing.
2. **`drain()`.** Wait at the falling edge, at most `max_cycles` times, until `exp_q` is empty, then wait two more falling edges, so that a late or extra result still fails. At the falling edge the checker is not running. Never write `while (exp_q.size() != 0);`: a loop with no delay never lets time advance, and not even the watchdog can stop it.
3. **The watchdog.** In `main`, make the run (`reset_dut()` to `drain()`) the first branch of a `fork`. The second branch waits `#(TIMEOUT)`, counts the hang with `fail_cnt++`, calls `report()` and ends the run with `$fatal(1, "WDOG ...")`. Close with `join_any`, which resumes `main` when either branch ends (§9.3.2), then `disable fork` to stop the watchdog (§9.6.3), then `report()` and `$finish`.

Without `$finish` this bench would never end: the free-running clock is activity forever, and a simulation only stops by itself when there is no further activity of any kind (§9.6.1).

## Expected log

Run with no plusargs. Worked out from the code with a cycle model, not captured from a simulator run:

```text
15 ns TEST smoke
55 ns TEST corners
135 ns TEST gaps
PASS=14 FAIL=0
```

The run ends at 250 ns: the last result is checked at 225 ns, `drain()` finds the queue empty at 230 ns, and two quiet falling edges follow. `+TEST=corners` alone ends `PASS=7 FAIL=0`, `+TEST=smoke` ends `PASS=3 FAIL=0` and `+TEST=gaps` ends `PASS=4 FAIL=0`. An unknown name, such as `+TEST=corner`, stops the run at once with the `TEST unknown test` fatal.

## Step 7: Prove that the bench can fail

A test you have never seen fail is no evidence. Plant each bug, **predict** which tests catch it, run, then compare with the table.

1. **`BUG=1`, sums wrap instead of saturating.** In `tb_top`, change `.BUG(0)` to `.BUG(1)`. The DUT now computes `a + b` at 8 bits, so the carry is lost: the interim result takes the size of the largest operand, here the 8-bit target (§11.6). Run `+TEST=smoke`, then `+TEST=corners`.
2. **`BUG=2`, a result every cycle.** Set `.BUG(2)`: `out_valid` is 1 on every cycle after reset. Run `+TEST=smoke`.
3. **Your own bug: bit 7 of `sum` stuck at 0.** Set `.BUG(0)` and, in `work/sat_adder_reg.sv`, add `next_sum[W-1] = 1'b0;` as the last statement of the `always_comb` block. Run each test.
4. Remove your bug, set `.BUG(0)` again and rerun with no plusargs: `PASS=14 FAIL=0`. A planted bug proves the bench, then it goes.

Summary lines, worked out with the same cycle model:

| `+TEST=` | correct DUT | `BUG=1` (wraps) | `BUG=2` (result every cycle) | bit 7 stuck at 0 |
|---|---|---|---|---|
| `smoke` | `PASS=3 FAIL=0` | `PASS=3 FAIL=0`, escapes | `PASS=0 FAIL=5` | `PASS=3 FAIL=0`, escapes |
| `corners` | `PASS=7 FAIL=0` | `PASS=4 FAIL=3` | `PASS=5 FAIL=4` | `PASS=1 FAIL=6` |
| `gaps` | `PASS=4 FAIL=0` | `PASS=4 FAIL=0`, escapes | `PASS=0 FAIL=9` | `PASS=4 FAIL=0`, escapes |
| (none: all) | `PASS=14 FAIL=0` | `PASS=11 FAIL=3` | `PASS=4 FAIL=17` | `PASS=8 FAIL=6` |

`BUG=1` with `+TEST=corners`. Here `[error @ t]` stands for your simulator's own `$error` prefix, which includes the time, file and line:

```text
15 ns TEST corners
[error @ 75 ns] CHK a=200 b=56: sum=0, expected 255
[error @ 85 ns] CHK a=128 b=128: sum=0, expected 255
[error @ 95 ns] CHK a=255 b=255: sum=254, expected 255
PASS=4 FAIL=3
```

`BUG=2` with `+TEST=smoke`:

```text
15 ns TEST smoke
[error @ 35 ns] CHK a=1 b=2: sum=0, expected 3
[error @ 45 ns] CHK a=10 b=20: sum=3, expected 30
[error @ 55 ns] CHK a=100 b=27: sum=30, expected 127
[error @ 65 ns] CHK unexpected result sum=127: nothing was sent
[error @ 75 ns] CHK unexpected result sum=127: nothing was sent
PASS=0 FAIL=5
```

What the table teaches:

- **The wrap bug is quiet.** `smoke` and `gaps` never add up to more than 255, so a wrapping DUT and a saturating one give the same answers there. Only `corners` provokes the bug: a directed test catches only the bugs its stimulus provokes.
- **The extra-result bug is loud.** Every test catches it. Each actual value equals the previous expected value, and the queue runs dry, so results nobody sent are reported.
- **Bit 7 stuck at 0 escapes `smoke` and `gaps`,** whose results are all below 128. Count the failures in `corners`: six of its seven results have bit 7 set.

## Running the lab

Compile the DUT and one testbench, then run `tb_top` (nothing instantiates it, so it is the top). These are typical invocations; check your simulator's documentation, because options differ between tools and versions.

```bash
# Synopsys VCS
vcs -sverilog work/sat_adder_reg.sv work/tb_top.sv
./simv +TEST=corners

# Siemens Questa
vlib work
vlog work/sat_adder_reg.sv work/tb_top.sv
vsim -c tb_top +TEST=corners -do "run -all; quit"

# Cadence Xcelium
xrun work/sat_adder_reg.sv work/tb_top.sv +TEST=corners

# Verilator 5 (open source)
verilator --binary --timing -Wno-fatal --top-module tb_top work/sat_adder_reg.sv work/tb_top.sv
./obj_dir/Vtb_top +TEST=corners
```

Leave out `+TEST=...` to run every test, and add `+DUMP` to write `tb_top.vcd` for a waveform viewer. For the reference solution, replace `work/tb_top.sv` with `solution/tb_top.sv`.

Notes on the open-source route. This lab was not run on any simulator.

- **Verilator** needs version 5 with timing support (`--timing`) for the `#` delays, the clock-edge waits inside tasks, `fork ... join_any` and `disable fork`. `--binary` builds an executable in `obj_dir/`. Verilator stops on warnings unless you pass `-Wno-fatal`. It is a 2-state simulator: x becomes a known value, so the `$isunknown` and `!==`-on-x checks can never fire there, and the starter's `return 'x;` returns a known value. Use a 4-state simulator to see X failures.
- **Icarus Verilog** is not listed, because its support for every construct this bench uses was not confirmed: an unpacked struct (`exp_t`), a queue of that struct, the assignment pattern `exp_t'{a: ..., b: ..., sum: ...}` and a `realtime` parameter with a time literal (`10us`). Check your version before you try `iverilog -g2012`.
- Without a local simulator, EDA Playground runs the lab in a browser: put `sat_adder_reg` in the design pane and `tb_top` in the testbench pane, and pass the plusargs in the run options.

## How a run reports PASS or FAIL

- **The summary line is the verdict.** Each run prints exactly one `PASS=<n> FAIL=<m>` line, and a clean run matches `^PASS=\d+ FAIL=0$`. A missing line (a crash, a killed job) is a failure. Some simulators prefix every transcript line (for example with `# `), so strip the prefix before you match.
- **`$error`** reports a failed check and lets the run continue, so one run shows every failure. **`$fatal`** is for a broken bench (an unknown test, a timeout) and ends the run at once; it implies a call to `$finish` (§20.10). **`$finish`** ends a normal run and returns control to the operating system (§20.2).
- **Exit status is tool-dependent.** `$fatal` ends the simulation "with an error code" (§20.10), but the standard does not define the value, and `$finish` defines none. Decide PASS or FAIL from the summary line, not from the process exit status.

## How the step checks work

The site's checks for steps 2 to 6 read the structure of your `tb_top.sv`, with comments ignored: for example, that `clk` has an initial value, that `send` drives with `<=` and pushes the model's answer, that the checker runs on `@(posedge clk)` and compares with `!==`, that `test_corners` has pairs summing to 255 and to 256, and that `main` races the test against a watchdog with `join_any`. They do not compile or simulate your code. Passing them means the bench has the right shape; the simulator run, the expected log and the failures in step 7 are the real check.

## Completion checklist

- [ ] `clk` starts at 0, and reset is released with `<=` just after an edge.
- [ ] Every DUT input is driven with `<=` after `@(posedge clk)`.
- [ ] `model_sat_add` follows R3 and was written from the specification, not copied from the RTL.
- [ ] `send` pushes one expectation per transaction; the checker pops one per result, on `@(posedge clk)`, with `!==`.
- [ ] `out_valid` is tested with `$isunknown` after reset.
- [ ] Leftover expectations and a run that checked nothing count as failures.
- [ ] A watchdog ends a hung run with `$fatal`; a normal run ends with one summary line and `$finish`.
- [ ] With no plusargs the log ends `PASS=14 FAIL=0`.
- [ ] I have seen `FAIL` greater than 0 for `BUG=1`, `BUG=2` and my own bug, and I can name the test that catches each one.

> **Ready to compare?** Open `solution/tb_top.sv` after you finish.
