# Lab: Mini UVM FIFO Environment Capstone

## Scenario

You are handed a small packet FIFO DUT and asked to build its first complete UVM environment. The lab is small enough to finish in one sitting, and it has every part a block-level environment needs: a sequence item, sequences, a sequencer, a driver, a monitor, an active agent, an analysis-FIFO scoreboard with end-of-test accounting, a coverage subscriber, an environment, and a test that swaps the stimulus through a factory override.

The DUT has an optional injected bug. When `INJECT_FIFO_BUG` is defined, popping `8'hA5` while another word is queued returns the next word instead of the front one. A complete environment catches this from the log alone, without a waveform.

This lab is the hands-on part of the lesson "Your First Complete UVM Testbench" (`/curriculum/T2_Intermediate/I-UVM-3C_First_Complete_Testbench/index`). That lesson builds the same architecture for a different DUT, file by file, and teaches the four bring-up failures you are likely to meet here. Do it first.

## Objectives

1. Complete the sequences and the active FIFO agent: `fifo_base_seq` and `fifo_capstone_seq`, `fifo_driver`, `fifo_monitor` and `fifo_agent`. The transaction (`fifo_txn`), the sequencer type and the interface are already complete.
2. Feed the monitor's stream, promoted to the agent's `ap`, into the scoreboard's `observed_export` and the coverage subscriber, then write the reference-queue checks, the `check_phase` accounting and the `SCB_SUMMARY` line.
3. Use a factory override so that the test creates `fifo_base_seq` but runs `fifo_capstone_seq`, and end the test with an objection and a drain time, not a fixed delay.
4. Prove the scoreboard catches the injected FIFO ordering bug, and that the fixed DUT gives a clean run with full coverage.

## Files

- `testbench.sv`: the starter, with TODOs. This is the file you edit and run.
- `lab.json`: the lab metadata and steps.
- The reference solution is unlocked separately on the lab page. Compare with it only after your own run gives the expected signatures.

## Before you start: the monitor's clocking block

The interface is complete, and its `monitor_cb` comments matter. Sample everything that decides whether a push or pop is accepted (`push`, `pop`, `din`, `full`, `empty`, `level`) with the default `#1step` skew: those are the values the DUT's flip-flops used at the edge. Sample `dout` with `#0`: the DUT registers it at the same edge as the pop, and `#0` samples after that edge's nonblocking updates (IEEE 1800-2023 §14.4, §14.13). An earlier version of this lab sampled everything with `#0`, so the monitor read `full` and `empty` *after* each push or pop and misclassified the transfers that filled or emptied the FIFO.

| Signal in `monitor_cb` | Skew | Why |
|---|---|---|
| `push`, `pop`, `din` | `#1step` | The request the DUT's flip-flops capture at this edge. |
| `full`, `empty`, `level` | `#1step` | They decide whether this edge's push or pop is accepted, so the monitor needs their value *before* the edge. With `#0` it sees the state after the transfer. |
| `dout` | `#0` | The DUT registers the popped word at the same edge as the pop. With `#1step` the monitor would see the previous word. |

Picture it for one pop, at an edge where the FIFO holds a single word, `A5`, and the last word popped before it was `3C`:

