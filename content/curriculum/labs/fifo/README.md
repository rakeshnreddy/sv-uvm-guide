# Lab: A class-based bench for a synchronous FIFO

This lab belongs to module I-SV-1. Do it after [I-SV-1: Object-Oriented Programming for Verification](/curriculum/T2_Intermediate/I-SV-1_OOP/index), in particular its pages on constructors, polymorphism and `$cast`, and copying and cloning. It starts from the M0 bench of lab `simple-dut-1` (a reference model, an expected-value queue, one `PASS=<n> FAIL=<m>` line, a watchdog, planted bugs) and rebuilds it as **classes**: a transaction, a generator, a driver, a monitor and a scoreboard. Those are the roles a UVM environment gives to its components later in T2, so this is the bench you will map onto UVM.

There is no UVM, no randomization (I-SV-2A) and no mailbox (I-SV-5) here. The generator builds a list, the driver walks it, and the monitor hands each observation to the scoreboard by calling one of its methods.

## What you will practise

- A transaction class with `copy()`, `clone()` and `convert2string()`, all `virtual` (1800-2023 §8.20), and a derived class that overrides them, calls `super` (§8.15) and gets a derived handle back with `$cast` called as a function (§6.24.2, §8.16).
- The difference between copying a handle and copying an object (§8.12), seen twice: a generator that clones a blueprint, and a monitor that creates a new object on every clock edge.
- Classes that reach the DUT through a **virtual interface** (§25.9), driving with `<=` (§4.9.4).
- A scoreboard whose reference model is a queue (§7.10): the model, not the DUT's flags, decides which writes and reads are accepted.
- Full and empty corner cases, counted, so that a test that never reaches a corner cannot pass as if it had.
- Proof that the bench fails: two DUT bugs and two handle-aliasing bugs in the bench itself.

## Files

- `work/sync_fifo.sv`: the DUT. Write the model from the specification below, not from its RTL.
- `work/fifo_if.sv`: the interface that bundles the FIFO's signals. Given.
- `work/fifo_tb_pkg.sv`: the classes. It compiles and runs, but drives and checks nothing. Each `TODO step N` comment marks code you write in step N.
- `work/tb_top.sv`: the top module: clock, interface instance, DUT, test selection and watchdog. Given; you change only `.BUG(...)` in step 8.
- `solution/fifo_tb_pkg.sv`: one reference solution. Open it only after you finish.

Compile the four files in this order: `sync_fifo.sv`, `fifo_if.sv`, `fifo_tb_pkg.sv`, `tb_top.sv`. The package must be compiled before `tb_top`, which imports it. For the solution, replace `work/fifo_tb_pkg.sv` with `solution/fifo_tb_pkg.sv`. Every design element declares `timeunit 1ns; timeprecision 1ps;` (§3.14.2.3).

## The DUT: a 4-entry synchronous FIFO

| Port | Direction | Meaning |
|---|---|---|
| `clk` | input | Clock. Everything happens on its rising edge. |
| `rst_n` | input | Synchronous reset, active low. |
| `wr_en`, `wr_data` (8 bits) | input | Write `wr_data` this cycle. |
| `rd_en` | input | Read the oldest entry this cycle. |
| `rd_data` (8 bits) | output | The entry the last accepted read took. |
| `full`, `empty` | output | 4 entries held; 0 entries held. |

On every rising edge of `clk`, using the values the signals had just before it:

- **F1.** If `rst_n` is 0, the FIFO becomes empty and `rd_data` becomes 0.
- **F2.** A write is accepted when `wr_en` is 1 and `full` is 0: `wr_data` is stored behind the entries already held.
- **F3.** A read is accepted when `rd_en` is 1 and `empty` is 0: the oldest entry leaves the FIFO and `rd_data` takes its value. `rd_data` is registered, so the value is there one cycle after `rd_en`. Otherwise `rd_data` holds.
- **F4.** `wr_en` while full is ignored, even if a read is accepted on the same edge. `rd_en` while empty is ignored, even if a write is accepted on the same edge. A write and a read can both be accepted on one edge.
- **F5.** `full` is 1 exactly when 4 entries are held, `empty` exactly when none are. Both change only on a rising edge.

