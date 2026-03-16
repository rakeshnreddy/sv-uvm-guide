# Lab: Block to SoC VIP Reuse

## Scenario

You are bringing up a new SoC. During block-level testing, the SPI peripheral was verified using an active UVM agent that drove stimulus into the APB bus.

Now, at the SoC level, an embedded RISC-V processor (simulated via firmware C-code translated to bus cycles) drives the APB bus to talk to the SPI unit. If your UVM agent remains active, its driver will collide with the processor on the bus, causing fatal X-states. 

Your job is to reuse the block-level VIP **without editing its source code**. You must use the UVM Configuration Database to switch the agent's personality to `UVM_PASSIVE` so its monitor still checks protocol and feeds scoreboards, while the driver and sequencer stay dormant.

## Objective

1. Open `testbench.sv`. Observe the `spi_agent` class. Note how its `build_phase` checks `is_active` to decide whether to create the driver and sequencer.
2. In the `soc_test` class `build_phase()`, add a `uvm_config_db` call to set the agent's `is_active` field to `UVM_PASSIVE`.
3. The instance path you need to target is `"env.spi_agt"`.
4. Run the simulation. 
5. Verify the output log. If successful, you will see firmware traffic logged by the monitor, but the driver creation message will vanish.

## Run Instructions

Use your preferred SV-UVM simulator.

```bash
# Example generic simulator command
<simulator_run_cmd> testbench.sv
```

## Expected Output

**Before fixing (Failure):**
```
UVM_INFO ... [SPI_AGT] Creating driver and sequencer for ACTIVE mode
UVM_FATAL ... [BUS_COLLISION] UVM Driver and SoC Processor are both driving the bus!
```

**After fixing (Success):**
```
UVM_INFO ... [SPI_AGT] Operating in PASSIVE mode (monitors only)
UVM_INFO ... [FIRMWARE] Processor driving WRITE to SPI_CTRL = 0x1
UVM_INFO ... [SPI_MON] Observed APB WRITE to SPI_CTRL = 0x1
```

## Need Help?

Review the [E-SOC-1: SoC-Level Verification Strategies](/curriculum/T4_Expert/E-SOC-1_SoC-Level_Verification_Strategies) lesson for the `uvm_config_db` syntax. View `solution.sv` for the completed testbench.
