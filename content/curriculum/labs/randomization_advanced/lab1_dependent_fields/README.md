# The Dependent Fields Challenge

## Objective
Learn how to use `solve...before` and `post_randomize()` to manage complex dependencies between randomized variables.

## Overview
This directory contains a simple packet class. The packet has a `length` field, an array of `payload` bytes, and an 8-bit `crc` field.
The requirement is:
1. The `length` must be between 4 and 16.
2. The `payload` array size must match `length`.
3. The `crc` must correctly reflect the XOR sum of all `payload` bytes.

## Your Task

### 1. The Broken Attempt
Open `packet_buggy.sv`. You will see an attempt to solve this purely with declarative constraints:
```systemverilog
constraint c_crc {
  crc == payload.sum(item) with (item ^ 0); // This syntax is illegal/unsupported in constraints!
}
```
Run `make run_buggy`. Observe that the constraint solver fails or the syntax errors out, because arbitrary function calls or complex array reductions (like XOR sums) are often not natively supported or are very inefficient for constraint solvers.

### 2. The `post_randomize` Solution
Open `packet_solution.sv`. 
Instead of forcing the solver to calculate the CRC mathematically, we let the solver determine the `length` and `payload` first. 
Once the solver finishes determining the legal random bytes, we calculate the CRC procedurally.

1. Remove the `crc` constraint.
2. Implement the built-in `function void post_randomize()` callback.
3. Inside `post_randomize()`, use a `foreach` loop to XOR the payload bytes and assign the result to `crc`.

### 3. Guiding the Solver (`solve...before`)
Sometimes, array sizing dependencies require a hint to the solver to prevent probability skews or failures.
Add a `solve length before payload;` constraint block. This guarantees the solver explicitly picks a random `length` first, and then sizes the `payload` array, ensuring an even distribution of packet sizes.

Run `make run_solution`. The packets will randomize cleanly, and the CRC will match the payload correctly!
