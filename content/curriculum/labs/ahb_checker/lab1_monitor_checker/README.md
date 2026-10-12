# Lab: Building an AHB-Lite Protocol Monitor & Checker

## Scenario

You have an AHB-Lite slave controller for a simple SRAM block. A testbench drives read and write transfers through an AHB-Lite master BFM (bus functional model). It checks read-back data and counts memory writes, but it has **no protocol monitor or checker**: nothing reconstructs transfers or checks the bus against the protocol.

Your job is to build:
1. a passive AHB-Lite monitor that reconstructs complete transfers from the pipelined signals;
2. a protocol checker whose assertions are kept separate from a testbench watchdog, with cover properties that prove the assertions actually ran;

and then to use both to find injected bugs in the slave and in the master.

This lab is **pin-level and non-UVM**: the monitor is a module that prints with `$display`, and the checker is a module of SystemVerilog Assertions (SVA). The lesson builds the UVM version of both (a `uvm_monitor` with an analysis port, a checker that reports through UVM, and a byte-lane scoreboard); Part 5 below connects the two.

Section numbers below refer to Arm IHI0033B.b (AMBA 5 AHB, AHB5 and AHB-Lite).

## The lab switches

All three switches are at the top of `testbench.sv`. Change a `0` to `1` in the editor, or pass `+define+NAME=1` to your simulator.

| Switch | Effect |
|---|---|
| `BROKEN_MODE` | the slave gets two injected bugs (Part 3) |
| `PIPELINED` | the master runs back-to-back traffic with a BUSY cycle, wait states and a cancel after ERROR (Part 4); with 0 it runs single transfers, each followed by an IDLE |
| `MASTER_BUG` | with `PIPELINED=1`, the master changes the address of a waited transfer (Part 4) |

Single-slave simplification: there is no decoder and no HSEL, and the slave's HREADYOUT drives HREADY directly. A real AHB-Lite slave also samples HSELx, and only when HREADY is high (4.2). The slave reads and writes whole 32-bit words.

## Objective

### Part 1: Build the monitor (30 min)

1. Review `testbench.sv`: the AHB interface (with the clocking block `mst_cb` the master BFM drives through), the SRAM slave, the master BFM and its traffic plans, and the write-count check.
2. Open `ahb_monitor.sv` and complete the `TODO` sections:
   - **Address phase capture:** buffer HADDR, HWRITE, HTRANS, HSIZE and HBURST at an edge where HREADY is high and HTRANS is NONSEQ or SEQ. Nothing is accepted at an edge with HREADY low.
   - **Data phase sampling:** the pending transfer completes at the next edge where HREADY is high (it may already be high at the very next edge). Sample HWDATA (for a write) or HRDATA (for a read) and HRESP at that edge, and print the completed transfer with `$display`. Then capture the next address phase at the same edge.
   - **Wait-state counting:** count each edge with HREADY low while a transfer is pending.
3. Uncomment the monitor instance in `tb_top` (the first TODO there).

### Part 2: Add protocol assertions (30 min)

