# Lab: Block to SoC VIP Reuse

This lab belongs to [E-SOC-1: SoC-Level Verification Strategies](/curriculum/T4_Expert/E-SOC-1_SoC-Level_Verification_Strategies/index). It uses the same small SoC and the same class names as that lesson's Make It Work example, so read the lesson's "Active and passive reuse" and "Firmware and the testbench" sections first.

## Scenario

The SPI block team verified its block with an **active** UVM agent on the block's **APB register port**: the agent's sequencer and driver played the CPU and wrote the block's `CTRL` and `TXDATA` registers.

In the SoC (`mini_soc` in `testbench.sv`), a CPU running boot firmware drives that same APB port. (The CPU is modelled as a bus-functional model: the firmware is reduced to the five APB transfers it makes.) The firmware reports its progress by writing codes to a mailbox register, and a SoC-only `mbx_decoder` turns those writes into `uvm_event`s the test waits on.

The SoC team reused the block team's environment (`spi_blk_env` with `spi_apb_agent`, `apb_monitor` and `spi_reg_scb`) without editing it, and copied the block test into `soc_test`. That copy still starts the block team's bring-up sequence, and nothing makes the agent passive. Your job is to make the reused VIP watch instead of drive, and to **prove** with evidence from the log that it is watching the right bus.

The APB signals in `apb_if` are **nets** (`wire`). When two drivers disagree, a net resolves to `X`, and the SoC-level assertion `a_apb_known` in `tb_top` reports `UVM_ERROR [APB_X]`. (If the signals were variables, the last write would win silently. The lesson explains why that is worse.)

## Files

- `testbench.sv`: the starter. Edit `soc_test`, and `tb_top` in step 4. Do not edit the block team's classes except in the step 5 drill.
- `solution.sv`: the bench after steps 1 to 3. Open it only after you have finished them.

## Run instructions

