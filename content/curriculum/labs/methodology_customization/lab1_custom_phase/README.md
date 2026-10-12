# Lab: Injecting a Custom UVM Phase

Companion lab for E-CUST-1: UVM Methodology Customization (`/curriculum/T4_Expert/E-CUST-1_UVM_Methodology_Customization/index`). Do the phasing lesson first: it teaches the twelve run-time phases and objections that this lab builds on.

## Scenario

Your SoC verification environment needs to load firmware images into DUT memory **after** the reset sequence completes but **before** the configuration phase programs any registers. Today the team squeezes the firmware load into `reset_phase` or into a `run_phase` thread with hand-tuned delays, and the ordering breaks whenever reset timing changes.

In this lab you build a dedicated **`load_fw`** task phase in the UVM run-time schedule, between `reset_phase` and `post_reset_phase`. A custom task phase needs three things:

1. a **singleton phase class** (the phase "IMP"): every `get()` returns the same object. Each `add()` call wraps it in a new schedule node, so register it once;
2. an **`exec_task`** override, which is how the phase reaches your components (the inherited one does nothing);
3. an **`add()`** call on the schedule that contains its anchor phase. `reset_phase` lives in the uvm run-time schedule, not in the common domain. `uvm_domain::get_uvm_schedule()`, used below, is a uvm-core implementation call (it is not in IEEE 1800.2-2020); the lesson shows the standard-only route.

**Would a real team add this phase?** Usually not. `post_reset_phase` or `pre_configure_phase` already sits between reset and configure, and a step in the top virtual sequence would also work. This lab teaches the custom-phase mechanics, and step 5 shows the existing-phase alternative giving the same order. A team adds a custom phase only when every component must take part in a step that no existing phase or sequence can express.

## Objective

1. Open `testbench.sv` and complete the `load_fw_phase_c` singleton (`m_inst` and `get()`).
2. Override `exec_task` in `load_fw_phase_c` so it casts `comp` to `soc_env` and calls `env.load_fw_phase(phase)`. Then implement `soc_env::load_fw_phase`: raise an objection, check `reset_done`, print `` `uvm_info("ORDER", "load_fw", UVM_LOW) ``, wait 20ns, set `firmware_loaded`, increment `fw_loads`, drop the objection.
3. In `base_test::build_phase`, insert the phase with `uvm_domain::get_uvm_schedule().add(load_fw_phase_c::get(), .after_phase(uvm_reset_phase::get()))`. With only `after_phase`, `add()` splices the phase in series: `reset → load_fw → post_reset → … → configure`.
4. Run the simulation and check the order and timestamps in the log.
5. Break it on purpose and predict each log before you run it (see "Break it and predict").

## Run Instructions

The steps are tool-neutral; the switches that do each step are simulator-specific.

1. Compile uvm-core 2020.3.1: its `src/uvm_pkg.sv`, with its `src` directory on the include path (so `` `include "uvm_macros.svh" `` resolves).
2. Compile `testbench.sv` after it, elaborate the top module `tb_top`, and run. The test is fixed by `run_test("base_test")`, so no `+UVM_TESTNAME` is needed.
3. To see the schedule, add the plusarg `+UVM_PHASE_TRACE` (uvm-core implementation): it prints a `PH/TRC/STRT` line when each phase node starts and a `PH/TRC/DONE` or `PH/TRC/SKIP` line when it ends.

UVM support in open-source simulators is still limited; use a simulator whose UVM support you have confirmed.

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

After the fix (times in ns; the exact prefix format depends on your simulator and timescale; these logs were derived by tracing the phase rules, not captured from a particular simulator):

```
UVM_INFO ... @ 0:  uvm_test_top.env [ORDER] reset
UVM_INFO ... @ 50: uvm_test_top.env [ORDER] load_fw
UVM_INFO ... @ 70: uvm_test_top.env [ORDER] configure
UVM_INFO ... @ 80: uvm_test_top.env [ORDER] main
```

`reset` takes 50ns, `load_fw` 20ns and `configure` 10ns; the phases in between hold no objection and take no time. The report summary shows no `UVM_ERROR` with ID `ORDER`.

## Break it and predict

Start each experiment from your working solution. Write down the log you expect, then run.

| Change | Prediction to check |
|---|---|
| (a) Delete the `exec_task` override | The "Before you fix it" errors return: `configure` at 50ns. With `+UVM_PHASE_TRACE`, `load_fw` starts and is skipped (`No objections raised, skipping phase`) at 50ns. |
| (b) Call `add()` on `uvm_domain::get_common_domain()` instead | The test stops during `build_phase` with `UVM_FATAL [PH_BAD_ADD] cannot find after_phase 'reset' within node 'common'`: `add()` searches only the container it is called on, and the common domain does not contain `reset`. |
| (c) Add `.before_phase(uvm_configure_phase::get())` to the `add()` call | The same `[ORDER]` timestamps. But `reset` and `configure` are not neighbours, so `load_fw` becomes a parallel branch: the phase trace shows `post_reset` and `pre_configure` starting at 50ns beside `load_fw`, and `configure` waiting for both paths until 70ns. |
| (d) Remove the `phase_registered` guard and call `register_load_fw_phase()` twice | Two `load_fw` nodes in series: `load_fw` at 50ns and again at 70ns, `configure` at 90ns, `main` at 100ns, and `UVM_ERROR ... [ORDER] Firmware loaded 2 times`. Each `add()` makes a new node. |

## Step 5: do you need the custom phase at all?

Remove the `register_load_fw_phase()` call and move the body of `load_fw_phase` into a `post_reset_phase` task in `soc_env`. Predict the log, then run it: `reset` at 0, `load_fw` at 50 and `configure` at 70ns, exactly as with the custom phase, with no change to the shared schedule. That is why most teams use the existing run-time phases (or a step in the top virtual sequence) for steps like this one.

## Need Help?

Review the [E-CUST-1: UVM Methodology Customization](/curriculum/T4_Expert/E-CUST-1_UVM_Methodology_Customization/index) lesson for the phase-insertion pattern, the visualizer and the "When not to add a custom phase" table. You can also view `solution.sv` for the complete working code.
