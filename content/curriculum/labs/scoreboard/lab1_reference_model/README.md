# Lab: The M3 Scoreboard Gate (reference model, predictor, in-order scoreboard)

## Scenario

`alu_pipe` is a two-stage ALU. It accepts one request per clock (`valid_in`, a 4-bit `tag_in`, `op`, `a`, `b`) and presents the result two rising edges later (`valid_out`, `tag_out`, `result`), in request order, with the request's tag. The bench in `testbench.sv` already has:

- a sequence of 20 random requests, driven back to back with one idle cycle after request 10;
- an active input agent (`in_agt`: sequencer, driver, input monitor `in_mon`);
- a passive output agent (`out_agt`: output monitor `out_mon`);
- two monitors that sample through the clocking block `mon_cb` and publish a **new** `alu_item` per transaction;
- an `alu_test`, an `alu_zero_test` (no stimulus at all) and `tb_top`.

What it does not have is any checking. Run it now and **predict** the verdict first: it ends with `UVM_ERROR :    0` whatever the DUT does. That is the false pass you are about to remove.

## The specification (write the model from this, not from the RTL)

| `op` | Name | `result` (16 bits) |
|---|---|---|
| 0 | ADD | `a + b` |
| 1 | SUB | `a - b`, modulo 2**16 |
| 2 | MUL | `a * b` |
| 3 | AND | `{8'h00, a & b}` |

The result carries the request's tag. Any other `op` value (X or Z) has no defined result.

## Your task

The architecture is the one in the lesson's picture, with the FIFO form of the scoreboard: `in_mon` → `prd` (predictor) → `scb.exp_export`, and `out_mon` → `scb.act_export`; inside `scb`, each export feeds a private `uvm_tlm_analysis_fifo`, and a `run_phase` thread pairs the two streams in order.

1. **TODO 1, the reference model.** Write `alu_model()` from the table above.
2. **TODO 2, the predictor.** In `alu_predictor::write()`, clone the observed request, set the clone's `result` with `alu_model()`, and publish the clone on `ap`. Never modify the item you received: every subscriber of `in_mon.ap` holds the same handle.
3. **TODO 3, the scoreboard.** Exports, private FIFOs and connections; a scoreboard-owned `uvm_comparer` with `set_threshold(0)`; then the in-order loop: `peek()` the oldest prediction, `get()` the next actual, set the actual aside if its tag is not the prediction's tag, otherwise `try_get()` the prediction and compare by value with `compare()`, checking the bit it returns. Connect the env (TODO 3d).
4. **TODO 4, accounting and end of test.**
   - `check_phase`: `SCB/MISSING` for every prediction left, `SCB/UNEXPECTED` for every actual set aside or left in `act_fifo`, `SCB/NO_TRAFFIC` if nothing was compared.
   - `report_phase` and `pre_abort()`: exactly one line, `SCB_SUMMARY matches=<n> mismatches=<n> pending=<n>`. Never print "PASSED": the report server decides.
   - `phase_ready_to_end`: for the run phase only, once, and only while a prediction is outstanding, raise the phase's objection, wait until `exp_fifo` is empty or `max_latency` has passed, then drop it. No fixed delay anywhere. Note that `wait (exp_fifo.used() == 0)` is not legal (an event expression may call only non-virtual methods, and `used()` is virtual): loop on an event your `run_phase` triggers after each actual instead.
5. **Run the clean test, then the four mutants below.** Each mutant must fail with its own error ID before you trust a clean run.

## Run instructions

The steps are tool-neutral; switches differ between simulators.

1. Compile against uvm-core 2020.3.1 (or your simulator's built-in UVM library of that version), with a default time unit of 1 ns and precision of 1 ps.
2. Compile `testbench.sv` (or `solution.sv`) and elaborate `tb_top` as the top module. Add `+define+MUT_DROP`, `+define+MUT_SUB` or `+define+MUT_EXTRA` to build a buggy DUT.
3. Run with `+UVM_TESTNAME=alu_test` (the default) or `+UVM_TESTNAME=alu_zero_test`.

## Success criteria

The expected lines below are a hand trace of `solution.sv` (no simulator run is behind them). Times follow from a 10 ns clock with rising edges at 5, 15, 25 ns and reset released for the edge at 25 ns; operand values depend on the seed.

**Clean run** (`alu_test`, correct DUT):

```text
UVM_INFO @ 235 ns: uvm_test_top.env.scb [SCB/DRAIN] holding run_phase: 2 outstanding
UVM_INFO @ 255 ns: uvm_test_top.env.scb [SCB_SUMMARY] SCB_SUMMARY matches=20 mismatches=0 pending=0
...
UVM_ERROR :    0
UVM_FATAL :    0
```

The test drops its objection at 235 ns, when request 20 is accepted; the scoreboard holds the run phase until the last result is matched at 255 ns.

**The four mutants** (each must show its ID):

| Run | Planted bug | The log must show |
|---|---|---|
| `+define+MUT_DROP` | request 20 (tag 3) never gets a result | `SCB/DRAIN_TIMEOUT` warning at 335 ns, `SCB/MISSING` for tag 3, `SCB_SUMMARY matches=19 mismatches=0 pending=1` |
| `+define+MUT_SUB` | SUB is computed as ADD | `SCB/MISMATCH` for each SUB request with `b` not 0, with the comparer's field detail (`t.result: lhs = ... : rhs = ...`) |
| `+define+MUT_EXTRA` | the result for request 10 (tag 9) is sent twice, in the idle cycle after it | `SCB/UNEXPECTED` for tag 9 in `check_phase`, `SCB_SUMMARY matches=20 mismatches=0 pending=1` |
| `+UVM_TESTNAME=alu_zero_test` | no stimulus at all | `SCB/NO_TRAFFIC` at 0 ns, `SCB_SUMMARY matches=0 mismatches=0 pending=0` |

Questions to answer when you are done:

- Why does `MUT_DROP` drop the **last** request? (Because this scoreboard is in order: a result lost in the middle makes every later actual arrive with the wrong tag, and the log becomes a cascade. The lesson's keyed scoreboard handles a mid-stream loss without one.)
- Why can a seed pass `MUT_SUB`? (A SUB with `b = 0` gives the same result as ADD. A mutant that does not fail says the stimulus is weak, not that the DUT is right.)
- What would happen to `MUT_EXTRA` if the duplicate came after the last real result? (The scoreboard would already be idle and the run over: no end-of-test rule can see it; an interface checker can.)

## Stretch goals

- Add a per-item latency watchdog that reports `SCB/LATE` while the run continues, as the lesson's keyed scoreboard does.
- Convert the scoreboard to the keyed form (one queue per tag) and move `MUT_DROP` back to request 10: the other 19 results must still match.

## Need help?

Review [A-UVM-6: Scoreboards and Reference Models](/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index), sections "In-order matching and comparing by value" and "End-of-test accounting and draining". `solution.sv` is the complete, runnable answer.
