# Lab: Building a Self-Checking Scoreboard with Reference Model

## Scenario

You have a simple ALU DUT that takes two 8-bit operands and a 2-bit opcode, producing a 16-bit result. A UVM environment with a driver and monitor is already wired up and working. The monitor broadcasts transactions via an analysis port.

However, the environment **has no scoreboard** — the tests run but never check if the ALU output is correct. Your job is to build a self-checking scoreboard that:
1. Collects input transactions from the monitor
2. Computes the expected result using a reference model function
3. Compares the DUT output against the expected result
4. Reports PASS/FAIL for each transaction

## Objective

1. Review `testbench.sv` and understand the `alu_transaction`, `alu_monitor`, and the existing environment structure.
2. Implement the `alu_scoreboard` class:
   - Extend `uvm_scoreboard`
   - Create a `uvm_tlm_analysis_fifo #(alu_transaction)` to receive transactions
   - Implement a `run_phase` that loops forever, getting transactions from the FIFO
   - Write a `reference_model()` function that computes the expected ALU result
   - Compare actual vs. expected and report using `uvm_info` / `uvm_error`
3. Wire the scoreboard into the environment's `build_phase` and `connect_phase`.
4. Run the simulation. You should see comparison messages for each transaction.

## Key Concepts

- **Analysis FIFO:** Decouples the monitor's write timing from your comparison logic
- **Reference model:** A simple function that mirrors the DUT's expected behavior
- **Self-checking:** The testbench reports pass/fail without manual waveform inspection

## Run Instructions

```bash
# Example generic simulator command
<simulator_run_cmd> testbench.sv
```

## Success Criteria

- All 20 random transactions produce a PASS comparison message
- If you intentionally break the reference model (e.g., wrong ADD logic), you should see `uvm_error` messages

## Need Help?

Stuck? Review the [A-UVM-6: Scoreboards and Reference Models](../../../T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index.mdx) lesson. You can also view `solution.sv` for the completed working code.
