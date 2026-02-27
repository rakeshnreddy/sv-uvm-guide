# The State Machine Bug Hunt

## Objective
Use functional coverage to identify untested transitions in an RTL state machine.

## Overview
You are testing a simple 3-state machine (IDLE, ACTIVE, ERROR).
The testbench generates random requests, but it might not be hitting all possible state transitions.

## Your Task

### 1. The Broken Coverage
Open `fsm_buggy.sv`. The covergroup only tracks the *current* state.
When you run it, the coverage report might say 100% (all three states were hit).
But did we test every *transition*? Did we test going from IDLE directly to ERROR?

### 2. The Solution
Open `fsm_solution.sv`. 
1. Use transition coverage syntax (`=>`) to capture the specific arcs.
2. Add `illegal_bins` for transitions that the RTL architecture explicitly forbids (e.g., ACTIVE cannot go back to IDLE without a reset).

Run the simulation and observe the detailed coverage report.