4. Open `ahb_checker.sv` and implement the properties. Each one is either a **protocol rule** (a failure means a master or slave broke the specification) or an **environment watchdog** (a budget this testbench chose).

   Protocol rules:
   - **Address hold during wait states (3.6.2, 3.5.2):** a waited NONSEQ or SEQ keeps HADDR until HREADY is high.
   - **Control hold during wait states (3.6.1, 3.5.2):** the same transfer also keeps HTRANS, HWRITE, HSIZE and HBURST.
   - **Waited BUSY (3.6.1):** a waited BUSY may stay BUSY or become SEQ at the same address. In an undefined-length INCR it may also end the burst with IDLE or NONSEQ.
   - **Two-cycle ERROR, forward (5.1.3, Table 5-2):** when HRESP=ERROR with HREADY=0, the next cycle must have HRESP=ERROR with HREADY=1.
   - **Two-cycle ERROR, backward (5.1.3, Table 5-2):** whenever HRESP=ERROR with HREADY=1, the previous cycle must have been HRESP=ERROR with HREADY=0. Only this direction catches a slave that gives ERROR for a single cycle.
   - **OKAY during wait states (5.1.2, 5.1.3, Table 5-2):** HREADY low with HRESP high is the first ERROR cycle and nothing else, so the next cycle must end the transfer. Every earlier wait state drives OKAY.

   The hold checks must not fire on the legal changes the specification lists for waited transfers. A waited IDLE may change its address and become NONSEQ (3.6.1, 3.6.2), so start the hold checks on NONSEQ or SEQ only. A master that cancels a burst after an ERROR drives IDLE during the two-cycle ERROR response (3.5.2) and may change the address while HREADY is low (3.6.2), so allow IDLE at the edge after a first ERROR cycle.

   Environment watchdog (not a protocol rule):
   - **HREADY timeout:** HREADY must not stay low for more than `MAX_WAIT` (16) consecutive cycles. The specification only *recommends* that slaves insert at most 16 wait states and names exceptions, such as a serial boot ROM (note in 5.1.2). Report a breach with `$warning` and label it as this testbench's budget.

   Coverage:
   - **Antecedent covers (TODO 8):** a property whose antecedent never happens passes vacuously and has checked nothing. Write cover properties for a waited NONSEQ/SEQ, a waited BUSY, and a master cancelling after an ERROR (NONSEQ or SEQ on the bus in the first ERROR cycle, IDLE in the second).
5. Uncomment the bind directive in `tb_top` (the second TODO there). Run with all switches at 0 and check the success criteria for Parts 1 and 2.

### Part 3: Triage a failing scenario (15 min)

6. Set `BROKEN_MODE` to 1 and rerun.
7. The broken slave has two injected bugs:
   - Bug A: the slave writes memory on every clock edge of a write data phase, including wait states, because the write enable is not gated on HREADY.
   - Bug B: the slave issues a one-cycle ERROR response (HRESP high while HREADY stays high) instead of the two-cycle response.
8. Find each bug and write down which check fired and at which simulation time:
   - **Bug B** is a pin-level protocol violation. The backward two-cycle ERROR property fires at the edge where the one-cycle ERROR completes. The forward property stays silent, because its antecedent needs HREADY low and a one-cycle ERROR never has it.
   - **Bug A** is invisible to every pin-level assertion. The read-back also passes: a master holds HWDATA valid through wait states (6.1.1), so the extra write stores the same value again. The bug shows up as extra memory writes. The testbench's write-count check (a small white-box scoreboard in `tb_top`) compares the slave's memory writes with the write transfers that completed with OKAY, and reports a mismatch at the end of the run. On a slave with write side effects, such as a FIFO or a write-1-to-clear register, the same bug corrupts state.

### Part 4: Pipelined traffic and a master bug (20 min)

With `PIPELINED=0`, the master puts an IDLE on the address bus during every data phase, so no address phase ever waits behind a data phase: the hold and BUSY properties never start an attempt, and your covers for them stay at zero. That is the point of the covers: a green run with zero covers has checked nothing.

9. Set `BROKEN_MODE` back to 0 and `PIPELINED` to 1, and rerun. The plan is now: a write; an INCR4 write with a BUSY cycle between its third and fourth beats; an INCR4 read; a write to an unmapped address (ERROR); and a read that is waiting on the address bus during the ERROR, which the master cancels and re-issues. Check that every cover is hit and nothing fails, and follow the cancel in the waveform.
10. Set `MASTER_BUG` to 1 as well and rerun. The master now moves the address of a NONSEQ or SEQ that is waiting on the bus. Which assertion fires, at which time, and what does the read check report one edge later?
11. Optionally, combine `PIPELINED=1` with `BROKEN_MODE=1` and compare the result with Part 3.

### Part 5 (optional): connect to the lesson's UVM environment

12. Port your monitor's logic into the lesson's `ahb_mon` (`run_phase` on a clocking block, publishing an item on an analysis port) and feed the lesson's byte-lane scoreboard from it. Replace the checker's `$error` calls with `uvm_error`, and show that the one-cycle ERROR of Bug B now appears in the UVM report summary.

