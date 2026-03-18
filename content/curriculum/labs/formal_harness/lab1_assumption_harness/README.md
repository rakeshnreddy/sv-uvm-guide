# Lab: Formal Assumption Harness

## Overview

In this lab you will translate a constrained-random UVM scenario into a formal assumption/property harness for a simple FIFO. The buggy testbench contains an **over-constrained assumption** that masks a real overflow bug. Your goal is to identify the masking assumption, relax it, observe the counterexample, and then fix the design constraint properly.

## Learning Objectives

1. Understand how UVM constraints map to formal `assume` properties.
2. Experience how over-constraining hides real bugs from the formal engine.
3. Practice the counterexample-to-directed-test feedback loop.

## Setup

The lab contains two files:

| File | Description |
|------|-------------|
| `testbench_buggy.sv` | Formal harness with an overly strict assumption that prevents the engine from finding a real overflow bug. |
| `testbench_solution.sv` | Corrected harness where assumptions match design intent. |

## Steps

### Step 1: Read the Buggy Harness

Open `testbench_buggy.sv`. Notice the three assumptions:

- `a_legal_push` — prevents push when full (correct)
- `a_legal_pop` — prevents pop when empty (correct)
- `a_never_consecutive_push` — **never allows two consecutive pushes** (this is the over-constraint)

The safety assertion `prop_full_correct` checks that `full` matches `(count == DEPTH)`.

### Step 2: Run Formal (Mentally or in a Formal Tool)

With all three assumptions active, the formal engine reports **all properties proven**. But `a_never_consecutive_push` is so restrictive that the FIFO can barely fill — it effectively prevents the engine from exploring states where the FIFO is more than half full.

**Question:** Is the design actually safe, or did we just prevent the engine from seeing the bug?

### Step 3: Relax the Over-Constraint

Remove or comment out `a_never_consecutive_push`. Now re-run. The formal engine finds a **counterexample**: a rapid burst of pushes overflows past `DEPTH` because the RTL's `count` incrementing logic has a one-cycle latency before `full` updates.

### Step 4: Fix the Design

The solution is NOT to keep the over-constraint. Instead:
1. Fix the RTL so `full` updates combinationally from `count`, or
2. Add a proper guard in the push logic to check `count < DEPTH` instead of relying on `full`.

See `testbench_solution.sv` for the corrected harness.

## Key Takeaway

Over-constraining formal assumptions is the equivalent of never testing a code path — it gives false confidence. Always audit assumptions to ensure they match **actual environment behavior**, not wishful thinking.
