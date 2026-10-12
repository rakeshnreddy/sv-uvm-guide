# Lab: a waveform window from a debug event bus

**Module:** E-DBG-1 Advanced UVM Debug Methodologies. Read the [module page](/curriculum/T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/index) first, especially "A debug event bus" and "Selective waveforms and transaction recording".

**You will practise:** connecting a `uvm_subscriber` to a debug event bus; proving, with your own dump file, that a dump started by a trigger cannot show the cause of a failure; and capturing the cause with a two-run window controlled from `tb_top`, the standard SystemVerilog way. At the end, `window.vcd` shows the clock edge at which the bus stalls and why.

## The scenario

A long test stops with a watchdog fatal. Nobody dumps waveforms in the regression, because a full dump of every run costs too much disk space and simulation time. You want a waveform of the few hundred nanoseconds that explain the failure, and nothing else.

The bench is one file. `testbench.sv` is your starter; `solution.sv` is the finished version.

| Part | What it does |
|---|---|
| `bus_if` | `clk`, `rst_n`, `valid`, `ready`, `data[7:0]`, with a `drv_cb` clocking block for driving and a `mon_cb` clocking block for sampling |
| `stall_sink` (in `tb_top` as `u_sink`) | The design under test (DUT) stand-in. It accepts a beat on every rising edge where `valid` and `ready` are both 1, and counts beats in `accepted`. Its bug: after 300 beats, `ready` falls and never rises again |
| `dbg_lab_pkg::traffic_gen` (`env.gen`) | Stands in for a driver: sends 500 beats through `drv_cb`, holding each one until `ready` is sampled high |
| `dbg_lab_pkg::bus_monitor` (`env.mon`) | Counts accepted beats and records `last_beat_ns`, the time of the last one |
| `dbg_lab_pkg::watchdog_timer` (`env.wdg`) | Every 100 ns, checks how long ago the last beat was. After 2000 ns without a beat, it publishes `WATCHDOG_TIMEOUT` on the bus, waits a 50 ns grace time and reports `UVM_FATAL [WDG]` |
| `dbg_lab_pkg::debug_event_bus` (`env.bus`) | One `uvm_analysis_port #(debug_event)`, `ap`. `publish()` builds a `debug_event` (tag, detail, `last_ok_ns`) and writes it to every subscriber |
| `dbg_lab_pkg::waveform_trigger_sub` (`env.trig_sub`) | Your subscriber. In the starter it is an empty skeleton and the env does not create it |
| `tb_top`, block `dump_ctl` | Dump control. In the starter it waits for a global `uvm_event` named `dump_now` and then starts a dump to `after_trigger.vcd` |

The classes live in a package, as in a real bench. A class in a package cannot refer to `tb_top` by name (IEEE 1800-2023 §26.2), so it cannot call `$dumpvars(0, tb_top)` itself. Instead, the subscriber triggers a named event from `uvm_event_pool::get_global("dump_now")` (IEEE 1800.2-2020 §10.4.1.2.3), and `tb_top` waits on the same key.

## Run it