## Key Concepts

- **Pipeline buffering:** the monitor buffers each accepted address phase and pairs it with the data phase that completes at a later edge with HREADY high.
- **HREADY gating:** accept new address phases and take data only at edges where HREADY is high.
- **Protocol versus policy:** a protocol property names a rule a master or slave broke; a watchdog names a budget this testbench chose.
- **Vacuity:** an assertion that never started has checked nothing; cover its antecedent.
- **Pin-level checks have limits:** a slave that acts twice on the same data breaks no pin rule; a white-box count or a scoreboard finds it.

## Run Instructions

The in-browser run compiles the three editable files (`testbench.sv`, `ahb_monitor.sv`, `ahb_checker.sv`); change the switches at the top of `testbench.sv`. With a local simulator:

```bash
# Generic simulator command (tool-neutral)
<simulator_run_cmd> testbench.sv ahb_monitor.sv ahb_checker.sv

# A switch on the command line instead of in the file:
<simulator_run_cmd> +define+BROKEN_MODE=1 testbench.sv ahb_monitor.sv ahb_checker.sv
<simulator_run_cmd> +define+PIPELINED=1 +define+MASTER_BUG=1 testbench.sv ahb_monitor.sv ahb_checker.sv

# The reference solution (it includes the other files and binds the solution modules):
<simulator_run_cmd> solution.sv
```

The checker needs concurrent SVA (`$past`, `$stable`, `$fell`, `##[1:MAX_WAIT]`, `disable iff`, `cover property`) and `bind`. How much of that a given simulator supports, and in particular the open-source simulators the platform offers, is tool-dependent. This lab was **not run on a simulator in this program**: the results below were derived by tracing `testbench.sv` and `solution.sv` edge by edge (rising edges at 5, 15, 25, ... ns; reset released after the edge at 35 ns).

## Success Criteria

Expected results with the solution, by trace:

| Switches | Assertions | Covers | Write-count check | Read checks |
|---|---|---|---|---|
| all 0 | none fail; the watchdog stays quiet | waited NONSEQ/SEQ: 0; waited BUSY: 0; cancel: 0 | `[SCB] PASS: 8 memory writes for 8 write transfers that completed OKAY` | 9 PASS |
| `BROKEN_MODE=1` | the backward two-cycle ERROR property fails once, at 425 ns (Bug B) | as above | 10 memory writes for 8 OKAY write transfers (Bug A: two of the writes had a wait state) | 9 PASS |
| `PIPELINED=1` | none fail | all three hit | `PASS: 5 memory writes for 5 ...` | 5 PASS |
| `PIPELINED=1`, `BROKEN_MODE=1` | the backward two-cycle ERROR property fails once, at 185 ns | waited NONSEQ/SEQ and waited BUSY hit; cancel not hit (the slave never gives a first ERROR cycle, so the master never cancels) | 6 memory writes for 5 OKAY write transfers | 5 PASS |
| `PIPELINED=1`, `MASTER_BUG=1` | the address-hold property fails once, at 165 ns: the waiting SEQ to 0x1C moves to 0x11C | all three hit | `PASS: 5 ...` | the read of 0x1C fails at 175 ns (the slave read the unwritten address 0x11C) |

- **Part 1:** the monitor prints one line per completed transfer with the right address, data, wait-state count and response. In the pipelined plan it prints nothing for the BUSY cycle and nothing for the cancelled read; the re-issued read appears once.
- **Part 2:** with all switches at 0, nothing fails, but the hold and BUSY covers stay at 0: those properties passed vacuously.
- **Part 3:** both bugs found, each with the check that names it.
- **Part 4:** every cover hit with `PIPELINED=1`, and the master bug named by the address-hold property, not by the read check that fails later.

## Need Help?

Review the [B-AHB-3: AHB Verification Methodology](/curriculum/T3_Advanced/B-AHB-3_AHB_Verification/index) lesson for the complete monitor and checker architecture. You can also view `solution.sv` for the working implementation.