F4 is a choice of this specification. Some real FIFOs accept a write while full when a read frees a slot on the same edge; this one does not, and the bench must check what the specification says. The parameter `BUG` plants a known bug for step 8; leave it at 0 until then.

## The bench

| Class | Role | Reaches the DUT through |
|---|---|---|
| `fifo_item` | One cycle of stimulus: `wr_en`, `wr_data`, `rd_en`. | — |
| `fifo_obs extends fifo_item` | What the monitor saw on one edge: the three inputs, plus `rd_data`, `full`, `empty` and a cycle number. | — |
| `fifo_gen` | Builds `items[$]` for a test by editing one blueprint and storing a clone of it. | — |
| `fifo_drv` | Drives one item per clock. | `virtual fifo_if vif` |
| `fifo_mon` | On every edge after reset, copies the six signals into a new `fifo_obs` and calls `sb.write(o)`. | `virtual fifo_if vif` |
| `fifo_sb` | The reference model (`ref_q`), the checks, the corner counters and `report()`. | — |
| `fifo_env` | Creates the other classes and runs them. Given. | passes `vif` on |

`tb_top` instantiates the interface as `bus` and passes it to `new fifo_env(bus)`: the class gets a handle to that interface instance, not a copy of its signals.

## Step 1: Run the starter

Compile the four `work/` files and run without `+TEST=` (on Verilator, keep `+verilator+error+limit+1000`; see Running the lab). Captured from Verilator 5.052 (Verilator prints `$error` as `%Error: ... Assertion failed`, with the time in picoseconds):

```text
0 TEST all: 0 cycles of stimulus
CORNERS writes=0 reads=0 full=0 wr_full=0 rd_empty=0 rw_empty=0 rw_mid=0 rw_full=0
[40000] %Error: fifo_tb_pkg.sv:185: Assertion failed in fifo_tb_pkg.fifo_sb.report: CORNER a full/empty corner case was never exercised
[40000] %Error: fifo_tb_pkg.sv:189: Assertion failed in fifo_tb_pkg.fifo_sb.report: CHK no data was read back, so no data was checked
PASS=0 FAIL=2
```

<details>
<summary>Answer: two guards against a vacuous pass</summary>

`report()` is given, and it already refuses two kinds of empty run. With no `+TEST=`, every corner counter must be above 0, and here all are 0. In every run, at least one read must have been checked, because flag checks alone never test the data path. Lab `simple-dut-1` started with `PASS=0 FAIL=0`, which a script looking only for `FAIL=0` would mark green. This bench starts red, and stays red until it really writes and reads data.

</details>

## Step 2: The transaction classes

1. **`fifo_item::copy(rhs)`** copies the three fields. **`clone()`** creates a new `fifo_item`, calls `c.copy(this)` and returns `c`. **`convert2string()`** returns something like `wr_en=1 wr_data=0x10 rd_en=0`.
2. **`fifo_obs`** overrides all three, with the same signatures:
   - `copy(fifo_item rhs)`: call `super.copy(rhs)` first, so the base class copies its own fields. Then get a `fifo_obs` handle with `if (!$cast(o, rhs)) $fatal(1, ...);` and copy `rd_data`, `full`, `empty` and `cycle`. Called as a function, `$cast` returns 0 when `rhs` does not refer to a `fifo_obs`; called as a task, a failed `$cast` is a run-time error (§6.24.2).
   - `clone()`: create a `fifo_obs`, not a `fifo_item`, then `c.copy(this)`.
   - `convert2string()`: start from `super.convert2string()` and add the cycle and the three output fields.

The methods are `virtual`, so a call through a `fifo_item` handle runs the `fifo_obs` version when the object is a `fifo_obs` (§8.20).

<details>
<summary>Question: what goes wrong if fifo_obs does not override clone()?</summary>

