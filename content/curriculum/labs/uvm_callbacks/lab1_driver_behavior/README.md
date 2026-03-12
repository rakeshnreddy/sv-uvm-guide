# Lab: Modifying Driver Behavior with Callbacks

## Scenario

You have an existing `packet_driver` that works perfectly well for baseline testing. However, the current test scenario requires you to do two things that the base driver does not natively support:
1.  **Inject a parity error** into a specific transaction right before it is driven to the DUT.
2.  **Add a variable delay** to the transaction execution.

You *could* extend the driver and use a factory override to accomplish this. However, since these injected behaviors are test-specific and you might want to toggle them dynamically, a **callback** is the better architectural choice.

Fortunately, the `packet_driver` developer foresaw this and provided a `packet_driver_cb` virtual class with a `pre_drive` task, which is executed via `uvm_do_callbacks` right before the driver interacts with the virtual interface.

## Objective

1.  Review `testbench.sv` and locate the `packet_driver` and `packet_driver_cb` definitions and where the callback hook is executed.
2.  Implement a new callback class, `error_inject_cb`, extending from `packet_driver_cb`.
3.  Inside `error_inject_cb`, override the `pre_drive` task to:
    -   Wait for a 10ns delay.
    -   Flip the `parity` bit of the packet.
4.  In the `my_test` class, instantiate your callback and add it to the driver using the `uvm_callbacks` API.
5.  Run the simulation. You should see the driver print a message reflecting the inserted delay and the modified parity bit.

## Run Instructions

Use your preferred SV-UVM simulator. The driver has `uvm_info` statements that will echo out the transaction details and timestamps so you can verify the delay and data corruption occurred correctly.

```bash
# Example generic simulator command (replace with your specific tool's invocation)
<simulator_run_cmd> testbench.sv
```

## Need Help?

Stuck? Review the [A-UVM-5: UVM Callbacks](../../../T3_Advanced/A-UVM-5_UVM_Callbacks/index.mdx) lesson for the exact syntax to register and instantiate callbacks. You can also view `solution.sv` for the completed working code.
