# Lab: Debugging the Null Virtual Interface

## Problem Statement
Your testbench compiles perfectly, but it crashes at time 0 during the `run_phase`. 
The simulator log says something like:
`Error-[NO_VIF] Null Virtual Interface`
`The virtual interface handle in my_driver is null. Ensure it was set in the config_db.`

This is the most common bug encountered by new UVM engineers. You have a `my_driver` expecting a virtual interface, and `module top` is attempting to provide it via the `uvm_config_db`. Somewhere, the connection is broken.

## Your Task
1. Inspect the `uvm_config_db::set` call in `src/dv/testbench.sv`.
2. Inspect the `uvm_config_db::get` call in `src/dv/driver.sv`.
3. Identify the typo or mismatch preventing the driver from retrieving its interface.
4. Fix the code so the driver successfully wiggles the pins and prints `[DRV] Wiggling pins at time 10`.

## Instructions
1. Run the simulation to observe the fatal error.
2. Carefully check three things:
   - Does the **type** `#(virtual my_if)` match exactly in both places?
   - Does the target hierarchical **path string** correctly encompass the driver?
   - Does the **field name string** (`"vif"`) match exactly?
3. Fix the mistake and re-run.

> **Why this matters:** `uvm_config_db` relies on string matching. The compiler cannot catch typos in strings. The LRM best practice is to always wrap your `get()` calls in a fatal check (as done here) so you crash immediately rather than hunting down a silent X-propagation later.
