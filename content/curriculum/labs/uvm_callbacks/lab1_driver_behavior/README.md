# Lab: Modifying Driver Behavior with Callbacks

## Scenario

You have an existing `packet_driver` that works perfectly well for baseline testing. However, the current test scenario requires you to do two things that the base driver does not natively support:
1.  **Inject a parity error** into every transaction it drives.
2.  **Add a delay** of two clock cycles before each transaction.

You *could* extend the driver and use a factory override to accomplish this. However, since these injected behaviors are test-specific and you might want to toggle them dynamically, a **callback** is the better architectural choice.

Fortunately, the `packet_driver` developer foresaw this. The driver calls the `pre_drive` hook of `packet_driver_cb` through `` `uvm_do_callbacks `` right before it drives each packet, and it honours two control fields on the packet: `inject_parity_error` (flip the parity bit on the bus) and `extra_delay_cycles` (wait that many clocks first). A parity checker in `packet_if` reports `PARITY_ERR` for every beat whose parity is wrong.

## Objective

1.  Review `testbench.sv`: find `packet_driver_cb`, the `` `uvm_do_callbacks `` call in the driver's `run_phase`, and the `a_parity_ok` assertion in `packet_if`.
2.  Implement `error_inject_cb`, extending `packet_driver_cb`. Override the **function** `pre_drive(packet_driver driver, packet pkt)` to set `pkt.inject_parity_error = 1` and `pkt.extra_delay_cycles = 2`, and print a `CB` message.
3.  In `my_test::connect_phase`, create the callback and attach it to the driver instance with `uvm_callbacks#(packet_driver, packet_driver_cb)::add(env.drv, my_cb)`.
4.  Run the simulation and compare the log with the expected output below.

### Why `connect_phase` and not `build_phase`?

UVM builds top-down: `my_test::build_phase` runs before `my_env::build_phase` creates `env.drv`. In the test's `build_phase`, `env.drv` is still `null`, and `add(null, cb)` does not fail: it registers the callback **type-wide**, so every `packet_driver` in the testbench, including ones created later, would corrupt its traffic. By `connect_phase` every component exists, so `add(env.drv, cb)` attaches the callback to that one instance. Remove it the same way, with `delete(env.drv, cb)`.

## Run Instructions

Use your preferred SV-UVM simulator.

```bash
# Example generic simulator command (replace with your specific tool's invocation)
<simulator_run_cmd> testbench.sv
```

## Expected Output

The sequence sends three random packets. Before your change, the log shows three `DRV` lines with `error=0 delay_cycles=0` and no `PARITY_ERR`. After it, each packet produces:

```
UVM_INFO  ... [CB] Configured parity error and two cycle delay
UVM_INFO  ... [DRV] Drove payload=.. parity=. error=1 delay_cycles=2
UVM_ERROR ... [PARITY_ERR] payload=.. parity=.
```

so the report summary counts three `CB` messages and three `PARITY_ERR` errors: the injected errors are detected, one per packet. Payload values depend on the seed.

## Need Help?

Stuck? Review the [A-UVM-5: UVM Callbacks](/curriculum/T3_Advanced/A-UVM-5_UVM_Callbacks/index) lesson for the exact syntax to register and attach callbacks. You can also view `solution.sv` for the completed working code.
