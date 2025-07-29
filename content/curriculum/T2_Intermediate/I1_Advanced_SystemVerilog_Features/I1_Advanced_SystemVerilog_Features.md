---
title: "I1 – Advanced SystemVerilog Features"
description: "A guide on interfaces, modports, functional coverage (covergroups), and assertions (SVA)."
---

import { Quiz, InteractiveCode } from '@/components/ui';

## Cleaning up Connections with Interfaces

Remember the ALU testbench from Tier 1? The connection looked like this:

```systemverilog
alu dut (
  .clk(clk),
  .reset(reset),
  .a(a_in),
  .b(b_in),
  .opcode(opcode),
  .y(y_out)
);
```
Now imagine a design with 50 or 100 ports. This becomes a nightmare to manage and connect. Interfaces solve this problem by bundling all these signals into a single, reusable object.

### Defining an Interface

```systemverilog
interface alu_if (input logic clk);
  logic reset;
  logic [3:0] a;
  logic [3:0] b;
  enum {ADD, SUB} opcode;
  logic [4:0] y;

  // Modport for the Testbench side
  modport Testbench (
    output a, b, opcode, reset,
    input  y,
    input  clk
  );

  // Modport for the DUT side
  modport DUT (
    input  a, b, opcode, reset, clk,
    output y
  );
endinterface
```

### Using the Interface

Now our instantiation becomes beautifully simple:

```systemverilog
// In the testbench top
alu_if alu_bus(clk); // Instantiate the interface
alu dut(.alu_port(alu_bus.DUT)); // Connect the DUT modport
// Driver and monitor would connect to alu_bus.Testbench
```

## Functional Coverage

### What is Coverage?

Code coverage answers "Did my simulation execute this line of code?". Functional coverage answers "Did I exercise this specific design feature?". As a verification engineer, you will primarily focus on functional coverage.

### Covergroups and Coverpoints

A `covergroup` is a user-defined metric for what to measure. A `coverpoint` is a specific variable or expression you want to measure within that `covergroup`.

### Bins

Bins categorize the values of a coverpoint. You can define bins for specific values, ranges, or even ignore certain values.

- `illegal_bins`: These will cause an error if hit.
- `ignore_bins`: These values will be ignored for coverage purposes.

### Cross Coverage

The `cross` keyword measures the combination of values between two or more coverpoints. This is useful for ensuring that all combinations of features have been tested.

### Implementation

Here is how you would define a `covergroup` for the ALU transaction:

```systemverilog
class AluTransaction;
  // ... transaction properties ...

  covergroup AluCg;
    coverpoint opcode;
    coverpoint a {
      bins zero = {0};
      bins low = {[1:5]};
      bins high = {[6:15]};
    }
    coverpoint b {
      bins zero = {0};
      bins low = {[1:5]};
      bins high = {[6:15]};
    }
    cross a, b;
  endgroup

  function new();
    AluCg = new();
  endfunction

  function void sample_cg();
    AluCg.sample();
  endfunction
endclass
```

## SystemVerilog Assertions (SVA)

### Introduction to SVA

Assertions are properties that must hold true during simulation. They are a powerful tool for catching bugs at the exact moment a protocol violation or incorrect behavior occurs.

### Immediate vs. Concurrent Assertions

- **Immediate assertions** are procedural and check a condition at a specific point in time.
- **Concurrent assertions** are more powerful and can check for temporal conditions (conditions that occur over a period of time).

### Properties and Sequences

- A `sequence` is a series of events that occur in a specific order.
- A `property` is a boolean expression that can include sequences.

### Implication Operator

The implication operators (`|->` and `|=>`) are used to check for a condition following another condition.

### Example Assertion

Here is a simple assertion for the ALU: "If the opcode is ADD, then one cycle later the output y should be equal to a + b."

```systemverilog
property p_add;
  @(posedge clk)
  (opcode == ADD) |=> (y == a + b);
endproperty

a_add: assert property (p_add);
```
