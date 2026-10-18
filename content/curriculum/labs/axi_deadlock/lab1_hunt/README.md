# AXI Deadlock Hunt Lab

## Objective

Trace a circular wait across independent AXI channels, find the actual protocol violation, tell it apart from a legal but risky destination policy, and keep base-protocol assertions separate from an integration-specific service contract. Then switch on the fixed master and prove that the same strict slave now completes every transaction.

The scenario combines two dependency edges ("X waits for Y"):

1. **The master's WVALID waits for AWREADY.** This is the protocol violation: a source must not wait for READY before asserting VALID (IHI0022E §A3.2.1, §A3.3.1).
2. **The slave's AWREADY waits for WVALID.** A destination may wait for VALID before asserting READY (§A3.3.1), so this is a legal but risky policy. The slave implements the wait through a register (`aw_ready_q`), because §A3.1.1 forbids combinational paths from inputs to outputs at an AXI interface.

Together those edges form a closed loop. The slave also accepts reads only in its IDLE state, so an unrelated read waits behind the stuck write.

## Files and how to run

| File | Role |
|---|---|
| `testbench.sv` | Reference bench (read-only): clock, reset, master stimulus, `strict_slave`, logger and a 2000 ns watchdog |
| `axi_deadlock_checker.sv` | Your starter checker (editable) |
| `solution.sv` | Reference checker; same module name, so compile it **instead of** the starter |

You need a local SystemVerilog simulator with concurrent-assertion support: the in-browser workspace only stores your edits. Compile `testbench.sv` together with `axi_deadlock_checker.sv` (top module `top`). Run once with no plusarg (buggy master) and, in Step 4, once with `+FIX_MASTER`.

## Step 1: Run and observe

Run with no plusarg. The log starts like this (times in ns):

```text
# 0 ns: RESET asserted (buggy master)
# 95 ns: RESET deasserted
# 115 ns: Master: AWVALID for write ID=1, ADDR=0x1000
# 125 ns: Master: ARVALID for read ID=3, ADDR=0x3000
# 195 ns: AWVALID=1 AWREADY=0 | WVALID=0 WREADY=1 | ARVALID=1 ARREADY=0
...
# 2000 ns: TIMEOUT: integration watchdog stopped unresolved channel waits
```

At the stalled point:

- `AWVALID` stays HIGH and `AWREADY` stays LOW.
- `WVALID` stays LOW although `WREADY` is HIGH: the slave is ready for data and the master is not sending it, because the master is waiting for `AWREADY`.
- `ARVALID` stays HIGH while the slave keeps `ARREADY` LOW: the read is queued behind the write.

The starter checker reports nothing yet. Once you complete Step 3, the solution's service bounds (`MAX_WAIT` = 32, enabled by the testbench) report one failure per stalled channel: the AW contract at 445 ns and the AR contract at 455 ns. The first failure is the diagnostic; nothing else fires before the TIMEOUT line. No stability assertion fires, because every pin the buggy master drives is legal: its illegal wait is inside the master.

The TIMEOUT line is an integration watchdog. It reports that waits remain unresolved; it does not claim that a pin-level assertion can infer an internal dependency.

## Step 2: Draw the dependency graph

Answer these questions before changing code:

1. Which master source signal is wrongly conditional on a destination `READY` signal? Find the line in the master stimulus.
2. Which legal slave policy completes the loop? Find it in `strict_slave`.
3. Why is the read blocked even though reads and writes have separate AXI channels?
4. Why is the slave's wait implemented as `aw_ready_q`, set one edge after WVALID is seen, instead of `assign AWREADY = ... && WVALID`?
5. Which observations are protocol violations, and which need a local latency or service contract?

## Step 3: Complete `axi_deadlock_checker.sv`

Implement:

- Separate AW, W, AR, B and R properties that hold `VALID` and the payload stable while stalled (§A3.2.1).
- Handshake counters for AW, WLAST and B, and the AXI4 write response check `BVALID |-> aw_cnt > b_cnt && wlast_cnt > b_cnt` (§A3.3.1). Counters stay correct with several writes in flight; set and clear flags lose a handshake that lands on the same edge as a B handshake.
- AW, W and AR service-bound properties inside `g_service_bounds`, started once per stall with `$rose(VALID && !READY)`. The common form `VALID |-> ##[0:MAX_WAIT] READY` starts a new attempt every cycle and floods the log with one failure per cycle after the first.

The stability and response-ordering properties are base protocol checks. The service bounds are gated by `ENABLE_SERVICE_BOUNDS`; this testbench enables them as an integration contract so that the unresolved waits produce an early diagnostic. AXI itself permits unbounded backpressure, so label those messages `[Integration contract]`, never as AXI rules.

## Step 4: Fix the master and prove progress

The fixed master raises `WVALID` together with `AWVALID`, and each VALID waits only for its own handshake. Before you run it, predict the edge of each handshake from the code, then run with `+FIX_MASTER`. With your completed checker you should see:

```text
# 0 ns: RESET asserted (fixed master)
# 95 ns: RESET deasserted
# 115 ns: Master: AWVALID for write ID=1, ADDR=0x1000
# 125 ns: Master: ARVALID for read ID=3, ADDR=0x3000
# 165 ns: Master: B received, BID=1 BRESP=0
# 195 ns: Master: R received, RID=3 RDATA=0xcafebabe
# 195 ns: AWVALID=0 AWREADY=0 | WVALID=0 WREADY=0 | ARVALID=0 ARREADY=0
# 215 ns: DONE: write and read completed
```

Lines with the same time may appear in either order, and the exact hex case depends on your simulator. The handshakes are: W at 135 ns (the slave is ready for W as soon as it has seen AWVALID), AW at 145 ns (AWREADY rises one edge after the slave registered WVALID), B at 165 ns, AR at 175 ns (the slave returns to IDLE), R at 195 ns. There must be **zero** checker failures, with the service bounds still enabled.

The slave did not change. It waits for WVALID before AWREADY and for AWVALID before WREADY, which is the most restrictive legal behaviour, and the fixed master still completes. That is the test every master needs: a master that only works against an always-ready slave hides a latent violation.

Compare your completed checker with `solution.sv` only after all four steps have been recorded.

*These expected logs were worked out by hand from the code; no simulator run is recorded with the lab.*
