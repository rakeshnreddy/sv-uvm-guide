# Lab 2: The Scheduler & Race Conditions

## Objective
Fix a broken pipeline that is dropping data due to SystemVerilog race conditions. You will learn why `blocking` vs `non-blocking` assignments matter and how the scheduler orders events.

## The Scenario
You are designing a simple 2-stage pipeline. Data should flow from `Stage 1` -> `Stage 2` -> `Output`.
However, the current implementation uses blocking assignments (`=`) for sequential logic. This causes a race condition where data might "skip" a stage or get lost depending on the simulator's arbitrary execution order.

## Your Task
1.  Run the simulation (mentally or with a tool if available). Notice that `data_out` might update too early or unpredictably.
2.  Refactor the `always` blocks to use the correct assignment type for sequential logic.
3.  Ensure the testbench uses `initial` blocks correctly to drive stimulus without racing against the clock.

## Hints
- **Sequential Logic (Flip-Flops):** Always use **Non-Blocking** assignments (`<=`).
- **Combinational Logic:** Use **Blocking** assignments (`=`).
- **Stimulus:** Drive signals relative to the clock edge (e.g., `@(posedge clk)`) to avoid setup/hold violations in your mental model.

## Success Criteria
- The pipeline correctly delays data by 2 clock cycles.
- No race conditions exist between the pipeline stages.
