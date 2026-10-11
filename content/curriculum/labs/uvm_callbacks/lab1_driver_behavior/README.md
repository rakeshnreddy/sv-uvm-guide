# Lab: Modifying Driver Behavior with Callbacks

## Scenario

The environment has two identical drivers, `env.drv0` and `env.drv1`, each with its own sequencer and its own `packet_if` interface (`vif0` and `vif1`). The `packet_driver` works well for baseline testing. An error test now needs two things that the base driver does not do on its own, **on `drv0` only**:

1. **Inject a parity error** into every packet it drives.
2. **Add a delay** of two clock cycles before each packet.

`drv1` must keep sending clean packets.

The driver's author foresaw this. The driver calls the `pre_drive` hook of `packet_driver_cb` through `` `uvm_do_callbacks `` right before it drives each packet, and it honours two control fields on the packet: `inject_parity_error` (flip the parity bit on the bus) and `extra_delay_cycles` (wait that many clocks first). A parity checker in each `packet_if` reports `PARITY_ERR` for every beat whose parity is wrong, and names its interface instance (`%m`), so you can tell `vif0`'s errors from `vif1`'s.

**Why a callback here?** The packet already has the control fields, so an error sequence, or a factory override of the packet type with a constraint, could also set them. The callback is the right tool because of three requirements of this test: it must not change the reused sequences, it must target one driver instance, and it must be possible to switch it on and off during the run. A factory override of the driver would also work, but it needs a new driver class and cannot be switched at run time.

## Objective

1. Review `testbench.sv`: find `packet_driver_cb`, the `` `uvm_do_callbacks `` call in the driver's `run_phase`, the `a_parity_ok` assertion in `packet_if`, and the `display()` call in `my_test::end_of_elaboration_phase`.
2. Implement `error_inject_cb`, extending `packet_driver_cb`. Override the **function** `pre_drive(packet_driver driver, packet pkt)` to set `pkt.inject_parity_error = 1` and `pkt.extra_delay_cycles = 2`, and print a `CB` message.
3. Write `my_test::connect_phase`: create the callback and attach it to `env.drv0` only, with `uvm_callbacks#(packet_driver, packet_driver_cb)::add`.
4. Run the simulation and compare the log with the expected output below.
5. Break it on purpose (step 4 of the lab), then stack and switch two callbacks (step 5, optional).

### Why `connect_phase` and not `build_phase`?

UVM builds top-down: `my_test::build_phase` runs before `my_env::build_phase` creates `env.drv0`. In the test's `build_phase`, `env.drv0` is still `null`, and `add(null, cb)` does not fail: it registers the callback **type-wide**, so every `packet_driver` in the testbench, including ones created later, would corrupt its traffic. By `connect_phase` every component exists, so `add(env.drv0, cb)` attaches the callback to that one instance. Remove it the same way, from the same instance.

## Run Instructions

Use a simulator with UVM support (uvm-core 2020.3.1, or the UVM your simulator ships). The in-browser runner offers Icarus and Verilator, which cannot run this UVM lab, so run it with your own simulator.

```bash
# Example generic simulator command (replace with your specific tool's invocation)
<simulator_run_cmd> testbench.sv
```

## Expected Output

Each sequence sends three random packets, one sequence per driver.

**Before your change**, the log shows six `DRV` lines with `error=0 delay_cycles=0`, no `CB` lines and no `PARITY_ERR`. The `display()` output says that no callbacks are registered for `packet_driver`.

**After your change**, `display()` lists `my_cb` on `uvm_test_top.env.drv0` only, as `ON`:

```
Registered callbacks for all instances of packet_driver
---------------------------------------------------------------
my_cb   uvm_test_top.env.drv0 on   ON
```

and the run reports:

- 3 `CB` messages, all from `drv0`'s packets;
- 6 `DRV` lines: 3 from `uvm_test_top.env.drv0` with `error=1 delay_cycles=2`, and 3 from `uvm_test_top.env.drv1` with `error=0 delay_cycles=0`;
- 3 `PARITY_ERR` errors, all naming the `vif0` instance (for example `tb_top.vif0.a_parity_ok`; the exact form of `%m` is tool-dependent), and none from `vif1`.

For `drv0`, the lines come in this order:

```
CB, DRV(1), CB, PARITY_ERR(1), DRV(2), CB, PARITY_ERR(2), DRV(3), PARITY_ERR(3)
```

The checker reports a packet one clock after the driver puts it on the bus, in the same time step as that packet's `DRV` line. The assertion's action block runs late in that time step, after the driver has already fetched the next packet and run its hook, so each `PARITY_ERR` follows the next packet's `CB` line. `drv1`'s lines interleave with these by time. The payload values depend on the seed.

The test sets a drain time of 20 ns before it drops its objection. Without it, the run ends in the time step of the last check, and the third `PARITY_ERR` is never printed.

**This run fails on purpose.** The report summary counts 3 `UVM_ERROR`s, so by the UVM pass/fail rule the test fails: the injected errors are detected, which is what this lab wants to see. In a real error test, the checker is told to expect the injected errors and does not count them as failures; that expected-error accounting is the subject of a planned module on reset handling and error injection.

## Step 4: Break it on purpose

1. Move the `add()` call (and the creation of `my_cb`) from `connect_phase` into `my_test::build_phase`, right after `env` is created.
2. Change the `final_phase` delete to `delete(null, my_cb)`. A type-wide callback is not in `drv0`'s own queue, so deleting it from `env.drv0` is wrong; in uvm-core 2020.3.1, `delete` on an object that has no queue of its own also dereferences a null queue (found by reading the source).
3. **Predict** before you run: how many `CB` lines, how many `PARITY_ERR` errors, from which interfaces, and what does `display()` print?
4. Run and compare.

You should see 6 `CB` lines, 6 `DRV` lines with `error=1 delay_cycles=2`, and 6 `PARITY_ERR` errors, 3 from `vif0` and 3 from `vif1`. `display()` shows the callback as a type-wide `(*)` row:

```
Registered callbacks for all instances of packet_driver
---------------------------------------------------------------
No callbacks registered for any instances of type packet_driver
my_cb   (*) on   ON
```

The "No callbacks registered for any instances" line only means that no driver has its own queue; the `(*)` row is a type-wide callback that every `packet_driver` runs. With one driver, this mistake would give exactly the same log as the correct solution; the second driver is what exposes it. Put the call back in `connect_phase` when you are done.

## Step 5 (optional): Stack and switch

1. Split `error_inject_cb` into two callbacks: `delay_cb` (sets `extra_delay_cycles = 2`) and `parity_err_cb` (sets `inject_parity_error = 1`).
2. Make `parity_err_cb` switch itself off after its second packet: keep a counter in the callback, and when it reaches 2 call `void'(callback_mode(0))`. This is safe inside a hook, because it changes no queue.
3. In `connect_phase`, add `parity_err_cb` to `env.drv0`, then add `delay_cb` to `env.drv0` with `UVM_PREPEND`.
4. **Predict** the `display()` output (which callback is listed first?) and the number of `PARITY_ERR` errors, then run.

You should see `delay_cb` listed before `parity_err_cb` on `uvm_test_top.env.drv0`, all 3 of `drv0`'s packets delayed by two cycles, and exactly 2 `PARITY_ERR` errors, both from `vif0`. After the run, `parity_err_cb` is `OFF`.

## Need Help?

Stuck? Review the [A-UVM-5: UVM Callbacks](/curriculum/T3_Advanced/A-UVM-5_UVM_Callbacks/index) lesson for the syntax to register and attach callbacks, the queue rules and the debugging table. You can also view `solution.sv` for the completed working code of steps 1 to 3.