`o.clone()` on a `fifo_obs` then runs `fifo_item::clone`, which creates a `fifo_item` and calls `c.copy(this)` on it. Because `copy` is virtual and `c` is a `fifo_item`, that runs `fifo_item::copy`: the three inputs are copied and the outputs are lost, silently. A clone must create an object of the clone's own class. In this bench the scoreboard never clones, so the bug would hide until someone did; that is why the solution overrides `clone` in every class that adds fields.

</details>

## Step 3: The generator clones a blueprint

1. **`add(wr, rd)`**: set `blueprint.wr_en = wr`, `blueprint.rd_en = rd`, and `blueprint.wr_data = next_data` when `wr` is 1 (then `next_data++`), else 0. Push `blueprint.clone()` onto `items`. Every write carries a new value, starting at `0x10`, so an entry that is lost, duplicated or read out of order shows up as a wrong value.
2. Write `fill_drain` and `simultaneous` from the plan, with `write(n)`, `read(n)`, `both(n)` and `idle(n)`. `smoke` and `mixed` are given.

| Test | Stimulus | Rules | Corners it must reach |
|---|---|---|---|
| `smoke` | 3 writes, 3 reads, 1 idle | F2, F3 | none: it proves the path end to end |
| `fill_drain` | `write(DEPTH)`, `write(2)` while full, `read(DEPTH)`, `read(2)` while empty, `idle()` | F2-F5 | full reached, writes while full, reads while empty |
| `simultaneous` | `both()` while empty, `write(1)`, `both(2)` with 2 held, `write(DEPTH-2)` to full, `both(2)` (at full, then at 3 held), `read(DEPTH)`, `idle()` | F4 | write and read together when empty, in the middle and when full |
| `mixed` | 64 cycles from a 16-bit LFSR (write 3 cycles in 4, read 1 in 2), then `read(DEPTH)`, `idle()` | all | many of each |

`mixed` uses a fixed LFSR, not `$urandom`, so every simulator produces the same stimulus and the same counts. Constrained-random stimulus is I-SV-2A.

## Step 4: The driver

Fill in `fifo_drv::run(items)`: for each item, `@(posedge vif.clk);` then drive `vif.wr_en`, `vif.wr_data` and `vif.rd_en` with `<=`. After the last item, wait one more edge and drive both enables to 0. `reset()` is given.

The driver holds `virtual fifo_if #(W) vif`, a handle to the interface instance in `tb_top`. A class cannot have ports, so this handle is how it reaches the DUT (§25.9). The code-review rule from F2E still holds: no `=` to a DUT input after `@(posedge clk)`.

## Step 5: The monitor makes a new object on every edge

Fill in `fifo_mon::run()`:

```systemverilog
int unsigned cycle = 0;
forever begin
  fifo_obs o;
  @(posedge vif.clk);
  if (vif.rst_n !== 1'b1) begin cycle = 0; continue; end
  o = new();                     // a NEW object on every edge
  // TODO: o.cycle = ++cycle; then the six signals from vif
  sb.write(o);
end
```

The monitor reads the values from just before the edge: the driver and the DUT both assign with `<=`, so their updates are nonblocking assignment events, which run after the processes woken by the edge (§4.9.4). This is the same reason the M0 checker could sample on `@(posedge clk)`. The monitor does not decide anything: it reports what it saw, and the scoreboard judges it.

Keep `o = new();` inside the loop. Step 8 shows what happens when you do not.

## Step 6: The scoreboard and its reference queue

`ref_q` holds the entries the FIFO should hold, oldest first. Fill in `fifo_sb::write(o)` in this order:

1. **Data.** If `rd_pending` is set, a read was accepted on the previous edge and its value is now on `rd_data` (F3). Compare `o.rd_data !== exp_rd.wr_data`, count a pass or a failure with an `$error` that names the cycle, then clear `rd_pending`.
2. **Flags.** `model_full = (ref_q.size() == DEPTH)`, `model_empty = (ref_q.size() == 0)`. Compare `o.full` and `o.empty` with them using `!==`, and count a pass or a failure.
3. **Accept.** Update the corner counters (`n_wr_full`, `n_rd_empty`, and `n_rw_empty`, `n_rw_mid` or `n_rw_full` when both enables are 1). Then let the **model** decide: if `o.rd_en` and the model is not empty, `exp_rd = ref_q.pop_front(); rd_pending = 1; n_rd++;`. If `o.wr_en` and the model is not full, `ref_q.push_back(o); n_wr++;`, and count `n_hit_full` when the push makes the queue full.

