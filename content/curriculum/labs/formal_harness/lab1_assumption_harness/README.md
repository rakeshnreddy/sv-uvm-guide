# Lab: Formal Assumption Harness (E-INT-1)

## Overview

This lab belongs to [E-INT-1: Integrating UVM with Formal Verification](/curriculum/T4_Expert/E-INT-1_Integrating_UVM_with_Formal_Verification/index). You inherit a formal harness for the control block of a 4-entry FIFO. Its proofs all came back green, and the FIFO still has a bug. You will find out why the proofs lie, triage a real and a spurious counterexample, replay the real one in UVM, and fix the RTL.

No formal tool or simulator runs on this site. Every step therefore states the result to expect, and you can check each formal result in the lesson's **Formal vs simulation explorer** (`FormalVsSimulationVisualizer`), which runs an exhaustive search over the same design. If you have a formal tool, run the files; your results should match the tables below.

## Learning objectives

1. **Diagnose** an over-constrained harness from its covers: a vacuous proof and an unreachable cover.
2. **Triage** a counterexample against the interface specification and **decide** whether it is a design bug or a missing assumption.
3. **Write** a UVM sequence that replays a formal counterexample, and **predict** the failure it reproduces.
4. **Fix** the RTL so that the assertion checks something real, and confirm the proofs and covers.

## Files

| File | Role | What it holds |
|------|------|---------------|
| `testbench_buggy.sv` | starter (editable) | The DUT `fifo`, the property module `fifo_props`, and the `bind` that attaches it |
| `cex_replay_seq.sv` | starter (editable) | A UVM sequence item and a replay sequence with empty arrays |
| `testbench_solution.sv` | solution | The harness and RTL after steps 2 to 5 |
| `cex_replay_seq_solution.sv` | solution | The completed replay sequence |

Solution files unlock when you complete the lab; everything a step needs is in the starter files and this guide.

## The interface specification

The FIFO's users (the **environment**) drive `push` and `pop`; the FIFO drives `count`, `full` and `empty`. The FIFO specification promises only two things about the environment:

- it never pushes while `full` is 1;
- it never pops while `empty` is 1.

Pushing and popping in the same cycle is legal. Pushing into the last free slot is legal. Any assumption beyond these two rules needs a specification clause to back it.

**Conventions.** Edges are counted from 0, the first rising clock edge after reset is released. Values are those sampled at each edge. Formal commands and report formats are tool-dependent; the results are not.

## Steps

### Step 1: Read the harness and predict

Open `testbench_buggy.sv`. Find the three parts: `fifo`, `fifo_props` and the `bind`. In `fifo_props`, list each `assume`, each `assert` and each `cover`. For each assumption, say whether the specification above supports it.

Write down your prediction for the formal run as shipped: the status of `p_count_in_range`, `p_full_is_correct`, `c_reach_depth` and `c_push_pop`.

### Step 2: Run as shipped, and read the covers first

Expected formal results:

| Property | Result |
|---|---|
| `p_count_in_range` | proven |
| `p_full_is_correct` | proven, but vacuous |
| `c_reach_depth` | **unreachable** |
| `c_push_pop` | covered at edge 1 |

Everything is green, yet `c_reach_depth`, the antecedent of `p_full_is_correct`, can never happen. Which assumption makes a full FIFO unreachable? Is it in the specification? (In the visualizer: late-flag RTL, contract, and `a_never_fill` on.)

Why is `c_push_pop` still covered? Because a cover detects an over-constraint only for the behaviour it targets. Every assumption needs a cover for something it must still allow.

### Step 3: Remove the over-constraint and triage the counterexample

Delete `a_never_fill`. Expected formal results:

| Property | Result |
|---|---|
| `p_full_is_correct` | counterexample at edge 4 |
| `p_count_in_range` | counterexample at edge 5 |
| `c_reach_depth` | covered at edge 4 |
| `c_push_pop` | covered at edge 1 |

The trace for `p_full_is_correct`:

| Edge | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| `push` | 1 | 1 | 1 | 1 | 0 |
| `pop` | 0 | 0 | 0 | 0 | 0 |
| `count` | 0 | 1 | 2 | 3 | 4 |
| `full` | 0 | 0 | 0 | 0 | 0 |

Triage it against the specification, not against the assumptions: check every input the environment drives, edge by edge. Is any of them illegal? Decide: design bug, or missing assumption?

Then explain the second counterexample: at edge 4 `full` still reads 0, so a fifth push is legal by the contract, and the counter goes to 5 at edge 5. (In the visualizer: late-flag RTL with the contract.)

### Step 4: Write the replay sequence

Open `cex_replay_seq.sv`. Fill `push_v` and `pop_v` from the trace of step 3 and complete the loop. Decide whether to assign the item's fields or call `randomize()`, and say why.

Drive edges 0 to 3: edge 4 is where the failure is sampled. Predict what a simulation reports, and when, with this sequence on a driver that applies one item per clock and idles when it has none.

Expected: `p_full_is_correct` fails 4 edges after the first replayed push, with `count` = 4 and `full` = 0, exactly as in formal. In the lesson's bench the failure is routed to UVM reporting, so the summary shows `UVM_ERROR :    1`.

### Step 5: Fix the RTL and re-prove

Fix `full` in `fifo` so that it is 1 at the very edge where `count` reaches `DEPTH`. Two fixes work functionally:

- `assign full = (count == DEPTH);` makes `p_full_is_correct` restate the RTL's own equation, so the proof checks nothing beyond it;
- a registered flag computed from the next count, `full <= (count_next == DEPTH)`, keeps the register and gives the assertion a different implementation to check.

Use the second. Expected formal results with the contract only:

| Property | Result |
|---|---|
| `p_count_in_range` | proven |
| `p_full_is_correct` | proven (not vacuous) |
| `c_reach_depth` | covered at edge 4 |
| `c_push_pop` | covered at edge 1 |

The replay test from step 4 now passes, and it stays in the regression as a guard.

### Step 6: A spurious counterexample

On the fixed RTL, comment out `a_no_push_when_full` and re-run. Expected:

| Property | Result |
|---|---|
| `p_count_in_range` | counterexample at edge 5: push at edges 0 to 4; at edge 4 `count` = 4 and `full` = 1; `count` = 5 at edge 5 |
| `p_full_is_correct` | proven |

Triage it. The push at edge 4 happens while `full` is 1, which the specification forbids, so the counterexample is spurious: the fix belongs in the harness, not the RTL. Restore the assumption. (In the visualizer: correct RTL, `a_no_push_when_full` off. Its replay binds the full interface contract, which is why it reports `a_no_push_when_full` failing at edge 4.)

Notice that replaying this trace with only the formal run's own assumptions would not have told you this: with `a_no_push_when_full` switched off, nothing in `fifo_props` checks the push at edge 4.

## Key takeaways

- A proof is only as good as its assumptions. Read the covers before the assertions; an unreachable antecedent means a vacuous proof.
- Write assumptions from the interface specification, never from what a driver or a sequence happens to do. Simulation then checks them against the real environment.
- A counterexample satisfies every assumption formal used. Decide "bug or assumption gap" by checking its inputs against the specification.
- An assertion that restates the RTL's own equation proves nothing about intent.
