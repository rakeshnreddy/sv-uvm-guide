---
title: "I4 – Building a UVM Testbench (Step by Step)"
description: "A practical, hands-on guide to building your first complete UVM environment for the ALU DUT."
---

import { Quiz, InteractiveCode } from '@/components/ui';

## Introduction

This module will guide you through the process of creating a minimal, working UVM testbench for the ALU DUT introduced in Tier 1. We will use the `alu_if` interface from I1.

### DUT Code

```systemverilog
// alu.sv
module alu (alu_if.DUT alu_port);
  always_comb begin
    case (alu_port.opcode)
      ADD: alu_port.y = alu_port.a + alu_port.b;
      SUB: alu_port.y = alu_port.a - alu_port.b;
      default: alu_port.y = 'x;
    endcase
  end
endmodule
```

### Interface Code

```systemverilog
// alu_if.sv
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

## Step 1: The Transaction (`uvm_sequence_item`)

The `alu_transaction` class defines the data that will be sent to the DUT.

```systemverilog
// alu_transaction.sv
class alu_transaction extends uvm_sequence_item;
  rand logic [3:0] a;
  rand logic [3:0] b;
  rand enum {ADD, SUB} opcode;

  `uvm_object_utils_begin(alu_transaction)
    `uvm_field_int(a, UVM_ALL_ON)
    `uvm_field_int(b, UVM_ALL_ON)
    `uvm_field_enum(opcode, UVM_ALL_ON)
  `uvm_object_utils_end

  function new(string name = "alu_transaction");
    super.new(name);
  endfunction
endclass
```

- **`uvm_object_utils_begin`/`end`:** These macros register the class with the UVM factory.
- **`uvm_field_*` macros:** These macros automate the implementation of methods like `print()`, `copy()`, and `compare()`.

## Step 2: The Sequence (`uvm_sequence`)

The `alu_base_sequence` class defines the sequence of transactions that will be sent to the DUT.

```systemverilog
// alu_base_sequence.sv
class alu_base_sequence extends uvm_sequence #(alu_transaction);
  `uvm_object_utils(alu_base_sequence)

  function new(string name = "alu_base_sequence");
    super.new(name);
  endfunction

  virtual task body();
    alu_transaction req;
    req = alu_transaction::type_id::create("req");
    start_item(req);
    assert(req.randomize());
    finish_item(req);
  endtask
endclass
```

- **`start_item()`/`finish_item()`:** These methods handle the communication with the driver.

## Step 3: The Driver (`uvm_driver`)

The `alu_driver` class drives the signals on the `alu_if` interface.

```systemverilog
// alu_driver.sv
class alu_driver extends uvm_driver #(alu_transaction);
  `uvm_component_utils(alu_driver)

  virtual alu_if vif;

  function new(string name = "alu_driver", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
      `uvm_fatal("VIF", "Failed to get virtual interface")
  endfunction

  virtual task run_phase(uvm_phase phase);
    forever begin
      seq_item_port.get_next_item(req);
      vif.a <= req.a;
      vif.b <= req.b;
      vif.opcode <= req.opcode;
      #10;
      seq_item_port.item_done();
    end
  endtask
endclass
```

- **`get_next_item()`/`item_done()`:** These methods handle the communication with the sequencer.

## Step 4: The Monitor (`uvm_monitor`)

The `alu_monitor` class monitors the signals on the `alu_if` interface.

```systemverilog
// alu_monitor.sv
class alu_monitor extends uvm_monitor;
  `uvm_component_utils(alu_monitor)

  virtual alu_if vif;
  uvm_analysis_port #(alu_transaction) analysis_port;

  function new(string name = "alu_monitor", uvm_component parent = null);
    super.new(name, parent);
    analysis_port = new("analysis_port", this);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
      `uvm_fatal("VIF", "Failed to get virtual interface")
  endfunction

  virtual task run_phase(uvm_phase phase);
    forever begin
      @(posedge vif.clk);
      alu_transaction tx = alu_transaction::type_id::create("tx");
      tx.a = vif.a;
      tx.b = vif.b;
      tx.opcode = vif.opcode;
      analysis_port.write(tx);
    end
  endtask
endclass
```

- **`uvm_analysis_port`:** This port is used to broadcast transactions to other components (like a scoreboard).

## Step 5: The Agent (`uvm_agent`)

The `alu_agent` class contains the driver and monitor.

```systemverilog
// alu_agent.sv
class alu_agent extends uvm_agent;
  `uvm_component_utils(alu_agent)

  alu_driver drv;
  alu_monitor mon;

  function new(string name = "alu_agent", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    drv = alu_driver::type_id::create("drv", this);
    mon = alu_monitor::type_id::create("mon", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    drv.seq_item_port.connect(seq_item_export);
    mon.analysis_port.connect(this.analysis_port);
  endfunction
endclass
```

## Step 6: The Environment (`uvm_env`)

The `alu_env` class contains the agent.

```systemverilog
// alu_env.sv
class alu_env extends uvm_env;
  `uvm_component_utils(alu_env)

  alu_agent agent;

  function new(string name = "alu_env", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    agent = alu_agent::type_id::create("agent", this);
  endfunction
endclass
```

## Step 7: The Test (`uvm_test`)

The `base_test` class starts the test.

```systemverilog
// base_test.sv
class base_test extends uvm_test;
  `uvm_component_utils(base_test)

  alu_env env;

  function new(string name = "base_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = alu_env::type_id::create("env", this);
  endfunction

  task run_phase(uvm_phase phase);
    alu_base_sequence seq;
    phase.raise_objection(this);
    seq = alu_base_sequence::type_id::create("seq");
    seq.start(env.agent.drv.seq_item_port);
    phase.drop_objection(this);
  endtask
endclass
```

- **`raise_objection()`/`drop_objection()`:** These methods control the end of the test.

## Step 8: The Top-Level Module

The `tb_top` module is the static, non-UVM part of the testbench.

```systemverilog
// tb_top.sv
module tb_top;
  logic clk = 0;
  always #5 clk = ~clk;

  alu_if vif(clk);
  alu dut(.alu_port(vif.DUT));

  initial begin
    uvm_config_db#(virtual alu_if)::set(null, "uvm_test_top.env.agent.drv", "vif", vif);
    uvm_config_db#(virtual alu_if)::set(null, "uvm_test_top.env.agent.mon", "vif", vif);
    run_test("base_test");
  end
endmodule
```

## File Structure

```
I4_alu_uvm_testbench/
├── alu.sv
├── alu_agent.sv
├── alu_base_sequence.sv
├── alu_driver.sv
├── alu_env.sv
├── alu_if.sv
├── alu_monitor.sv
├── alu_transaction.sv
├── base_test.sv
└── tb_top.sv
```

## Running the Simulation

```bash
# VCS
vcs -sverilog +v2k -timescale=1ns/1ps -full64 -f files.f -l vcs.log +UVM_TESTNAME=base_test

# Questasim
qverilog -sv -f files.f +UVM_TESTNAME=base_test

# Xcelium
xrun -sv -f files.f +UVM_TESTNAME=base_test
```
