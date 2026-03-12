# Lab: Triggering Waveforms via Event Bus

## Scenario

You are debugging a complex SoC environment where a full waveform dump of a passing test takes 50GB of disk space and slows simulation to a crawl. A colleague just checked in a new test that sporadically fails with a `"WATCHDOG_TIMEOUT"` fatal error.

Instead of turning on `+UVM_VERBOSITY=UVM_HIGH` and dumping gigabytes of waveforms, you will use the pre-built `debug_event_bus` to perform a **selective capture**. 

The environment is already wired up: the `watchdog_timer` component publishes an event to the `debug_event_bus` with the tag `"WATCHDOG_TIMEOUT"` roughly 1 millisecond before it brings the simulation down.

## Objective

1. Review `testbench.sv`. Observe the `debug_event_bus` and the `watchdog_timer` that publishes to it.
2. Implement an analysis subscriber named `waveform_trigger_sub`.
3. Inside your subscriber's `write` method, check if the incoming `debug_event` has the tag `"WATCHDOG_TIMEOUT"`.
4. If it matches, trigger a waveform dump using the standard system tasks (`$dumpfile` and `$dumpvars` are used here for generic tool compatibility, but this applies to `$fsdbDumpvars` as well).
5. Add a `$display` or `uvm_info` confirming the capture has started.
6. Connect your subscriber to the `debug_event_bus` in the test environment.
7. Run the simulation. You should see normal traffic run without waveform overhead, then suddenly a short capture start exactly when the timeout event fires.

## Run Instructions

Use your preferred SV-UVM simulator. 

```bash
# Example generic simulator command (replace with your specific tool's invocation)
<simulator_run_cmd> testbench.sv
```

## Need Help?

Stuck? Review the [E-DBG-1: Advanced UVM Debug Methodologies](../../../T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/index.mdx) lesson for the conceptual architecture of an event bus. You can also view `solution.sv` for the completed working code.
