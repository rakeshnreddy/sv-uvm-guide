# RAL Mirror Bug Lab

You have a UVM environment with a simple codec IP. The RAL model, adapter, and predictor are all instantiated, but **frontdoor writes are not updating the mirror**. The `mirror()` check fails because the mirrored value stays at the reset value even after successful writes.

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
   Re-run the simulation. The mirror should now track writes correctly and `mirror(UVM_CHECK)` should pass.

## Debugging Heuristic

When the RAL mirror does not update:
1. Is the predictor instantiated? → Check `build_phase`.
2. Is `predictor.map` assigned? → Must point to the register map.
3. Is `predictor.adapter` assigned? → Must point to your bus adapter.
4. Is the monitor's AP connected to `predictor.bus_in`? → **This is the most commonly missed step.**
5. Is `set_auto_predict(1)` enabled? → If so, the predictor pipeline is bypassed entirely.