Compile uvm-core 2020.3.1 (or your simulator's IEEE 1800.2 UVM library) together with the bench, with top module `tb_top`:

```bash
# tool-neutral outline; the exact switches differ per simulator
<compile> +incdir+$UVM_HOME/src $UVM_HOME/src/uvm_pkg.sv testbench.sv
<simulate> tb_top +UVM_TESTNAME=soc_test
```

The file sets `` `timescale 1ns/1ps ``. Open-source Verilator's support for UVM and for clocking blocks is still limited; check its release notes before relying on it for this lab.

## Steps

1. **Observe the failure.** Run the starter unchanged. In the topology printed at the start, find `sequencer` and `driver` under `uvm_test_top.env.spi_env.spi_agent`. Then find the `UVM_ERROR [APB_X]` messages, the missing `[MBX] firmware reports BOOT_DONE` line, the `UVM_ERROR [FW_TIMEOUT]` after 10 us, and `UVM_ERROR [TRAFFIC_COUNT]` in the check phase. Explain in one sentence why the driver and the CPU produce `X` on the bus.
2. **Make the agent passive.** In `soc_test::build_phase`, set `is_active` to `UVM_PASSIVE` with `uvm_config_db#(uvm_active_passive_enum)::set`, using the exact path `"env.spi_env.spi_agent"` relative to the test. Rerun. The topology now shows only the monitor, and the run stops with `UVM_FATAL [SEQ]` at the first `start_item()`. Explain why: which handle is null, and which line of `soc_test` uses it?
3. **Give the bus to the firmware, and audit the build.** Remove the block bring-up sequence (`cfg_seq` and its `start()` call) from `soc_test::run_phase`: in the SoC, firmware configures the block. In `end_of_elaboration_phase`, after `print_topology()`, add a check that raises `` `uvm_fatal("MODE", ...) `` unless `env.spi_env.spi_agent.get_is_active()` is `UVM_PASSIVE`. Rerun and compare with the expected output below.
4. **Prove the evidence check works.** In `tb_top`, temporarily publish `spare_bus` instead of `apb_bus` as the agent's `"vif"`. Rerun. The monitor is now connected to an idle bus. Which message names the monitor as the problem, and why would a bench without the transfer-count check be harder to debug? Restore `apb_bus`.
5. **Drill: the forgotten `super.build_phase`.** Temporarily comment out `super.build_phase(phase);` in `spi_apb_agent::build_phase`. Rerun. The topology shows the driver and sequencer again and your step 3 audit stops the run with `UVM_FATAL [MODE]`. Explain why the `is_active` setting was ignored. Restore the line.

## Expected output

Illustrative: traced by hand from the code and the uvm-core 2020.3.1 sources, not captured from a simulator run. File names, line numbers and times are omitted.

**Step 1 (starter, agent left active).** The exact number of `APB_X` errors depends on timing; what matters is which messages appear.

```text
UVM_INFO ... reporter [UVMTOP] UVM testbench topology:
  ...
        spi_agent       spi_apb_agent
          driver        apb_driver
          monitor       apb_monitor
          sequencer     uvm_sequencer
UVM_ERROR ... reporter [APB_X] X on APB control: is a second master driving the bus?
  ... (repeated on every edge where the driver and the CPU disagree)
UVM_ERROR ... uvm_test_top [FW_TIMEOUT] no BOOT_DONE and FW_PASS within 10 us
UVM_ERROR ... uvm_test_top.env [TRAFFIC_COUNT] expected 5 transfers from firmware
```

**Step 2 (passive, block sequence still started).**

```text
UVM_FATAL ... [SEQ] neither the item's sequencer nor dedicated sequencer has been supplied to start item ...
```

**Step 3 (the solution).**

```text
UVM_INFO ... reporter [UVMTOP] UVM testbench topology:
  ...
        spi_agent       spi_apb_agent
          monitor       apb_monitor
UVM_INFO ... uvm_test_top.env.spi_env.spi_agent.monitor [APB_MON] WR addr=0x100 data=0x00000001
UVM_INFO ... uvm_test_top.env.mbx_dec [MBX] firmware reports BOOT_DONE
UVM_INFO ... uvm_test_top [TEST] boot complete: system checks enabled
UVM_INFO ... [APB_MON] WR addr=0x000 data=0x00000009
UVM_INFO ... [APB_MON] RD addr=0x000 data=0x00000009
UVM_INFO ... [APB_MON] WR addr=0x004 data=0x000000a5
UVM_INFO ... [APB_MON] WR addr=0x100 data=0x00000002
UVM_INFO ... uvm_test_top.env.mbx_dec [MBX] firmware reports FW_PASS
UVM_INFO ... uvm_test_top [TEST] firmware test finished
UVM_INFO ... uvm_test_top.env [SOC_ENV] spi_agent monitor saw 5 transfers
UVM_INFO ... uvm_test_top.env.spi_env.scb [SCB_SUMMARY] matches=1 mismatches=0 pending=0
UVM_ERROR :    0
UVM_FATAL :    0
```

**Step 4 (monitor on the idle bus).** `[SOC_ENV] spi_agent monitor saw 0 transfers` and `UVM_ERROR [TRAFFIC_COUNT]`; the test also reports `FW_TIMEOUT`, because the mailbox decoder listens to the same monitor.

**Step 5 (no `super.build_phase`).** The topology shows `driver` and `sequencer` again, then `UVM_FATAL [MODE]`.

## You are done when

- The step 3 log shows no `driver` or `sequencer` under `spi_agent`, the monitor saw exactly 5 transfers, `SCB_SUMMARY matches=1 mismatches=0 pending=0`, and `UVM_ERROR :    0`, `UVM_FATAL :    0`.
- You can name the message each of the five mistakes produces: agent left active (`APB_X`), block sequence on a passive agent (`SEQ`), monitor on the wrong bus (`TRAFFIC_COUNT`), forgotten `super.build_phase` (`MODE`), and a missing `is_active` setting once the step 3 audit is in place (`MODE`; before the audit, the same omission showed up as `APB_X` in step 1).

## Debrief questions

1. Which interfaces of a real SoC would keep an **active** agent, and why?
2. The scoreboard `spi_reg_scb` ignores every address with bit 8 set (`t.addr[8]`), which in this map separates the mailbox at `0x100` from the SPI block's registers at `0x000` and `0x004`. Why was that adaptation needed at SoC level but not at block level?
3. Why does the test wait with `wait_on()` rather than `wait_trigger()`?

## Need help?

Review the lesson's "Active and passive reuse" and "Debugging at SoC" sections. Open `solution.sv` only after you have tried steps 1 to 3.
