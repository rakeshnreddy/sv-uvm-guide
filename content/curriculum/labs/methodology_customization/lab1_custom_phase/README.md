# Lab: Injecting a Custom UVM Phase

## Scenario

Your SoC verification environment needs to load firmware images into DUT memory **after** the reset sequence completes but **before** the configuration phase programs any registers. Currently, the team shoehorns firmware loading into `reset_phase` or uses `run_phase` fork-join hacks, causing race conditions and poor readability.

The solution is to insert a dedicated **`load_fw_phase`** into the UVM common domain schedule. The phase class skeleton is already provided—you need to complete the singleton pattern, insert it into the schedule, and implement the phase task in the environment.

## Objective

1. Open `testbench.sv` and review the `load_fw_phase` class skeleton.
2. Complete the singleton `get()` method so UVM can find a single canonical phase instance.
3. In `base_test::build_phase`, insert your custom phase after `reset_phase` using `uvm_domain::get_common_domain().add()`.
4. In `soc_env`, implement the `load_fw_phase` task to print a firmware-load banner and wait 20ns simulating the load latency.
5. Run the simulation and verify the phase ordering in the log output: `reset_phase` → `load_fw_phase` → `configure_phase`.

## Run Instructions

Use your preferred SV-UVM simulator. The testbench has `uvm_info` statements in each phase so you can verify the execution order from the log timestamps.

```bash
# Example generic simulator command
<simulator_run_cmd> testbench.sv
```

## Expected Output

```
UVM_INFO ... [PHASE] Entering reset_phase @ 0ns
UVM_INFO ... [PHASE] Entering load_fw_phase @ 50ns
UVM_INFO ... [FW]    Loading firmware image... @ 50ns
UVM_INFO ... [FW]    Firmware loaded @ 70ns
UVM_INFO ... [PHASE] Entering configure_phase @ 70ns
UVM_INFO ... [PHASE] Entering main_phase @ 70ns
```

## Need Help?

Review the [E-CUST-1: UVM Methodology Customization](/curriculum/T4_Expert/E-CUST-1_UVM_Methodology_Customization) lesson for phase insertion syntax. You can also view `solution.sv` for the complete working code.
