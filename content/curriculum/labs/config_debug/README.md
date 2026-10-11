# Lab: silent config_db misses

**Module:** I-UVM-2C Configuration and Resources. Read the [module page](/curriculum/T2_Intermediate/I-UVM-2C_Configuration_and_Resources/index) first, especially "What a get() can see: three filters", "Who wins when several set() calls match" and "Debugging a silent get() miss".

**You will practise:** reading a `+UVM_CONFIG_DB_TRACE` log and a `check_config_usage()` report, fixing four configuration bugs of four different kinds, and predicting a precedence outcome before you rerun. The run ends with `PASS: monitor saw 6 transfers` and a report summary with `UVM_ERROR :    0` and `UVM_FATAL :    0`.

## The bench

| File | What it holds |
|---|---|
| `src/dv/testbench.sv` | `config_debug_test` and the top module `tb_top`; it `` `include ``s the other files |
| `src/dv/my_if.sv` | `my_if`: `valid` and `data`, a `driver_cb` and a `mon_cb` clocking block, and the `driver_mp` and `mon_mp` modports |
| `src/dv/driver.sv` | `my_driver`: a pin-wiggling component standing in for a `uvm_driver`. It drives `num_pkts` transfers and prints `Driving pins through the clocking block` for each one |
| `src/dv/monitor.sv` | `my_monitor`: counts the transfers it sees |
| `src/dv/agent.sv` | `my_agent`: reads the optional knob `num_pkts` (default 2), builds the driver and the monitor, and hands `num_pkts` to the driver |
| `src/dv/env.sv` | `my_env`: builds the agent |

The component paths are `uvm_test_top.env.agt`, `uvm_test_top.env.agt.drv` and `uvm_test_top.env.agt.mon`. The test asks for `NUM_PKTS = 6` transfers and checks, in `check_phase`, that the monitor saw exactly that many.

The bench contains four configuration bugs: two stop the run with a fatal, one makes a setting miss without any message, and one is a precedence surprise. Find each one from the log before you read the code around it.

## Run it

Use any simulator with IEEE 1800-2023 support and the Accellera uvm-core 2020.3.1 library. Compile `uvm_pkg` and `src/dv/testbench.sv` only (it includes the other files), with `tb_top` as the top module, from this directory. Run with `+UVM_CONFIG_DB_TRACE`. The `Makefile` shows the commands for one simulator (`make vcs`); other simulators need their own equivalent commands.

The logs below are illustrative: they were traced by hand against the uvm-core source, not captured from a simulator. Real lines also carry a file name, a line number and a time, and the `(type …)` text is formatted by your simulator.

## Step 1: Run the starter and read the first fatal

The run stops in `build_phase`:

```text
UVM_INFO … [AGT] num_pkts=4
UVM_FATAL … @ 0: uvm_test_top.env.agt.drv [NO_VIF] my_driver could not get its virtual interface from uvm_config_db
```

Search the trace for `name='vif'`. You will find one `CFGDB/SET` line from `tb_top` and one failing `CFGDB/GET` line from the driver:

```text
[CFGDB/SET] Configuration scope='uvm_test_top.env.agt.*' name='vif' (type virtual my_if) set …
[CFGDB/GET] Configuration scope='uvm_test_top.env.agt.drv' name='vif' (type virtual my_if.driver_mp) read … = null (failed lookup)
```

Compare the two lines field by field: scope, name, type, order. Which one differs? Fix the driver so that it gets exactly the type `tb_top` publishes, and still drives through the `driver_mp` modport view. Rerun.

## Step 2: Fix the monitor

The run now stops at the monitor with the same `NO_VIF` message. Read its `CFGDB/GET` line and compare it with the `SET` line again. This time the type and the scope match. Fix the monitor and rerun.

## Step 3: Find the setting that nobody read

The run now completes, but the check fails:

```text
UVM_INFO … [AGT] num_pkts=4
UVM_INFO … [CFGNRD]  ::: The following resources have at least one write and no reads :::
  … num_pkts … scope uvm_test_top.env.agt.* …
UVM_INFO … [DRV] Driving pins through the clocking block      (4 times)
UVM_ERROR … [CHK] expected 6 transfers, monitor saw 4
```

`check_config_usage()`, called in the test's `end_of_elaboration_phase`, lists every setting that was written but never read. The test's own `num_pkts` setting is on the list. Which component was meant to read it, and why does its path not match the scope? Fix the test's `set()` so that it reaches that component.

## Step 4: Predict, then fix the precedence surprise

Before you rerun, predict: which value will the agent print now, 4 or 6? Two settings of `num_pkts` with the same type now reach the agent. Write down which one wins and why, using the precedence numbers from the module page.

Then rerun. If the agent still prints `num_pkts=4`, explain it: where was each setting made, and what precedence did each get? Fix the bench so that the test's value wins without moving the test's `set()` out of `build_phase`. Hint: a default belongs in the component that uses it, and this agent already has one.

## Step 5: Confirm a clean run

The final run prints six `Driving pins through the clocking block` lines, no `CFGNRD` list and:

```text
UVM_INFO … [AGT] num_pkts=6
UVM_INFO … [CHK] PASS: monitor saw 6 transfers
--- UVM Report Summary ---
…
UVM_ERROR :    0
UVM_FATAL :    0
```

Then compare your files with `solution/testbench.sv`, `solution/driver.sv` and `solution/monitor.sv`, and answer:

1. Which of the four bugs could the compiler have caught, if any?
2. Why did the type mismatch need no message to be silent, and what did the fatal check in the driver buy you over a null-handle error in `run_phase`?
3. Why would the `num_pkts` default in `tb_top` win against the test's `set()` in `build_phase`, but lose against the same `set()` made in the test's constructor?

> **Why the fatal check matters:** `uvm_config_db` matches strings and types at run time, so the compiler cannot catch these bugs. A `get()` that misses prints nothing. Using a null virtual interface is a fatal run-time error (IEEE 1800-2023 §25.9), but it is reported where the handle is first used, far from the cause. Checking every required `get()` and calling `` `uvm_fatal `` names the component and the setting in `build_phase`. Common practice, not a rule of the standard.
