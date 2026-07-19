# AXI Deadlock Hunt Lab

## Objective

Trace a circular wait across independent AXI channels, identify the actual protocol violation, and distinguish base-protocol assertions from an integration-specific forward-progress policy.

The scenario combines two dependency edges:

1. The master waits for `AWREADY` before asserting source-owned `WVALID`. This is the protocol violation: a source must not wait for `READY` before asserting `VALID`.
2. The slave waits for `WVALID` before asserting `AWREADY`. A destination is allowed to wait before asserting `READY`, so this is a legal but risky implementation policy.

Together those edges form a cycle. The slave FSM also withholds `ARREADY` while the write is pending, so an unrelated read appears stuck behind the write.

## Step 1: Run and observe

Run `testbench.sv` and inspect the signal log. At the stalled point:

- `AWVALID` remains high and `AWREADY` remains low.
- `WVALID` remains low because the master is waiting for `AWREADY`.
- `ARVALID` remains high while the shared slave FSM withholds `ARREADY`.

The final timeout is an integration watchdog. It reports that the waits remain unresolved; it does not claim that a stability assertion can infer an internal dependency from pins.

## Step 2: Draw the dependency graph

Answer these questions before changing code:

1. Which master source signal is incorrectly conditional on a destination `READY` signal?
2. Which legal slave policy completes the directed cycle?
3. Why is the read channel blocked even though reads and writes have separate AXI channels?
4. Which observations are protocol violations, and which require a local latency/service contract?

## Step 3: Complete `axi_deadlock_checker.sv`

The checker is an editable starter file. Implement:

- Separate AW, W, AR, B, and R properties that hold `VALID` and payload stable while stalled.
- State tracking that permits `BVALID` only after both the AW handshake and final W handshake.
- AW, W, and AR bounded-service properties inside `g_service_bounds`.

The stability and response-ordering properties are base protocol checks. The bounded-service properties are deliberately gated by `ENABLE_SERVICE_BOUNDS`; this testbench enables them as an integration/QoS assumption so the unresolved waits produce early diagnostics. AXI itself permits unbounded backpressure, so do not present those bounds as universal protocol requirements.

Compare your completed checker with `solution.sv` only after all three steps have been recorded.