Use any simulator with IEEE 1800-2023 support and the Accellera uvm-core 2020.3.1 library (or your simulator's built-in UVM). Compile the UVM package and `testbench.sv` (or `solution.sv`), with `uvm_macros.svh` on the include path and `tb_top` as the top module, then run the simulation. Each simulator has its own command names and options; check its documentation. The test name is fixed by `run_test("stall_test")`, so no `+UVM_TESTNAME` is needed.

The logs below are illustrative: they were traced by hand against the uvm-core 2020.3.1 source and the code in this lab, not captured from a simulator. Real lines also carry a file name and a line number, and UVM prints a release-notes banner at time 0. `tb_top` sets `$timeformat` so that UVM prints times in ns.

## Step 1: Run the starter and read the log

Run `testbench.sv` as given. The run ends with a fatal:

```text
UVM_INFO @ 0 ns: reporter [RNTST] Running test stall_test...
UVM_INFO @ 5100 ns: uvm_test_top.env.bus [BUS] Broadcasting WATCHDOG_TIMEOUT: no transfer for 2075 ns after 300 beats
UVM_FATAL @ 5150 ns: uvm_test_top.env.wdg [WDG] bus stalled: stopping the run
--- UVM Report Summary ---
…
UVM_ERROR :    0
UVM_FATAL :    1
```

Read it the way you would read a regression failure:

1. What is the first failure, and at what time?
2. When was the last beat accepted? Work it out from the `BUS` line.
3. **Predict:** suppose a subscriber starts a waveform dump at the moment the watchdog publishes. Will that dump show why the beats stopped? Write your answer down before Step 2.

## Step 2: Add the subscriber and start a dump on the trigger

In `testbench.sv`:

1. In `waveform_trigger_sub`, add a `build_phase` that gets the global event: `dump_now = uvm_event_pool::get_global("dump_now");`.
2. In `write()`, when `t.tag == "WATCHDOG_TIMEOUT"`, call `dump_now.trigger()`. `write()` is a function, so it must not wait for anything.
3. In `dbg_env`, create `trig_sub` with the factory in `build_phase`, and connect `bus.ap` to `trig_sub.analysis_export` in `connect_phase`.

Rerun. The log now also shows, at 5100 ns:

```text
UVM_INFO @ 5100 ns: reporter [DUMP] after_trigger.vcd opened at 5100 ns
```

Open `after_trigger.vcd` and look at `tb_top.u_sink`. You will see `valid` at 1, `ready` at 0, `data` and `accepted` frozen, from 5100 ns to the end at 5150 ns. Executing `$dumpvars` starts dumping "at the end of the current simulation time unit" (IEEE 1800-2023 §21.7.1.3), so a dump started by a trigger records only what follows the trigger. The file proves the bus is stuck, but not why: the cause happened about 2 µs earlier.

## Step 3: Make the subscriber name the window

A selective capture needs the time of the cause. The event already carries it: `last_ok_ns` is the time of the last accepted beat.

In `write()`, compute `start_ns = t.last_ok_ns - pre_ns` (use 0 if `last_ok_ns` is smaller than `pre_ns`; `pre_ns` is 200), and print it with `` `uvm_info("WAVE_TRIG", …, UVM_NONE) ``. Rerun. The log now contains:

```text
UVM_INFO @ 5100 ns: uvm_test_top.env.trig_sub [WAVE_TRIG] Last transfer at 3025 ns: rerun with +DUMP_START=2825
```

This is all a regression run should do: dump nothing, and leave in the log exactly the window a debug rerun needs.

## Step 4: Open the window in a rerun

In `tb_top`'s `dump_ctl` block, read the plusarg with `$value$plusargs("DUMP_START=%d", start_ns)` (IEEE 1800-2023 §21.6). If it is present, wait `#(start_ns * 1ns)`, then call `$dumpfile("window.vcd")` and `$dumpvars(0, tb_top)` and print a `DUMP` message; otherwise keep the Step 2 behaviour. Keep all `$dumpvars` calls of one run at the same simulation time: the standard requires it (§21.7.1.2).

Rerun with **the same seed and the same build**, adding only `+DUMP_START=2825`. The log shows:

```text
UVM_INFO @ 2825 ns: reporter [DUMP] window.vcd opened at 2825 ns
UVM_INFO @ 5100 ns: uvm_test_top.env.bus [BUS] Broadcasting WATCHDOG_TIMEOUT: no transfer for 2075 ns after 300 beats
UVM_INFO @ 5100 ns: uvm_test_top.env.trig_sub [WAVE_TRIG] Last transfer at 3025 ns: rerun with +DUMP_START=2825
UVM_FATAL @ 5150 ns: uvm_test_top.env.wdg [WDG] bus stalled: stopping the run
```

Open `window.vcd` and look at `tb_top.u_sink`:

- Find the rising edge at which `ready` falls. What is the time, and what is `accepted` just after it?
- Which signal shows that the traffic generator is still trying to send?
- Does the file show the cause of the stall? Point to it.

## Step 5: Check your understanding

Compare your files with `solution.sv`, then answer:

1. Why can the regression run not record the cause in a single pass, using only the standard VCD tasks? What would a single-pass alternative need, and why must it be labelled tool-dependent?
2. Why must the rerun use the same seed *and* the same build? What could happen to the 3025 ns time if you edited the bench before rerunning?
3. Why is the dump started from `tb_top` and not from `waveform_trigger_sub`, and what would the compiler say if the subscriber called `$dumpvars(0, tb_top)`?
4. What does `$dumplimit` do, and why is it not a way to choose a time window?
5. In a real 20-hour run, what would you change: `pre_ns`, the watchdog limit, or the scope passed to `$dumpvars`? Why?

<details>
<summary>Answers</summary>

Step 4: `ready` falls right after the rising edge at 3025 ns, when `accepted` becomes 300 (`'h12C`). `valid` stays 1 and `data` holds `'h2C` (beat number 300, the 301st beat) for the rest of the run: the generator is still trying to send. The cause is visible: the sink's `ready` drops when its count reaches 300 and never returns.

1. `$dumpvars` can only start recording from now on (§21.7.1.3); no standard task keeps a history of past values. A single-pass capture needs either a dump running from early on (expensive) or a simulator feature that keeps recent history in memory and writes it out on a trigger. Such history buffers and vendor database formats are not in IEEE 1800-2023, so they are tool-dependent.
2. The seed starts the random number generators, but random stability (IEEE 1800-2023 §18.14) makes the stimulus depend on the code as well. A changed bench can produce different stimulus for the same seed, so the stall could move or vanish. Here the stimulus is not random, but real benches are.
3. Items in a package cannot make hierarchical references (§26.2): the compiler rejects `tb_top` inside a package class. The named `uvm_event` crosses the boundary without a hierarchical name.
4. It sets the maximum size of the VCD file in bytes; when the file reaches it, dumping stops (§21.7.1.5). It limits size, not time.
5. Narrow the scope of `$dumpvars` to the stalled interface and its neighbours, keep `pre_ns` a little longer than the cause-to-symptom chain you expect, and keep the watchdog limit tied to the protocol's real worst-case latency so the window stays small.

</details>

## Need help?

Review "A debug event bus" and "Selective waveforms and transaction recording" on the [E-DBG-1 module page](/curriculum/T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/index), then compare with `solution.sv`.
