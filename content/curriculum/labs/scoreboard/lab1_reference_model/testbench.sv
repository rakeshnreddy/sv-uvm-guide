// =============================================================
// Lab: Building a Self-Checking Scoreboard
// File: testbench.sv (STARTER CODE — complete the TODOs)
// =============================================================

`include "uvm_macros.svh"
import uvm_pkg::*;

// ------ DUT: Simple ALU ------
module alu_dut (
  input  logic        clk,
  input  logic        valid_in,
  input  logic [7:0]  op_a,
  input  logic [7:0]  op_b,
  input  logic [1:0]  opcode,  // 0=ADD, 1=SUB, 2=MUL, 3=AND
  output logic        valid_out,
  output logic [15:0] result
);
  always_ff @(posedge clk) begin
    valid_out <= valid_in;
    case (opcode)
      2'b00: result <= op_a + op_b;
      2'b01: result <= op_a - op_b;
      2'b10: result <= op_a * op_b;
      2'b11: result <= {8'b0, op_a & op_b};
    endcase
  end
endmodule

// ------ Transaction ------
class alu_transaction extends uvm_sequence_item;
  `uvm_object_utils(alu_transaction)

  rand logic [7:0]  op_a;
  rand logic [7:0]  op_b;
  rand logic [1:0]  opcode;
  logic [15:0]      result;  // Filled by monitor on output side

  function new(string name = "alu_transaction");
    super.new(name);
  endfunction

  function string convert2string();
    return $sformatf("op_a=%0d op_b=%0d opcode=%0d result=%0d",
                     op_a, op_b, opcode, result);
  endfunction
endclass

// ------ Interface ------
interface alu_if (input logic clk);
  logic        valid_in;
  logic [7:0]  op_a;
  logic [7:0]  op_b;
  logic [1:0]  opcode;
  logic        valid_out;
  logic [15:0] result;
endinterface

// ------ Monitor ------
class alu_monitor extends uvm_monitor;
  `uvm_component_utils(alu_monitor)

  virtual alu_if vif;
  uvm_analysis_port #(alu_transaction) ap;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    ap = new("ap", this);
    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "Virtual interface not found")
  endfunction

  task run_phase(uvm_phase phase);
    alu_transaction txn;
    forever begin
      @(posedge vif.clk iff vif.valid_out);
      txn = alu_transaction::type_id::create("txn");
      txn.op_a   = vif.op_a;
      txn.op_b   = vif.op_b;
      txn.opcode = vif.opcode;
      txn.result = vif.result;
      ap.write(txn);
    end
  endtask
endclass

// ------ Driver ------
class alu_driver extends uvm_driver #(alu_transaction);
  `uvm_component_utils(alu_driver)

  virtual alu_if vif;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "Virtual interface not found")
  endfunction

  task run_phase(uvm_phase phase);
    alu_transaction txn;
    forever begin
      seq_item_port.get_next_item(txn);
      @(posedge vif.clk);
      vif.valid_in <= 1'b1;
      vif.op_a     <= txn.op_a;
      vif.op_b     <= txn.op_b;
      vif.opcode   <= txn.opcode;
      @(posedge vif.clk);
      vif.valid_in <= 1'b0;
      seq_item_port.item_done();
    end
  endtask
endclass

// ------ Sequencer ------
typedef uvm_sequencer #(alu_transaction) alu_sequencer;

// ------ Sequence ------
class alu_random_seq extends uvm_sequence #(alu_transaction);
  `uvm_object_utils(alu_random_seq)

  function new(string name = "alu_random_seq");
    super.new(name);
  endfunction

  task body();
    alu_transaction txn;
    repeat (20) begin
      txn = alu_transaction::type_id::create("txn");
      start_item(txn);
      assert(txn.randomize());
      finish_item(txn);
    end
  endtask
endclass

// ======================================================
// TODO: Implement the alu_scoreboard class here
//
// Requirements:
//   1. Extend uvm_scoreboard
//   2. Create a uvm_tlm_analysis_fifo #(alu_transaction)
//   3. In run_phase, loop getting transactions from the FIFO
//   4. Implement a reference_model function:
//        function logic [15:0] reference_model(alu_transaction txn);
//          case (txn.opcode)
//            2'b00: return txn.op_a + txn.op_b;
//            2'b01: return txn.op_a - txn.op_b;
//            2'b10: return txn.op_a * txn.op_b;
//            2'b11: return {8'b0, txn.op_a & txn.op_b};
//          endcase
//        endfunction
//   5. Compare txn.result vs reference_model(txn)
//   6. Report with uvm_info on match, uvm_error on mismatch
// ======================================================

// class alu_scoreboard extends uvm_scoreboard;
//   ... YOUR CODE HERE ...
// endclass

// ------ Environment ------
class alu_env extends uvm_env;
  `uvm_component_utils(alu_env)

  alu_driver    driver;
  alu_monitor   monitor;
  alu_sequencer sequencer;
  // TODO: Declare alu_scoreboard here

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    driver    = alu_driver::type_id::create("driver", this);
    monitor   = alu_monitor::type_id::create("monitor", this);
    sequencer = alu_sequencer::type_id::create("sequencer", this);
    // TODO: Create scoreboard here
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    driver.seq_item_port.connect(sequencer.seq_item_export);
    // TODO: Connect monitor.ap to scoreboard's analysis FIFO
  endfunction
endclass

// ------ Test ------
class alu_test extends uvm_test;
  `uvm_component_utils(alu_test)

  alu_env env;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = alu_env::type_id::create("env", this);
  endfunction

  task run_phase(uvm_phase phase);
    alu_random_seq seq;
    phase.raise_objection(this);

    seq = alu_random_seq::type_id::create("seq");
    seq.start(env.sequencer);

    #100;
    phase.drop_objection(this);
  endtask
endclass

// ------ Top Module ------
module tb_top;
  logic clk;
  initial clk = 0;
  always #5 clk = ~clk;

  alu_if aif(.clk(clk));

  alu_dut dut (
    .clk       (clk),
    .valid_in  (aif.valid_in),
    .op_a      (aif.op_a),
    .op_b      (aif.op_b),
    .opcode    (aif.opcode),
    .valid_out (aif.valid_out),
    .result    (aif.result)
  );

  initial begin
    uvm_config_db#(virtual alu_if)::set(null, "*", "vif", aif);
    run_test("alu_test");
  end
endmodule