Both decisions use the model's level from before the edge, as the DUT does (F4). Never decide acceptance from `o.full` or `o.empty`: a DUT with a wrong flag would then steer its own check, and the bench would agree with the bug.

`ref_q.push_back(o)` stores a **handle** to the monitor's object. That is safe only because the monitor never changes an object after it has handed it over.

## Step 7: Expected log

Captured from Verilator 5.052 with the reference solution. Without `+TEST=` (and with `+verilator+error+limit+1000` on Verilator):

```text
0 TEST all: 102 cycles of stimulus
CORNERS writes=50 reads=50 full=15 wr_full=16 rd_empty=5 rw_empty=1 rw_mid=17 rw_full=13
PASS=155 FAIL=0
```

| `+TEST=` | `CORNERS` (writes, reads, full, wr_full, rd_empty, rw_empty, rw_mid, rw_full) | Summary | Run ends at |
|---|---|---|---|
| `smoke` | 3 3 0 0 0 0 0 0 | `PASS=13 FAIL=0` | 120 ns |
| `fill_drain` | 4 4 1 2 2 0 0 0 | `PASS=20 FAIL=0` | 180 ns |
| `simultaneous` | 7 7 1 1 2 1 3 1 | `PASS=23 FAIL=0` | 180 ns |
| `mixed` | 36 36 13 13 1 0 14 12 | `PASS=108 FAIL=0` | 740 ns |
| (none: all four, back to back) | 50 50 15 16 5 1 17 13 | `PASS=155 FAIL=0` | about 1 us |

Where `PASS=13` comes from in `smoke`: the clock's rising edges are at 5, 15, 25 ns and so on, and reset holds the first two. The monitor reports the ten edges from 25 ns to 115 ns, each with one flag check, and three of them also carry read data: 10 + 3 = 13. `env.run` returns at the falling edge after the last rising edge, so the monitor has always finished with that edge before `report()` runs, whatever order the simulator runs the processes in.

An unknown name, such as `+TEST=fill`, stops the run at once with the `TEST unknown test` fatal.

## Step 8: Prove that the bench can fail

Plant each bug, **predict** which tests catch it, run them, then compare with the table. Undo each bug before the next.

1. **`BUG=1`: a write while full is stored.** In `work/tb_top.sv` set `.BUG(1)`. The DUT ignores `full` when it accepts a write.
2. **`BUG=2`: a write and a read on one edge add 1 to the count.** Set `.BUG(2)`. The DUT's count logic handles "write only" and "read only" and treats "both" as a write.
3. **The monitor reuses one object.** Set `.BUG(0)`. In `fifo_mon::run`, declare `fifo_obs o = new();` once, before `forever`, and delete the `o = new();` inside the loop.
4. **The generator stores the blueprint.** In `fifo_gen::add`, push `blueprint` instead of `blueprint.clone()`.
5. Undo everything and rerun without `+TEST=`: `PASS=155 FAIL=0`.

Summary lines, captured from Verilator 5.052:

| `+TEST=` | correct | `BUG=1` | `BUG=2` | monitor reuses one object | generator stores the blueprint |
|---|---|---|---|---|---|
| `smoke` | `PASS=13 FAIL=0` | `PASS=13 FAIL=0`, escapes | `PASS=13 FAIL=0`, escapes | `PASS=10 FAIL=3` | `PASS=10 FAIL=1` |
| `fill_drain` | `PASS=20 FAIL=0` | `PASS=13 FAIL=7` | `PASS=20 FAIL=0`, escapes | `PASS=16 FAIL=4` | `PASS=16 FAIL=1` |
| `simultaneous` | `PASS=23 FAIL=0` | `PASS=19 FAIL=4` | `PASS=16 FAIL=7` | `PASS=16 FAIL=7` | `PASS=16 FAIL=1` |
| `mixed` | `PASS=108 FAIL=0` | `PASS=64 FAIL=44` | `PASS=68 FAIL=40` | `PASS=72 FAIL=36` | `PASS=72 FAIL=1` |
| (none: all) | `PASS=155 FAIL=0` | `PASS=100 FAIL=55` | `PASS=106 FAIL=49` | `PASS=105 FAIL=50` | `PASS=105 FAIL=2` |

