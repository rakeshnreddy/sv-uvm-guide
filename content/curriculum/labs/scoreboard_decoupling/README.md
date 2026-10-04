# Lab: Decoupling the Scoreboard with Analysis FIFOs

## Problem Statement
Your Agent contains a Monitor that broadcasts transactions on every clock cycle. You have a Scoreboard that requires 3 clock cycles to process and compare a transaction.
Currently, the Monitor's `analysis_port` is connected directly to the Scoreboard's `analysis_imp`. `write()` is a function, so it runs in zero simulation time and cannot wait. That means a scoreboard that needs to wait (for a matching response, a clock edge, or a reference-model task) cannot do that work inside `write()` at all. The fix is to buffer transactions in a `uvm_tlm_analysis_fifo` and process them in the scoreboard's own `run_phase` thread, where it may block on `get()`.

## Your Task
1. Instantiate a `uvm_tlm_analysis_fifo #(my_txn)` inside the Environment.
2. Disconnect the Monitor from the Scoreboard.
3. Wire the Monitor's `analysis_port` into the FIFO's `analysis_export`.
4. Run a `run_phase` loop in the Scoreboard that uses `get()` to pop transactions out of the FIFO at its own pace.

## Instructions
1. Open `src/dv/env.sv`.
2. Locate the `connect_phase` and change the direct connection to route through the newly declared `sb_fifo`.
3. Open `src/dv/scoreboard.sv` and change the `uvm_analysis_imp` to a `uvm_blocking_get_port`.
4. In `src/dv/scoreboard.sv`, implement the `run_phase` to `get()` items from the port and process them.

> **Why this matters:** An analysis FIFO provides an infinite elastic buffer that decouples the fast publisher (Monitor) from the slow subscriber (Scoreboard), giving the subscriber its own thread so it can wait for whatever it needs without affecting the monitor.
