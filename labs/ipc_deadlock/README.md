# Lab: Debugging Semaphore Deadlock

## Problem Statement
Your verification environment uses a `semaphore` to protect access to a shared hardware resource (like a specific memory bank or an I2C bus).
The simulation compiles and begins running, but the test hangs indefinitely around `130ns`. The simulation does not finish, and no further data is driven.

## Your Task
1. Inspect the testbench setup in `src/testbench.sv`.
2. Trace the code execution of the `producer_thread` and `consumer_thread`.
3. Identify why one thread is permanently blocked at the `get()` call.
4. Fix the bug so that both threads complete their work and the simulation naturally finishes at `Test finished successfully!`.

## Instructions
1. Run the simulation and observe where the log output stops.
2. Look closely at the `producer_thread` task. Notice that under certain randomized conditions (e.g., when the `data` is a highly specific value or error code), the code executes an `early return`.
3. What happens to the semaphore key when an early return occurs?
4. Fix the `producer_thread` by ensuring the semaphore key is always returned (`put(1)`), even if the function bails out early.

> **Why this matters:** A "key leak" is the most common semaphore-related bug. Always ensure that `put()` is guaranteed to execute (or use a try/finally pattern if available, or architect your loops carefully) before a thread yields control or exits.
