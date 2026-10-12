# Lab uvm-performance-1 (E-PERF-1): Find and remove UVM hotspots with a profile

This lab belongs to [E-PERF-1: UVM Performance](/curriculum/T4_Expert/E-PERF-1_UVM_Performance/index). Do the lesson's Make It Work first: this lab uses the same measurement method on a bench where nobody tells you where the costs are.

**Goal.** A passive UVM bench checks 1000 packets correctly, but slowly. Five costly habits from the lesson are hidden in it. Measure the bench, find each cost from a profile and the bench's own counters, remove it without changing what the bench checks, and prove the result with numbers.

**You need:** a SystemVerilog simulator with IEEE 1800.2 UVM support (uvm-core 2020.3.1 or your tool's bundled UVM) and its profiler, and a shell with `/usr/bin/time` (Linux or macOS). How you compile, name the UVM library, choose the top module, turn on the profiler and set the seed is tool-dependent: use your simulator's user guide. Every design element in the file declares `timeunit 1ns; timeprecision 1ps;` (IEEE 1800-2023 §3.14.2.3 makes it an error when some specify a time unit and others do not); the precompiled `uvm_pkg` declares none, so if your tool reports a time-unit mismatch, compile the UVM library with its default-timescale option set to 1ns/1ps (tool-dependent). Open-source UVM support is limited, so this lab has not been run on an open-source simulator.

**Time:** about 90 minutes.

## Files

| File | Role |
|---|---|
| `perf_lab_tb.sv` | **Starter.** The whole bench in one file: interface `stream_if`, DUT `pkt_src`, package `perf_lab_pkg` (item, monitor, scoreboard, coverage subscriber, env, test) and `tb_top`. You edit this file. |
| `solution/perf_lab_tb.sv` | **Solution.** The same bench with the five costs removed, each marked `FIX 1` to `FIX 5`. Open it only in Step 5. |

## The bench

- **DUT** `pkt_src` sends 1000 packets, one every 4 clocks (10 ns clock), with `id` counting up from 0 and `data = 8'(id * 7 + 3)`, then goes idle.
- **Monitor** `pkt_mon` samples the bus through a clocking block and publishes a new `pkt_item` per packet on its analysis port.
- **Scoreboard** `pkt_sb` checks each packet's `data` against the reference model, checks that no `id` repeats, and reads a `strict` setting from the configuration database (a data mismatch is an error when `strict` is 1).
- **Coverage subscriber** `pkt_cov` samples a covergroup on the packet data.
- **Test** `perf_test` raises one objection, waits long enough for every packet, and prints a `PERF_SUMMARY` line in `report_phase`.

The bench counts its own costly operations, because CPU seconds depend on the tool and the machine and counts do not:

| Counter | Counts |
|---|---|
| `fmt` | messages about an item that were built (`convert2string` calls) |
| `cfg_get` | configuration lookups of `strict` |
| `raises` | objection raises |
| `cmp` | comparisons made by the scoreboard's duplicate check |
| `samples` | covergroup samples |

## Rules

1. **Do not change what the bench checks.** After every change, the `SCB_SUMMARY` line, the coverage (`cov=` in `PERF_SUMMARY`), the end time of the run and `UVM_ERROR :    0` must be identical to the baseline. If they change, you changed behaviour, not speed.
2. **Measure CPU time outside the simulator**, never with `$time`. Wrap each run in `/usr/bin/time -p <your run command>`: CPU time is `user` + `sys`, wall-clock time is `real`.
3. **Same image, same seed, one change at a time, median of three runs.** Label every time you record with the simulator name and version and the host.

## Step 1: Baseline

Compile `perf_lab_tb.sv` once, with `tb_top` as the top module. Run it three times with the same seed and record the median CPU time. The end of the log looks like this (illustrative: worked out by reading the code and uvm-core 2020.3.1, not captured from a simulator; times shown in ns; the `file(line)` field after each `UVM_INFO` and the report summary that follows, introduced by a `[UVM/REPORT/SERVER]` line, are omitted):

```text
UVM_INFO @ 40075: uvm_test_top.env.sb [SCB_SUMMARY] matches=1000 mismatches=0 pending=0
UVM_INFO @ 40075: uvm_test_top [PERF_SUMMARY] items=1000 fmt=1000 cfg_get=1000 raises=1001 cmp=499500 samples=4008 cov=100.0
```

The counts are exact for this code, except `samples`, which is one per clock edge of the whole run (about 4008; it can differ by one depending on how your simulator orders the last edge). Write down the end time, `SCB_SUMMARY`, every counter and the median CPU time in the results table at the end of this README.

## Step 2: Profile and attribute

Run once more with your simulator's profiler on. In the report:

1. Sort by **self time** and attribute the top rows to DUT, TB, UVM library and simulator kernel. Which owner dominates? Is it worth making the RTL faster?
2. For every UVM-library row near the top, find its **callers** and its **call count**. Library time is almost always caused by a TB line.
3. Match each `PERF_SUMMARY` counter to the profile rows it explains, and to the line of `perf_lab_tb.sv` that causes it. Write down five suspects, one per counter.
4. Predict, from the counts alone, which fix will save the most CPU time.

## Step 3: Remove the costs, one at a time

For each suspect, change the code, recompile, rerun three times with the same seed, and record the median CPU time and the counters. Check Rule 1 after every change. Use the fix the lesson teaches for each habit; do not remove a check, a message or the coverage, and do not stop creating a new item per packet.

When you are done, the counters must read:

```text
PERF_SUMMARY items=1000 fmt=0 cfg_get=1 raises=1 cmp=1000 samples=1000 cov=100.0
```

<details>
<summary>Hints, if you are stuck</summary>

- `fmt`: a message at `UVM_HIGH` is built for every match, although the default verbosity is `UVM_MEDIUM`. Which form of reporting checks verbosity before building the string?
- `cfg_get`: the scoreboard looks up `strict` for every packet, and 21 entries in the database are named `strict`.
- `raises`: one component raises and drops an objection around every packet. Does it need to? What does the test's own objection already do?
- `cmp`: the duplicate check compares each new packet with every earlier one. What container finds an `id` in one lookup?
- `samples`: the covergroup is sampled every clock, including the three idle clocks between packets. Where should a transaction-level covergroup be sampled?

</details>

## Step 4 (optional): The analysis FIFO experiment

Starting from your fixed bench, put a `uvm_tlm_analysis_fifo #(pkt_item)` between the monitor and the scoreboard, and move the scoreboard's checking into a `run_phase` loop that calls `get()`:

```systemverilog
// snippet: in perf_env
uvm_tlm_analysis_fifo #(pkt_item) sb_fifo;
// build_phase:
sb_fifo = new("sb_fifo", this);
// connect_phase, instead of mon.ap.connect(sb.item_imp):
mon.ap.connect(sb_fifo.analysis_export);
sb.get_port.connect(sb_fifo.get_export);

// snippet: in pkt_sb, instead of the analysis imp
uvm_blocking_get_port #(pkt_item) get_port;  // build_phase: get_port = new("get_port", this);
task run_phase(uvm_phase phase);
  pkt_item t;
  forever begin
    get_port.get(t);
    write(t);  // the same checking code as before, now called from this loop
  end
endtask
```

Before you run it, predict the counters and the CPU time. Then measure. Explain your result: what does the FIFO's `write()` do, in which process does the checking now run, and does the simulation execute more than one process at a time? Remove the FIFO again when you are done; it is the right tool only when a subscriber must wait for simulated time.

## Step 5: Confirm and reflect

1. Your final log shows the counters above, `SCB_SUMMARY matches=1000 mismatches=0 pending=0`, `UVM_ERROR :    0` and `UVM_FATAL :    0`, and the same end time as the baseline.
2. Compare your file with `solution/perf_lab_tb.sv`. Where your fix differs, is it equivalent? Does it keep every check?
3. Answer:
   - a. Which fix saved the most CPU time on your simulator, and did the counts predict it?
   - b. Why does the monitor still call `type_id::create` for every packet after all five fixes?
   - c. Your colleague wants to keep the per-packet `strict` lookup "so a test can change it during the run". What do you propose instead?
   - d. The per-clock sampling also counted idle cycles. Besides speed, what did that do to the coverage data?

## Results table

| Run | Change | `fmt` | `cfg_get` | `raises` | `cmp` | `samples` | Median CPU time | End time and `SCB_SUMMARY` unchanged? |
|---|---|---|---|---|---|---|---|---|
| 0 | baseline | 1000 | 1000 | 1001 | 499500 | about 4008 | | |
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | 0 | 1 | 1 | 1000 | 1000 | | |

Simulator, version and host: ______________________

## Answers to Step 5

<details>
<summary>Show the answers</summary>

- **a.** Tool-dependent; that is why you measure. The counts make a prediction: at 1000 packets the duplicate check's 499500 comparisons are by far the largest count, and the 1000 lookups that each scan 21 entries come next. Whether your simulator agrees is what your table shows.
- **b.** Subscribers keep handles: the analysis port passes the same object to every subscriber, and a scoreboard or FIFO that stores it would see every stored entry change if the monitor reused one object. A new object per transaction is a correctness rule, not a cost to optimize away.
- **c.** Read it once in `build_phase`. If it must change during a run, `get` a configuration object (a class handle) once, so changes to its fields are visible immediately, or wait for changes with `uvm_config_db#(int)::wait_modified` in a separate thread (IEEE 1800.2-2020 C.4.2.2.4).
- **d.** It sampled the bus value on idle cycles too, so hit counts were inflated about fourfold and included three samples of a stale value for every real packet (and samples taken during reset). With a different data pattern it could have filled bins with values no transaction ever carried, a false coverage result.
- **Step 4.** The counters are unchanged, and the CPU time is the same or slightly higher. The FIFO's `write()` is a zero-time `try_put` of the handle; the same checking code runs in the scoreboard's `get()` loop, which is another process of the same simulation, and the simulator executes one process at a time. Nothing ran in parallel.

</details>