`BUG=1` with `+TEST=fill_drain`. Both extra writes while full are stored: they overwrite the two oldest entries (0x10 and 0x11 are replaced by 0x14 and 0x15), and the DUT's count goes past 4, so `full` drops while the FIFO is still full:

```text
0 TEST fill_drain: 13 cycles of stimulus
[85000] %Error: ... CHK cycle 7: full=0 empty=0, expected full=1 empty=0 (4 held)
[95000] %Error: ... CHK cycle 8: full=0 empty=0, expected full=1 empty=0 (4 held)
[105000] %Error: ... CHK cycle 9: rd_data=0x14, expected 0x10
[115000] %Error: ... CHK cycle 10: rd_data=0x15, expected 0x11
[115000] %Error: ... CHK cycle 10: full=1 empty=0, expected full=0 empty=0 (2 held)
[135000] %Error: ... CHK cycle 12: full=0 empty=0, expected full=0 empty=1 (0 held)
[145000] %Error: ... CHK cycle 13: full=0 empty=0, expected full=0 empty=1 (0 held)
CORNERS writes=4 reads=4 full=1 wr_full=2 rd_empty=2 rw_empty=0 rw_mid=0 rw_full=0
PASS=13 FAIL=7
```

`BUG=2` with `+TEST=simultaneous`. Each `both()` in the middle adds 1 to the count instead of leaving it alone, so after the two of them the DUT claims full with only 2 entries held, and then drops writes the model accepts:

```text
0 TEST simultaneous: 13 cycles of stimulus
[75000] %Error: ... CHK cycle 6: full=1 empty=0, expected full=0 empty=0 (2 held)
[85000] %Error: ... CHK cycle 7: full=1 empty=0, expected full=0 empty=0 (3 held)
[115000] %Error: ... CHK cycle 10: full=1 empty=0, expected full=0 empty=0 (3 held)
[125000] %Error: ... CHK cycle 11: rd_data=0x17, expected 0x14
[135000] %Error: ... CHK cycle 12: rd_data=0x11, expected 0x15
[145000] %Error: ... CHK cycle 13: rd_data=0x12, expected 0x17
[145000] %Error: ... CHK cycle 13: full=0 empty=0, expected full=0 empty=1 (0 held)
CORNERS writes=7 reads=7 full=1 wr_full=1 rd_empty=2 rw_empty=1 rw_mid=3 rw_full=1
PASS=16 FAIL=7
```

The monitor reusing one object, with `+TEST=smoke`. The DUT is correct:

```text
0 TEST smoke: 7 cycles of stimulus
[75000] %Error: ... CHK cycle 6: rd_data=0x10, expected 0x00
[85000] %Error: ... CHK cycle 7: rd_data=0x11, expected 0x00
[95000] %Error: ... CHK cycle 8: rd_data=0x12, expected 0x00
CORNERS writes=3 reads=3 full=0 wr_full=0 rd_empty=0 rw_empty=0 rw_mid=0 rw_full=0
PASS=10 FAIL=3
```

What the table teaches:

- **Each DUT bug escapes the tests that never provoke it.** `smoke` never fills the FIFO, so it misses `BUG=1`; `fill_drain` never writes and reads on one edge, so it misses `BUG=2`. The corner counters show which cases a test reached; the full regression demands all of them.
- **The monitor bug is a bench bug that looks like a DUT bug.** `ref_q` stores handles. With one `fifo_obs` for the whole run, every handle in `ref_q` refers to the same object, and the monitor overwrites it on every edge. By the time a read is checked, the "expected" entry shows the current cycle's `wr_data`, here 0 because `smoke` is reading, not writing. The DUT gave the right data. Before you blame a DUT, check that every stored item is a separate object. Two fixes exist: the producer creates a new object for every item (this bench), or the consumer stores `o.clone()`. Pick one rule for the whole bench.
- **The generator bug is quiet.** Every slot of `items` refers to the blueprint, and the last edit to the blueprint was `idle()`: every cycle drives `wr_en=0, rd_en=0`. Nothing is written, nothing is read, and every flag check passes (`PASS=10`). Only the vacuity guard in `report()`, "no data was read back", turns the run red. Without that guard, this bench would pass while testing nothing.

