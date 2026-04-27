# Lab: Mini UVM FIFO Environment Capstone

## Scenario

You are handed a small packet FIFO DUT and asked to build the first reusable UVM environment around it. The lab is intentionally small enough to finish in one sitting, but it touches the same architecture reviewers expect in a production block-level environment: sequence item, sequence, sequencer, driver, monitor, active agent, scoreboard, coverage subscriber, environment wiring, and a factory override.

The DUT includes an optional injected bug. When `INJECT_FIFO_BUG` is defined, a read of `8'hA5` returns the next queue entry instead of the front entry. A complete environment must catch this without waveform inspection.

## Objectives

1. Complete the active FIFO agent:
   - `fifo_txn`
   - `fifo_driver`
   - `fifo_monitor`
   - `fifo_sequencer`
   - `fifo_agent`
2. Connect monitor traffic into both:
   - `fifo_scoreboard`
   - `fifo_coverage`
3. Use a factory override so the test creates `fifo_base_seq` but runs `fifo_capstone_seq`.
4. Prove the scoreboard catches the injected FIFO ordering bug.
5. Prove the fixed DUT reaches the required coverage bins.

## Files

- `testbench.sv` - starter code with TODOs.
- `solution.sv` - complete reference solution.
- `lab.json` - lab metadata used by the practice registry.

## Run Instructions

Simulator flags vary by vendor, but the intended runs are:

```bash
# Bug exposure run: this should report a scoreboard mismatch.
<simulator_uvm_command> +define+INJECT_FIFO_BUG solution.sv

# Fixed-DUT run: this should report zero mismatches and coverage closure.
<simulator_uvm_command> solution.sv
```

If your simulator supports UVM through a package switch, include that switch. If it needs source paths, include the UVM library and `uvm_macros.svh` include directory.

## Acceptance Criteria

- The agent is active and contains a sequencer, driver, and monitor.
- The driver consumes sequence items through `seq_item_port`.
- The monitor is passive and publishes observed transactions through an analysis port.
- The scoreboard uses an internal queue reference model and reports the `8'hA5` ordering bug when `INJECT_FIFO_BUG` is enabled.
- The coverage subscriber samples write/read operations, data classes, depth states, and operation-by-depth crosses.
- The test starts a base sequence type that is factory-overridden to the capstone sequence.
- The fixed-DUT run reports zero scoreboard mismatches and coverage at or above the threshold in `solution.sv`.

## Debug Prompts

1. If the scoreboard reports zero matches and zero mismatches, which connection is most likely missing?
2. Why should the monitor publish observed transactions instead of the driver publishing intended transactions?
3. What changes if the agent is configured as `UVM_PASSIVE`?
4. Where does the factory override prove it worked: build log, sequence type, or scoreboard result?
5. Which coverage bin tells you the environment exercised a read from a full FIFO?

## References

- IEEE 1800.2-2020, UVM component hierarchy and factory construction.
- IEEE 1800.2-2020, Clause 12 TLM interfaces and analysis ports.
- IEEE 1800-2023, SystemVerilog classes, covergroups, and procedural timing semantics.

