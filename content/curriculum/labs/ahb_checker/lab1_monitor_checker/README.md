# Lab: Building an AHB-Lite Protocol Monitor & Checker

## Scenario

You have an AHB-Lite slave controller for a simple SRAM block. A basic testbench drives read and write transactions through an AHB-Lite master BFM. However, the environment has **no protocol monitor or checker** — it drives transactions but never validates protocol compliance or data correctness.

Your job is to build a passive AHB-Lite monitor that:
1. Reconstructs complete transactions from the pipelined AHB signal interface
2. Adds protocol assertions for critical HREADY and HRESP rules
3. Detects and reports violations in a pre-broken DUT scenario

## Objective

### Part 1: Build the Monitor (30 min)

1. Review `testbench.sv` to understand the AHB interface signals, the SRAM slave, and the master BFM.
2. Open `ahb_monitor.sv` and complete the `TODO` sections:
   - **Address Phase Capture:** Buffer HADDR, HWRITE, HTRANS, HSIZE, and HBURST when HREADY is high and HTRANS is NONSEQ or SEQ.
   - **Data Phase Sampling:** When the pending transaction's data phase completes (HREADY goes high), sample HWDATA (for writes) or HRDATA (for reads), record HRESP, and broadcast the completed transaction via the analysis port.
   - **Wait-State Counting:** Increment a counter each cycle that HREADY is low during an active data phase.
3. Wire the monitor into the environment's `build_phase` and `connect_phase`.

### Part 2: Add Protocol Assertions (20 min)

4. Open `ahb_checker.sv` and implement the following SVA properties:
   - **Address stability:** HADDR must not change when HREADY is low and HTRANS is not IDLE.
   - **Control stability:** HWRITE, HSIZE, HBURST must remain stable during wait states.
   - **Two-cycle ERROR:** When HRESP=ERROR with HREADY=0, the next cycle must have HRESP=ERROR with HREADY=1.
   - **HREADY timeout:** HREADY must not remain low for more than 16 consecutive cycles.
5. Bind the checker module to the DUT instance in `testbench.sv`.

### Part 3: Triage a Failing Scenario (10 min)

6. The testbench includes a `BROKEN_MODE` parameter. Set it to `1` and re-run.
7. The broken DUT has two injected bugs:
   - Bug A: The slave samples HWDATA on every clock edge (not gated on HREADY).
   - Bug B: The slave issues a single-cycle ERROR response instead of the two-cycle protocol.
8. Your assertions should catch both violations. Document which assertion fired and at which simulation time.

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
- **Part 2:** All four assertions pass when `BROKEN_MODE=0`.
- **Part 3:** With `BROKEN_MODE=1`, at least two assertions fire, identifying both injected bugs.

## Need Help?

Review the [B-AHB-3: AHB Verification Methodology](../../../T3_Advanced/B-AHB-3_AHB_Verification/index.mdx) lesson for the complete monitor and checker architecture. You can also view `solution.sv` for the working implementation.
