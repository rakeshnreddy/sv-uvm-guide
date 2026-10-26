# Lab 1: The Race Condition Challenge

## Objective
Understand how race conditions occur in simulation when the testbench and DUT interact without clear timing boundaries, and how to fix them using **Clocking Blocks**.

## The Scenario
You have a simple DUT (Device Under Test) that registers an input `d` to an output `q` on the rising edge of `clk`.
Your testbench drives `d` and checks `q`.

However, the testbench writes `d` with a **blocking** assignment (`d = 8'hA5`) in an `initial` block that wakes on the *same* clock edge as the DUT. Both processes are ready in the Active region of that time slot together, and IEEE 1800-2023 §4.7 lets the simulator run them in either order. This creates a race:
- If the testbench runs first, the DUT's flop reads the *new* value of `d` (8'hA5) at this edge.
- If the DUT runs first, it reads the *old* value (0) and captures 8'hA5 one edge later.

The testbench's later read of `q` is not part of the race. The DUT writes `q` with `<=`, so `q` changes only in the NBA region, and a read in the Active region of the same edge always sees the value from before that edge.

**Why not `d <= 8'hA5`?** A nonblocking write at the edge does not race. Its update is scheduled in the NBA region (§4.4.2.4, §10.4.2), after every Active-region process, the DUT's flop included, has read `d`. The DUT therefore always reads the old 0 at this edge and captures 8'hA5 one edge later. A check written for "captured at this edge" then fails on every run: the result is deterministic and one cycle later than the author expected, not a race.

## Instructions

1.  **Run the Failing Test:**
    Execute the `testbench.sv` file.
    ```bash
    # If you have a simulator installed (e.g., Verilator, Icarus)
    # This is a conceptual lab, so we will analyze the code.
    ```
    *Observation:* The printed line depends on which process the simulator picks first at the drive edge. Testbench first prints `Match (Lucky!)`; DUT first prints `Mismatch! Possible Race Condition.` The standard leaves that order open (§4.7), so the result can change between simulators, between versions, or after an unrelated code change. One tool may print the same line on every run; that does not make the code safe.

2.  **Analyze the Code:**
    Open `testbench.sv`. Notice how the `initial` block writes `d = 8'hA5` with a blocking assignment right after `@(posedge clk)`. The DUT's `always_ff` also reads `d` at `@(posedge clk)`. Both wake on the same edge and run in the Active region in an order the standard does not fix. This is the race. The comments in the file also show why `d <= 8'hA5` would not race and why the read of `q` is deterministic.

3.  **Fix with Clocking Blocks:**
    Open `solution.sv` (or modify `testbench.sv`).
    - Create an `interface` with a `clocking` block.
    - Set the input skew to `#1step` (samples the value from just before the edge, the Preponed value) and the output skew to `#1ns` (drives 1 ns after the edge).
    - Update the testbench to drive signals via the clocking block handle (e.g., `vif.cb.d <= val`) and to read `q` via `vif.cb.q`.

4.  **Verify:**
    Run the solution. The race is eliminated because:
    - The testbench no longer changes `d` in the Active region. `vif.cb.d <= 8'hA5` is a clocking drive, so `d` changes only in the Re-NBA region (§14.16). With this lab's `output #1ns`, that is the Re-NBA region of the time slot 1 ns after the edge; with a zero output skew, it would be the Re-NBA region of the edge's own time slot. Either way, the DUT has already read the old `d` at that edge, in every process order.
    - The testbench reads `q` through `vif.cb.q`. With `#1step`, that is the value `q` had just before the edge (§4.4.2.1, §14.13), so the read does not depend on process order either.

    Count the edges: a drive issued at clocking event k lands 1 ns later, the DUT captures it at edge k+1, and the first `vif.cb.q` read that sees it is at edge k+2. That is why `solution.sv` prints `DUT Output: 00` first and checks `q` one cycle later. (Both `.sv` files set `` `timescale 1ns/1ps ``, so the 10 ns clock period is longer than the 1 ns output skew.)

## Key Takeaway
A blocking write to a DUT input at the clock edge the DUT samples is a race (§4.7). A nonblocking write at that edge is deterministic, but the DUT sees the new value one edge later than the code seems to say. In a testbench, drive and sample through a **Clocking Block**: inputs are sampled just before the edge (`#1step`, the Preponed value), and drives are applied in the Re-NBA region (§14.16), in the edge's own time slot with zero output skew or the output skew later. They never change a DUT input in the Active region where the DUT reads it.
