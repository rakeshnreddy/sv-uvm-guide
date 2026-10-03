# Lab: Building an AHB-Lite Protocol Monitor & Checker

## Scenario

You have an AHB-Lite slave controller for a simple SRAM block. A basic testbench drives read and write transactions through an AHB-Lite master BFM. The testbench checks read-back data and counts memory writes, but it has **no protocol monitor or checker**: nothing reconstructs transactions or checks the bus against the protocol.

Your job is to build a passive AHB-Lite monitor that:
1. Reconstructs complete transactions from the pipelined AHB signal interface
2. Adds protocol assertions for the wait-state and HRESP rules, kept separate from an environment watchdog
3. Detects and reports violations in a pre-broken DUT scenario

Section numbers below refer to Arm IHI0033B.b (AMBA 5 AHB, AHB5 and AHB-Lite).

## Objective

### Part 1: Build the Monitor (30 min)

1. Review `testbench.sv` to understand the AHB interface signals, the SRAM slave, and the master BFM.
2. Open `ahb_monitor.sv` and complete the `TODO` sections:
   - **Address Phase Capture:** Buffer HADDR, HWRITE, HTRANS, HSIZE, and HBURST when HREADY is high and HTRANS is NONSEQ or SEQ.
   - **Data Phase Sampling:** When the pending transaction's data phase completes (HREADY goes high), sample HWDATA (for writes) or HRDATA (for reads), record HRESP, and print the completed transaction with `$display`.
   - **Wait-State Counting:** Increment a counter each cycle that HREADY is low during an active data phase.
3. Instantiate the monitor in `tb_top` (see the TODO there).

### Part 2: Add Protocol Assertions (30 min)

4. Open `ahb_checker.sv` and implement the properties. Each one is either a **protocol rule** (a failure means a master or slave broke the spec) or an **environment watchdog** (a budget this testbench chose).

   Protocol rules:
   - **Address hold during wait states (§3.6.2, §3.5.2):** a waited NONSEQ or SEQ keeps HADDR until HREADY is high.
   - **Control hold during wait states (§3.6.1, §3.5.2):** the same transfer also keeps HTRANS, HWRITE, HSIZE, and HBURST.
   - **Waited BUSY (§3.6.1):** a waited BUSY may stay BUSY or become SEQ at the same address. In an undefined-length INCR it may also end the burst with IDLE or NONSEQ.
   - **Two-cycle ERROR, forward (§5.1.3, Table 5-2):** when HRESP=ERROR with HREADY=0, the next cycle must have HRESP=ERROR with HREADY=1.
   - **Two-cycle ERROR, backward (§5.1.3, Table 5-2):** whenever HRESP=ERROR with HREADY=1, the previous cycle must have been HRESP=ERROR with HREADY=0. Only this direction catches a slave that gives ERROR for a single cycle.
   - **OKAY during wait states (§5.1.2, §5.1.3, Table 5-2):** HREADY low with HRESP high is the first ERROR cycle and nothing else, so the next cycle must end the transfer. Every earlier wait state drives OKAY.

   The hold checks must not fire on the legal changes the spec lists for waited transfers. A waited IDLE may change its address and become NONSEQ (§3.6.1, §3.6.2), so start the hold checks on NONSEQ or SEQ only. A master that cancels a burst after an ERROR drives IDLE during the two-cycle ERROR response (§3.5.2) and may change the address while HREADY is low (§3.6.2), so allow IDLE at the edge after a first ERROR cycle.

   Environment watchdog (not a protocol rule):
   - **HREADY timeout:** HREADY must not stay low for more than `MAX_WAIT` (16) consecutive cycles. The spec only *recommends* that slaves insert at most 16 wait states and names exceptions, such as a serial boot ROM (note in §5.1.2). Report a breach with `$warning` and label it as this testbench's budget.
5. Bind the checker module to the DUT instance in `testbench.sv`.

### Part 3: Triage a Failing Scenario (15 min)

6. The testbench includes a `BROKEN_MODE` parameter. Set it to `1` and re-run.
7. The broken DUT has two injected bugs:
   - Bug A: the slave writes memory on every clock edge of a write data phase, including wait states, because the write enable is not gated on HREADY.
   - Bug B: the slave issues a one-cycle ERROR response (HRESP high while HREADY stays high) instead of the two-cycle response.
8. Find each bug and document which check fired and at which simulation time:
   - **Bug B** is a pin-level protocol violation. The backward two-cycle ERROR property fires at the edge where the one-cycle ERROR completes. The forward property stays silent, because its antecedent needs HREADY low and a one-cycle ERROR never has it.
   - **Bug A** is invisible to every pin-level assertion. The read-back also passes: a master holds HWDATA valid through wait states (§6.1.1), so the extra write stores the same value again. The bug shows up as extra memory writes. The testbench's write-count check (a small white-box scoreboard in `tb_top`) compares the slave's memory writes with the write transfers that completed with OKAY, and reports a mismatch at the end of the run. On a slave with write side effects, such as a FIFO or a write-1-to-clear register, the same bug corrupts state.

### What this testbench does not exercise

The master BFM drives IDLE during every data phase and issues only SINGLE transfers. The hold and BUSY properties therefore never start an attempt here: they pass vacuously. To see them work, use the AHB pipeline visual in the B-AHB-1 lesson (the "BUSY in a burst" and "Two-cycle ERROR" scenarios), or extend the BFM with bursts, BUSY cycles, and a master that cancels after an ERROR.

## Key Concepts

- **Pipeline Buffering:** The monitor must buffer the address phase and pair it with the data phase that arrives one or more clock cycles later.
- **HREADY Gating:** Only sample data and only capture new addresses when HREADY is high.
- **Assertion-Based Verification:** SVA properties catch protocol violations in real time, complementing the transaction-level scoreboard.

## Run Instructions

```bash
# Generic simulator command
<simulator_run_cmd> testbench.sv ahb_monitor.sv ahb_checker.sv

# To run with broken DUT:
<simulator_run_cmd> +define+BROKEN_MODE=1 testbench.sv ahb_monitor.sv ahb_checker.sv
```

## Success Criteria

- **Part 1:** The monitor log shows reconstructed transactions with correct addresses, data, and wait-state counts for all test transfers.
- **Part 2:** With `BROKEN_MODE=0`, no protocol assertion fails, the watchdog stays quiet, and the write-count check prints `[SCB] PASS`.
- **Part 3:** With `BROKEN_MODE=1`, the backward two-cycle ERROR property fails once (Bug B), and the write-count check reports 10 memory writes for 8 write transfers that completed with OKAY (Bug A: two of the writes had a wait state).

## Need Help?

Review the [B-AHB-3: AHB Verification Methodology](../../../T3_Advanced/B-AHB-3_AHB_Verification/index.mdx) lesson for the complete monitor and checker architecture. You can also view `solution.sv` for the working implementation.
