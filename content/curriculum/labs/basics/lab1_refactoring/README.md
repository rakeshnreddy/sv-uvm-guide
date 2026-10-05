# Lab: Refactor repeated stimulus into a task

This lab belongs to module F2D. Do it after the Tasks and Functions lesson (`/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/tasks-functions`).

You start from a short testbench whose `initial` block repeats one stimulus pattern three times. You turn that pattern into a single `task automatic` with arguments, remove a drive race on the way, and make the testbench check its own results.

## What you will practise

- Write a `task automatic` with `input` arguments and a default argument value, and call it with positional and named arguments (IEEE 1800-2023 §13.3, §13.3.1, §13.5.3, §13.5.4).
- Explain why `byte payload = start_value;` is legal inside an automatic task but not inside a static one (§6.21).
- Drive DUT inputs with nonblocking assignments (`<=`) after `@(posedge clk)`, and explain the race that a blocking drive (`=`) creates (§4.7).
- Make the testbench self-checking: a reference model, a `!==` comparison and a `PASS=<n> FAIL=<m>` summary.

## Files

- `work/dut_counter.sv`: the DUT, an 8-bit accumulator. On every rising clock edge where `enable` is 1, `count` adds `data`. The sum is 8 bits wide, so it wraps modulo 256. The active-low `rst_n` clears it.
- `work/tb_counter_unrefactored.sv`: the starting testbench, with three copy-pasted stimulus scenarios.
- `solution/tb_counter_refactored.sv`: one reference solution. Open it only after you finish.

All three files start with `` `timescale 1ns/1ps ``. Keep it that way: mixing files that set a time unit with files that do not is an error (§3.14.2.3), although some tools only warn.

## Step 1: Run the starter and record the counts

Compile `work/dut_counter.sv` together with `work/tb_counter_unrefactored.sv`, run the simulation and write down the three counts it prints.

The starter drives `enable` with a blocking assignment (`enable = 1;`) right after `@(posedge clk)`, at 45, 95 and 165 ns, and clears it the same way at 75, 145 and 245 ns. The DUT's `always_ff` wakes on the same edges, and IEEE 1800-2023 lets a simulator run the two processes in either order (§4.7):

| Who runs first at the racing edges | Counts printed |
|---|---|
| the DUT: it still sees the old `enable` | 6, 106, 190 |
| the testbench: the DUT sees the new `enable` | 4, 96, 159 |

Mixed orders give other values. Your simulator prints one of these sets, and another simulator, or the same one after a file is reordered, may print another. Explain which edges race and why. Lesson F3C (Delta Cycles and Race Conditions) covers this race in depth.

## Step 2: Write the task

In `work/tb_counter_unrefactored.sv`, write:

```systemverilog
task automatic drive_sequence(input byte         start_value,
                              input int unsigned repeat_count,
                              input byte         step = 8'h01);
```

The task:

1. declares `byte payload = start_value;` before its first statement;
2. waits for `@(posedge clk)`, then drives `enable <= 1'b1;` and `data <= payload;`;
3. on each of `repeat_count` clock edges, waits for `@(posedge clk)`, adds `step` to `payload` and drives `data <= payload;`;
4. drives `enable <= 1'b0;`, waits for one more edge and prints `[Task] start=... step=... count=...`, with `%0h` for the first two values and `%0d` for the count.

Then answer: why would `byte payload = start_value;` stop compiling if you removed `automatic`? (Without it the task is static, so `payload` is a static variable with an initializer, which needs an explicit `static` keyword: §6.21.)

## Step 3: Replace the three blocks with calls

Replace the three copy-pasted scenarios with three calls:

```systemverilog
drive_sequence(8'h01, 3);                                            // default step
drive_sequence(8'h10, 5, 8'h02);                                     // by position
drive_sequence(.start_value(8'h20), .repeat_count(8), .step(8'h03)); // by name
```

Run again. Every drive now uses `<=`, so every simulator prints the counts 6, 106 and 190.

## Step 4: Make the testbench check itself

1. Keep a reference model: a variable `exp_count` that starts at 0 with the reset, and a `function automatic` that adds one burst's values (`start_value`, `start_value + step`, and so on, `repeat_count` of them) modulo 256.
2. After each burst, compare `count !== exp_count`, count passes and failures, and report each failure with `$error`.
3. At the end, print `PASS=<n> FAIL=<m>` and call `$finish`.
4. Prove that the check works: change the DUT to `count <= count + data + 1;`, confirm that `FAIL` is no longer 0, then undo the change.

## Expected log

With the reference solution, worked out by hand from the IEEE 1800-2023 rules rather than captured from a simulator:

```text
[Task] start=1 step=1 count=6
[Task] start=10 step=2 count=106
[Task] start=20 step=3 count=190
PASS=3 FAIL=0
```

Your simulator's `$finish` report follows. The third count is 190 because the total, 446, wraps modulo 256.

## Running the lab

Compile the DUT and one testbench with your simulator's SystemVerilog option, then run the top module: `tb_counter_unrefactored` for your work, or `tb_counter_refactored` for the reference solution (compile `work/dut_counter.sv` with `solution/tb_counter_refactored.sv`). The commands differ between tools; these vendor examples compile and run the starter:

```bash
# Synopsys VCS
vcs -sverilog work/dut_counter.sv work/tb_counter_unrefactored.sv -o simv
./simv

# Siemens Questa
vlog work/dut_counter.sv work/tb_counter_unrefactored.sv
vsim -c tb_counter_unrefactored -do "run -all; quit"

# Cadence Xcelium
xrun work/dut_counter.sv work/tb_counter_unrefactored.sv
```

## Completion checklist

- [ ] The `initial` block calls `drive_sequence` three times and repeats no stimulus code.
- [ ] `drive_sequence` is `automatic`, takes `input` arguments with a default for `step`, and drives `enable` and `data` only with `<=`.
- [ ] One call uses the default `step`, and one binds its arguments by name.
- [ ] The log shows the counts 6, 106 and 190 and ends with `PASS=3 FAIL=0`.
- [ ] With the DUT bug injected, `FAIL` is not 0.

> **Ready to compare?** Open `solution/tb_counter_refactored.sv` after you finish.
