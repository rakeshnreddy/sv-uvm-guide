# Lab: Injecting a Custom UVM Phase

## Scenario

Your SoC verification environment needs to load firmware images into DUT memory **after** the reset sequence completes but **before** the configuration phase programs any registers. Currently, the team shoehorns firmware loading into `reset_phase` or uses `run_phase` fork-join hacks, causing race conditions and poor readability.

The solution is a dedicated **`load_fw`** task phase in the UVM run-time schedule, between `reset_phase` and `configure_phase`. A custom task phase needs three things:

1. a **singleton** phase class, so the schedule holds one node for it;
2. an **`exec_task`** override, which is how the phase reaches your components (the inherited one does nothing);
3. an **`add()`** call on the schedule that contains its anchor phase. `reset_phase` lives in the uvm run-time schedule (`uvm_domain::get_uvm_schedule()`), not in the common domain.

## Objective

1. Open `testbench.sv` and complete the `load_fw_phase_c` singleton (`m_inst` and `get()`).
2. Override `exec_task` in `load_fw_phase_c` so it casts `comp` to `soc_env` and calls `env.load_fw_phase(phase)`. Then implement `soc_env::load_fw_phase`: raise an objection, check `reset_done`, print `` `uvm_info("ORDER", "load_fw", UVM_LOW) ``, wait 20ns, set `firmware_loaded`, drop the objection.
3. In `base_test::build_phase`, insert the phase with `uvm_domain::get_uvm_schedule().add(load_fw_phase_c::get(), .after_phase(uvm_reset_phase::get()))`. With only `after_phase`, `add()` splices the phase in series: `reset → load_fw → post_reset → … → configure`.
4. Run the simulation and check the order and timestamps in the log.

## Run Instructions

Use your preferred SV-UVM simulator.

```bash
# Example generic simulator command
<simulator_run_cmd> testbench.sv
```

## Before you fix it

The unmodified starter compiles and runs, but `load_fw` never happens, so `configure_phase` reports an error:

```
UVM_INFO  ... @ 0:  uvm_test_top.env [ORDER] reset
UVM_ERROR ... @ 50: uvm_test_top.env [ORDER] Configure phase ran before firmware loading
UVM_INFO  ... @ 50: uvm_test_top.env [ORDER] configure
UVM_INFO  ... @ 60: uvm_test_top.env [ORDER] main
UVM_ERROR ... @ 60: uvm_test_top.env [ORDER] Expected reset -> load_fw -> configure milestones were not observed
```

If you add the phase but skip step 2 (`exec_task`), the phase runs with no objection and ends at once: you get the same errors.

## Expected Output

After the fix (times in ns; the exact prefix format depends on your simulator and timescale):

```
UVM_INFO ... @ 0:  uvm_test_top.env [ORDER] reset
UVM_INFO ... @ 50: uvm_test_top.env [ORDER] load_fw
UVM_INFO ... @ 70: uvm_test_top.env [ORDER] configure
UVM_INFO ... @ 80: uvm_test_top.env [ORDER] main
```

`reset` takes 50ns, `load_fw` 20ns and `configure` 10ns; the phases in between hold no objection and take no time. The report summary shows no `UVM_ERROR` with ID `ORDER`.

## Try the wrong schedule

Change step 3 to call `add()` on `uvm_domain::get_common_domain()` instead. The test stops during `build_phase` with `UVM_FATAL [PH_BAD_ADD] cannot find after_phase 'reset' within node 'common'`: `add()` searches only the node it is called on, and the common domain does not contain `reset`.

## Need Help?

Review the [E-CUST-1: UVM Methodology Customization](/curriculum/T4_Expert/E-CUST-1_UVM_Methodology_Customization/index) lesson for the phase-insertion pattern. You can also view `solution.sv` for the complete working code.