| At the pop edge | `#1step` sees (before the edge) | `#0` sees (after the edge's nonblocking updates) | The monitor uses |
|---|---|---|---|
| `pop` | 1 | 1 | either: the driver's next drive lands later, in the Re-NBA region |
| `empty` | 0: the pop is accepted | 1: the pop looks refused | `#1step` |
| `level` | 1 | 0 | `#1step` |
| `dout` | `3C`, the previous word | `A5`, the word this pop returns | `#0` |

The same rule is taught, with a FIFO `full` flag as the example, in the expert item on monitor sampling skew in the lesson "Component Roles and the Testbench Hierarchy" (`/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index`). The lesson "Your First Complete UVM Testbench" uses `#1step` for every input because its memory's read data arrives one edge later.

## Run instructions

Simulator switches vary by vendor. You need:

1. uvm-core 2020.3.1 (IEEE 1800.2-2020): your simulator's built-in UVM library, or `src/uvm_pkg.sv` with `src` on the include path (plus `src/dpi/uvm_dpi.cc`, or define `UVM_NO_DPI`).
2. A default time unit and precision of 1 ns / 1 ps for files that declare none, such as `uvm_pkg`. The lab file declares `timeunit 1ns; timeprecision 1ps;`, and IEEE 1800-2023 §3.14.2.3 makes it an error for some design elements to have a time unit and others not. It also makes the test's `10ns` drain time and `100us` timeout mean what they say.

```bash
# Bug-exposure run: must report exactly one scoreboard mismatch.
<simulator_uvm_command> +define+INJECT_FIFO_BUG testbench.sv

# Clean run: must report zero mismatches and coverage closure.
<simulator_uvm_command> testbench.sv
```

The top module is `tb_top`; the test is `fifo_capstone_test` (it is also the `run_test()` default, so `+UVM_TESTNAME=fifo_capstone_test` is optional).

## Expected log signatures

These come from a hand trace of the reference solution against IEEE 1800-2023 clocking semantics, not from a simulator run; confirm them on yours. File, line and time fields vary by tool.

Clean run (no define):

```text
UVM_INFO ... [TEST] Created sequence type: fifo_capstone_seq
UVM_INFO ... [COV_SUMMARY] FIFO capstone coverage = 100.00%
UVM_INFO ... [SCB_SUMMARY] SCB_SUMMARY matches=7 mismatches=0 pending=0
UVM_ERROR :    0
UVM_FATAL :    0
```

Bug run (`+define+INJECT_FIFO_BUG`):

```text
UVM_ERROR ... [SCB_MISMATCH] expected 0xa5 observed 0x5a txn=op=FIFO_READ ...
UVM_INFO ... [SCB_SUMMARY] SCB_SUMMARY matches=6 mismatches=1 pending=0
UVM_ERROR :    1
UVM_FATAL :    0
```

Exactly one mismatch: the pop of `A5` returns `5A`, the bug advances the read pointer by one only, so the next pop returns `5A` again, which is what the model expects. No `MISSED_BUG` error appears.

With the sequence in this lab, the 14 operations are executed at 65 ns, 85 ns, and so on every 20 ns until 325 ns (each operation takes one edge to drive and one edge to execute), and the 10 ns drain ends the run at 335 ns.

## Acceptance criteria

- The agent is active and contains a sequencer, driver and monitor; the monitor's port is promoted to the agent's `ap`, and the env connects only to `agent.ap` and `scoreboard.observed_export`.
- The driver consumes items through `seq_item_port`, drives only through `driver_cb`, and calls `item_done()` once per item.
- The monitor samples only through `monitor_cb` and publishes a new `fifo_txn` per requested operation.
- The scoreboard checks through its analysis FIFO, reports `SCB_PENDING` for leftovers and `SCB_NO_TRAFFIC` for a run that checked nothing, and prints one `SCB_SUMMARY` line. It never needs to know how many operations the sequence sends.
- The test creates `fifo_base_seq` through the factory and the log shows `fifo_capstone_seq`.
- Both runs give the signatures above.

## Debug prompts

Try each one before you open the answer.

1. If the scoreboard reports zero matches and zero mismatches, which connection is most likely missing?

   <details><summary>Answer</summary>

   `agent.ap.connect(scoreboard.observed_export)` in the env, or `monitor.ap.connect(ap)` in the agent. An analysis port may legally have no connection, so nothing reports it at build time; your `SCB_NO_TRAFFIC` check is what turns it into a failure. If coverage still reaches 100%, the monitor ran and only the scoreboard's path is broken.

   </details>

2. Why should the monitor publish observed transactions instead of the driver publishing intended ones?

   <details><summary>Answer</summary>

   The driver knows what it asked for, not what the DUT did. A push into a full FIFO is requested but not accepted; only the pins show that. A checker fed by the driver would expect data the DUT rightly dropped.

   </details>

3. What changes if the agent is configured as `UVM_PASSIVE`?

   <details><summary>Answer</summary>

   The agent builds only the monitor: no sequencer, no driver, so `get_is_active()` guards both the build and the connect. In this lab nothing would drive the FIFO and the test's `start()` would have no sequencer to run on. A passive agent is for a bus that something else drives; the lesson's second bench shows one.

   </details>

4. Where does the factory override prove it worked: the build log, the sequence type, or the scoreboard result?

   <details><summary>Answer</summary>

   The sequence type: the test prints `seq.get_type_name()`, which must read `fifo_capstone_seq`. The scoreboard result only proves that whatever ran was checked; `fifo_base_seq` would also pass, with one match.

   </details>

5. Which coverage bin tells you the environment exercised a read from a full FIFO?

   <details><summary>Answer</summary>

   The `op_x_depth` cross bin of `op_cp.read` with `depth_cp.full`. It can only be hit if `depth_before` is the pre-edge `level`, which is why `level` is sampled with `#1step`.

   </details>

6. Your run ends with `PH_TIMEOUT` and no `SCB_SUMMARY`. What do you look for first?

   <details><summary>Answer</summary>

   A sequence that never finishes, so the objection is never dropped. The classic cause is a driver loop without `item_done()`: the log then also shows `Get_next_item called twice without item_done or get in between` from the sequencer on every loop. A fatal skips `check_phase` and `report_phase`, which is why the summary line is missing.

   </details>

## Stretch: reuse the agent passively

The milestone this lab feeds asks for one agent class reused active in one environment and passive in another. Following the lesson's second bench, write a small RTL block that pushes four words and pops them, a second top module, and a test that sets `is_active` to `UVM_PASSIVE` for `env.agent` and prints the topology at the end of elaboration. Check that the topology has no `sequencer` or `driver`, and that the scoreboard reports `matches=4`.

## References

- IEEE 1800.2-2020: §13.4 `uvm_agent` (§13.4.2.2 `get_is_active`), §13.5 monitor, §13.6 scoreboard, §13.7 driver, §13.9 subscriber; §12.2.8.3 `uvm_tlm_analysis_fifo` (§12.2.8.2.3 `used`, §12.2.8.2.4 `is_empty`); §10.5.1 objections (§10.5.1.3.7 `set_drain_time`); §8.2.4.2.5 `set_type_override`; Annex C.4.2 `uvm_config_db`; Annex F.7.3.3 `set_timeout`.
- IEEE 1800-2023: §3.14.2.3 time-unit precedence; §14.4 input and output skews, §14.13 input sampling, §14.16 synchronous drives; §19.5 coverpoints (default bins do not count toward coverage), §19.11 coverage computation.
