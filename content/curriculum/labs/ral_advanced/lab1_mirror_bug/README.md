# RAL Mirror Bug Lab

You have a UVM environment with a simple codec IP. The RAL model, adapter, and predictor are all instantiated, but **frontdoor writes are not updating the mirror**. The completed environment uses this runnable path:

```text
RAL write()
  -> adapter.reg2bus()
  -> bus sequencer/driver
  -> DUT
  -> monitor analysis_port
  -> uvm_reg_predictor.bus_in
  -> register mirror update
```

## Scenario

The test calls `ral.status.write(s, 'h55)` and the DUT receives the write correctly. However, when the test later calls `ral.status.mirror(s, UVM_CHECK)`, the mirror value is `0x0000` (reset) instead of `0x0055`. The simulation log shows:

```
UVM_ERROR: reg status: mirror value 0x0000 does not match read value 0x0055
```

## Your Mission

1. **Step 1 — Identify the Frozen Mirror**: Run the simulation. Observe that every `mirror(UVM_CHECK)` call fails with the same stale reset value, even though bus writes succeed.

2. **Step 2 — Trace the Predictor Pipeline**: Open `testbench_buggy.sv` and look at `connect_phase()`. The predictor and adapter are both created in `build_phase`, but is the bus monitor's analysis port actually connected to the predictor's `bus_in`? Without this connection, the predictor never sees transactions and the mirror stays frozen.

3. **Step 3 — Fix the Connect Phase**: Add the missing connection:
   ```systemverilog
   axi_agt.monitor.ap.connect(predictor.bus_in);
   ```
   Re-run the simulation. The expected milestones are a successful frontdoor write, a read of `0x55`, and a passing `mirror(UVM_CHECK)`. Disconnect the analysis port intentionally to reproduce the frozen-mirror failure.

## Select One Prediction Strategy

This lab demonstrates **explicit prediction**, so `cfg_map.set_auto_predict(0)` is required. The monitor publishes completed bus operations to `uvm_reg_predictor`, which updates the mirror. Auto prediction is a separate valid strategy for simpler environments, but it updates the mirror from the RAL transaction path. Do not enable auto prediction while also explicitly predicting the same operation; the mirror should have one owner per transaction.

## Debugging Heuristic

When the RAL mirror does not update:
1. Is the predictor instantiated? → Check `build_phase`.
2. Is `predictor.map` assigned? → Must point to the register map.
3. Is `predictor.adapter` assigned? → Must point to your bus adapter.
4. Is the monitor's AP connected to `predictor.bus_in`? → **This is the most commonly missed step.**
5. Is `set_auto_predict(0)` selected for this explicit-predictor lab? → Explicit and auto prediction should not both update the same transaction.
