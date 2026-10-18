# Lab: Retention Bug and Isolation Sequencing

Companion lab for **E-PWR-1: Power-Aware UVM Verification Strategy** ([the lesson](/curriculum/T4_Expert/E-PWR-1_Power_Aware_Verification/index)). It drills the power-down and wake-up orders, the sequencing assertions and the bugs they catch, in plain SystemVerilog, so that you can focus on the order before you put it into a UVM virtual sequence.

## Objectives

When you finish, you can:
1. Predict what the always-on side sees when a wake-up step is out of order (the clamp, X, the reset value or the retained value).
2. Diagnose a broken wake-up from assertion failures and data checks, and fix the order.
3. Write the assertion that catches a release of isolation before power, reset and restore.

Before you start, read the E-PWR-1 sections "The design and its power intent", "What the testbench sees during a power cycle" and "Power-aware assertions". The lab uses the same design, signal names and assertions.

## Background

PD_CPU is a switchable power domain with two 8-bit registers: CTX (`ctx_reg`), which is retained, and SCRATCH (`scratch`), which is not. PD_TOP, the always-on side (played by the testbench), reads and writes them over a one-cycle request bus and gets a response one cycle later. A power management unit (PMU, also played by the testbench) drives six controls: `cpu_clk_en`, `cpu_iso_en` (1 = clamp PD_CPU's outputs to 0), `cpu_save`, `cpu_restore`, `cpu_pwr_en` (with the switch's acknowledge `cpu_pwr_ack`) and `cpu_rst_n` (PD_CPU's asynchronous reset).

The safe orders, one PMU action per clock edge:
- **Power-down:** CLK_OFF, ISO_ON, SAVE, PWR_OFF (wait for the acknowledge).
- **Wake-up:** PWR_ON (wait for the acknowledge), RST, RESTORE, CLK_ON, ISO_OFF.

Power returning restores nothing: until the domain reset, every register in PD_CPU is X, and only the restore brings CTX's saved value back. The reset must come before the restore, or it wipes the restored value. Isolation is released last.

## What is in the files

Each file is self-contained and compiles on its own: the PD_CPU model, the checker and the testbench.

| Module | What it does |
|---|---|
| `cpu_pd_model` | A behavioural model of "PD_CPU's RTL plus its UPF in a power-aware simulator": corruption to X while the switch is off, isolation clamps, a retention element for CTX, and a power switch that acknowledges 3 cycles after its control changes. It makes the bugs visible in any 4-state simulator, with no power-aware tools. |
| `pwr_seq_checker` | The lesson's sequencing assertions on the always-on clock, reporting with `$error` and counting failures per assertion. In `buggy_tb.sv` one of them is a TODO. |
| `tb_top` | Plays PD_TOP and the PMU through a clocking block: writes CTX = 0xA5 and SCRATCH = 0x3C, reads them back, powers PD_CPU down for 10 cycles, wakes it up, checks CTX = 0xA5 (retained) and SCRATCH = 0x00 (reset value), writes and reads SCRATCH again, and prints `PASS=<n> FAIL=<n>`. |

- `buggy_tb.sv`: the starter. Its `[WAKE]` block is wrong; Steps 1 to 4 find out how.
- `solution_tb.sv`: the reference solution.

## How to run

Compile the single file with any SystemVerilog simulator that supports concurrent assertions, with `tb_top` as the top module, and run it. No UVM library and no power-aware option are needed. The `$error` lines carry each simulator's own prefix (and often a file and line), and when several assertions fail at the same time their order is tool-dependent (a testbench message at the same time prints before them, because assertion action blocks run later in the time slot); the `[time ns]` and the text after it are what to compare.

## Steps

### Step 1: Run the starter and read the failures

Before you run `buggy_tb.sv`, predict: with the wake-up order ISO_OFF, PWR_ON, RESTORE, CLK_ON, which assertions fail, from which time, and which read returns the wrong value? Then run it unchanged.

Expected output (a hand trace, not a simulator log; abridged):

```text
[115 ns] READ CTX = 0xa5 ok
[145 ns] READ SCRATCH = 0x3c ok
[155 ns] PMU CLK_OFF
[165 ns] PMU ISO_ON
[175 ns] PMU SAVE
[195 ns] PMU PWR_OFF
[345 ns] PMU ISO_OFF
[355 ns] PMU PWR_ON
Error: [355 ns] a_iso_unless_on: isolation off while not fully powered
Error: [355 ns] a_no_x_into_top: X reached PD_TOP from PD_CPU
  ... a_iso_unless_on again at 365, 375, 385; a_no_x_into_top at every edge to 435 ...
[405 ns] PMU RESTORE
[425 ns] PMU CLK_ON
[455 ns] READ CTX = 0xa5 ok
Error: [485 ns] READ SCRATCH: expected 0x00 observed 0xxx
Error: [485 ns] a_no_x_into_top: X reached PD_TOP from PD_CPU
[545 ns] READ SCRATCH = 0x5a ok
--- summary ---
  a_iso_unless_on failed 4 time(s)
  a_no_x_into_top failed 10 time(s)
PASS=4 FAIL=15
```

Explain the failures before you open the answer: why does X reach PD_TOP from 355 ns, why does CTX still read 0xA5, and why does SCRATCH read X?

<details>
<summary>Check your explanation</summary>

Releasing the clamp at 345 ns, while VDD_CPU is still off, hands PD_TOP the X of an unpowered domain until the clock restarts at 425 ns and PD_CPU drives a known `rsp_valid` again. CTX still reads 0xA5, because the restore loaded it from the retention element; SCRATCH reads X, because nothing ever reset it.

</details>

### Step 2: Reorder the wake-up

Move `ISO_OFF` to the end of the `[WAKE]` block: PWR_ON, RESTORE, CLK_ON, ISO_OFF. A common first fix. Predict, then run.

Expected (hand trace, abridged): the X leak during the wake-up is gone, but SCRATCH still reads X.

```text
[425 ns] PMU ISO_OFF
[455 ns] READ CTX = 0xa5 ok
Error: [485 ns] READ SCRATCH: expected 0x00 observed 0xxx
Error: [485 ns] a_no_x_into_top: X reached PD_TOP from PD_CPU
...
PASS=4 FAIL=2
```

The bug is now found only when traffic happens to read SCRATCH, 60 ns after the real mistake. Which step is missing?

### Step 3: Write the assertion that catches it at the release

Replace the TODO in `pwr_seq_checker` with `a_release_after_wake`: when `cpu_iso_en` falls, PD_CPU must be powered, clocked and out of reset, and the checker's `reset_seen` and `restored` flags must both be 1. Read how the flags are set first: the always-on reset sets both (the power-on reset counts, and there is nothing to restore yet); a power loss clears both and sets `ever_off`; a reset sets `reset_seen` and, once `ever_off` is 1, clears `restored`; a restore sets `restored`.

Run the Step 2 order again. Expected: a new first error, at the release, before any traffic:

```text
Error: [435 ns] a_release_after_wake: released before power, reset, restore
...
PASS=4 FAIL=3
```

Your assertion should match the one in E-PWR-1's `pwr_seq_checker`; compare after you have written it.

### Step 4: Add the domain reset

Make the wake-up PWR_ON, RST, RESTORE, CLK_ON, ISO_OFF. Expected (hand trace):

```text
[345 ns] PMU PWR_ON
[395 ns] PMU RST
[425 ns] PMU RESTORE
[445 ns] PMU CLK_ON
[455 ns] PMU ISO_OFF
[485 ns] READ CTX = 0xa5 ok
[515 ns] READ SCRATCH = 0x00 ok
[575 ns] READ SCRATCH = 0x5a ok
--- summary ---
PASS=5 FAIL=0
```

PWR_ON prints at 345 ns but ends at 385 ns, when the testbench samples the switch's acknowledge; RST holds the reset for two cycles. Compare your file with `solution_tb.sv`.

### Step 5: Break it and predict

Starting from your working file, predict each result before you run it:
1. **Restore before reset** (PWR_ON, RESTORE, RST, CLK_ON, ISO_OFF). Expected: `a_release_after_wake` fails at 465 ns, and `READ CTX: expected 0xa5 observed 0x00` at 485 ns: the reset wiped the restored value, so CTX comes back with its reset value, not X. `PASS=4 FAIL=2`.
2. **Power off before isolation** (CLK_OFF, SAVE, PWR_OFF, ISO_ON on the sleep path). Which assertion fails first, and at which edge? Why does CTX still come back as 0xA5?
3. **Save after power-off** (CLK_OFF, ISO_ON, PWR_OFF, SAVE). Which assertion names the mistake, and what does CTX read after the wake-up?

<details>
<summary>Check your predictions for 2 and 3</summary>

Both sleep paths still take the same number of cycles, so the wake-up runs at the same times as in Step 4 (hand traces, abridged).

**2. Power off before isolation.** `cpu_pwr_en` falls at the 195 ns edge with isolation still off, so `a_iso_before_off` and `a_iso_unless_on` both fail at 195 ns (in either order). `a_iso_unless_on` fails again at every edge until isolation is on, 205 to 235 ns. The switch acknowledges power-off at 215 ns, so PD_TOP sees X at 225 and 235 ns (`a_no_x_into_top`), until ISO_ON at 235 ns clamps the outputs. CTX still comes back as 0xA5, because SAVE ran at 165 ns while PD_CPU was powered; the wake-up is correct, so every read passes.

```text
Error: [195 ns] a_iso_before_off: power switched off without isolation
Error: [195 ns] a_iso_unless_on: isolation off while not fully powered
  ... a_iso_unless_on again at 205, 215, 225, 235; a_no_x_into_top at 225 and 235 ...
--- summary ---
  a_iso_before_off failed 1 time(s)
  a_iso_unless_on failed 5 time(s)
  a_no_x_into_top failed 2 time(s)
PASS=5 FAIL=8
```

**3. Save after power-off.** Isolation goes on first, so no X reaches PD_TOP during the sleep. The switch acknowledges power-off at 205 ns, and SAVE then copies the corrupted CTX: `a_save_while_on` fails at 235 ns, the edge where `cpu_save` is sampled 1 with PD_CPU unpowered. The wake-up restores that X into CTX, so the read of CTX returns X at 485 ns, which both the data check and `a_no_x_into_top` report. SCRATCH, reset normally, reads 0x00 and then 0x5A.

```text
Error: [235 ns] a_save_while_on: save while PD_CPU is not powered
Error: [485 ns] READ CTX: expected 0xa5 observed 0xxx
Error: [485 ns] a_no_x_into_top: X reached PD_TOP from PD_CPU
--- summary ---
  a_no_x_into_top failed 1 time(s)
  a_save_while_on failed 1 time(s)
PASS=4 FAIL=3
```

</details>

### Step 6 (optional): Move the order into UVM

Write the fixed sleep and wake-up orders as the body of `power_cycle_vseq` from E-PWR-1 Make It Work, as two `run_pmu({...})` calls, with `HOLD` as the last action of the power-down call, as in `power_cycle_vseq`, and explain why quiescing the bus first is free when the bus sequences run in series.

## Bonus

Add a cover property that proves the full wake-up order happened at least once, and explain why a coverpoint with transition bins on the PMU actions (the lesson's `cp_up`) says more than a cover property on `cpu_iso_en` alone.