## Running the lab

These are typical invocations; check your simulator's documentation, because options differ between tools and versions.

```bash
# Synopsys VCS
vcs -sverilog work/sync_fifo.sv work/fifo_if.sv work/fifo_tb_pkg.sv work/tb_top.sv
./simv +TEST=fill_drain

# Siemens Questa
vlib work
vlog work/sync_fifo.sv work/fifo_if.sv work/fifo_tb_pkg.sv work/tb_top.sv
vsim -c tb_top +TEST=fill_drain -do "run -all; quit"

# Cadence Xcelium
xrun work/sync_fifo.sv work/fifo_if.sv work/fifo_tb_pkg.sv work/tb_top.sv +TEST=fill_drain

# Verilator 5 (open source)
verilator --binary --timing -Wno-fatal --top-module tb_top \
  work/sync_fifo.sv work/fifo_if.sv work/fifo_tb_pkg.sv work/tb_top.sv
./obj_dir/Vtb_top +TEST=fill_drain +verilator+error+limit+1000
```

Leave out `+TEST=...` to run every test, and add `+DUMP` to write `tb_top.vcd`.

Notes on the open-source route:

- Every log in this README was captured with **Verilator 5.052** using the command above. The commercial invocations were not run.
- By default a Verilator executable stops at the first `$error`. `+verilator+error+limit+1000` lets it continue, so one run shows every failure and the summary line, as a 4-state simulator would.
- Verilator is a 2-state simulator: x becomes a known value, so the `!==` comparisons can never catch an x there. Use a 4-state simulator to see X failures.
- Without a local simulator, EDA Playground can run the lab in a browser: put `sync_fifo.sv` in the design pane, the other three files in the testbench pane in compile order, and pass the plusargs in the run options.

## How a run reports PASS or FAIL

- **The summary line is the verdict.** Each run prints exactly one `PASS=<n> FAIL=<m>` line, and a clean run matches `^PASS=\d+ FAIL=0$`. A missing line (a crash, a killed job) is a failure.
- **`$error`** reports a failed check and lets the run continue (on Verilator, with the error limit raised). **`$fatal`** is for a broken bench (an unknown test, a failed `$cast`, a timeout) and ends the run at once (§20.10). **`$finish`** ends a normal run.
- Decide PASS or FAIL from the summary line, not from the process exit status, which the standard does not define.

## How the steps are checked

The site does not grade this lab's code; every step is self-attested. The real check is yours: the summary lines and corner counts in step 7 and every row of the step 8 table.

## Completion checklist

- [ ] `fifo_item` and `fifo_obs` have virtual `copy`, `clone` and `convert2string`; `fifo_obs::copy` calls `super.copy` and checks its `$cast`; `fifo_obs::clone` creates a `fifo_obs`.
- [ ] The generator edits one blueprint and stores a clone every time.
- [ ] The driver and the monitor reach the DUT only through `vif`; the driver drives with `<=` after `@(posedge vif.clk)`.
- [ ] The monitor creates a new `fifo_obs` on every edge after reset.
- [ ] The scoreboard checks data with `!==`, checks both flags on every edge, and decides acceptance from `ref_q`, never from the DUT's flags.
- [ ] Without `+TEST=` the log ends `PASS=155 FAIL=0` and every corner counter is above 0.
- [ ] I have seen `FAIL` greater than 0 for `BUG=1`, `BUG=2` and both bench bugs, and I can say which test catches each and why the generator bug needs the vacuity guard.

> **Ready to compare?** Open `solution/fifo_tb_pkg.sv` after you finish.
