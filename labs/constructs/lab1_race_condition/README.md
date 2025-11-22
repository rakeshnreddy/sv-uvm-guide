# Lab 1: The Race Condition Challenge

## Objective
Understand how race conditions occur in simulation when the testbench and DUT interact without clear timing boundaries, and how to fix them using **Clocking Blocks**.

## The Scenario
You have a simple DUT (Device Under Test) that registers an input `d` to an output `q` on the rising edge of `clk`.
Your testbench drives `d` and checks `q`.

However, the testbench uses standard non-blocking assignments (`<=`) in an `always` block or `initial` block that triggers on the *same* clock edge as the DUT. This creates a race:
- Does the DUT read the *old* value of `d` or the *new* value?
- Does the testbench read the *old* value of `q` or the *new* value?

## Instructions

1.  **Run the Failing Test:**
    Execute the `testbench.sv` file.
    ```bash
    # If you have a simulator installed (e.g., Verilator, Icarus)
    # This is a conceptual lab, so we will analyze the code.
    ```
    *Observation:* In many simulators, you might see intermittent failures or unexpected values because the ordering of events in the "Active" region is non-deterministic.

2.  **Analyze the Code:**
    Open `testbench.sv`. Notice how `tb_driver` drives `d <= val` at `@(posedge clk)`. The `dut` also samples `d` at `@(posedge clk)`. This is the race.

3.  **Fix with Clocking Blocks:**
    Open `solution.sv` (or modify `testbench.sv`).
    - Create an `interface` with a `clocking` block.
    - Set the input skew to `#1step` (samples preponed value) and output skew to `#1ns` (drives after hold time).
    - Update the testbench to drive signals via the clocking block handle (e.g., `vif.cb.d <= val`).

4.  **Verify:**
    Run the solution. The race is eliminated because:
    - The DUT samples the stable pre-clock value.
    - The Testbench drives slightly *after* the clock edge, respecting hold times.

## Key Takeaway
Never drive DUT signals directly from a testbench `always` block on the same clock edge. Always use a **Clocking Block** to enforce a clear separation between sampling (Preponed) and driving (Reactive/Observed).
