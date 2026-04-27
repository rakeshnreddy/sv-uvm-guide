// =============================================================
// Lab: Mini UVM FIFO Environment Capstone
// File: testbench.sv
//
// Complete the TODOs, then compare against solution.sv.
// Run once with +define+INJECT_FIFO_BUG to prove the scoreboard
// catches the ordering bug, then run without the define to close.
// =============================================================

`include "uvm_macros.svh"
import uvm_pkg::*;

localparam int FIFO_DEPTH = 4;

typedef enum bit [1:0] {
  FIFO_WRITE,
  FIFO_READ
} fifo_op_e;

// -------------------------------------------------------------
// DUT with optional injected bug.
// -------------------------------------------------------------
module packet_fifo #(
  parameter int DEPTH = FIFO_DEPTH,
  parameter int WIDTH = 8
) (
  input  logic                         clk,
  input  logic                         rst_n,
  input  logic                         push,
  input  logic                         pop,
  input  logic [WIDTH-1:0]             din,
  output logic [WIDTH-1:0]             dout,
  output logic                         full,
  output logic                         empty,
  output logic [$clog2(DEPTH+1)-1:0]   level
);
  localparam int PTR_W = $clog2(DEPTH);

  logic [WIDTH-1:0] mem [DEPTH];
  logic [PTR_W-1:0] rd_ptr;
  logic [PTR_W-1:0] wr_ptr;
  logic [$clog2(DEPTH+1)-1:0] count;

  assign full  = (count == DEPTH);
  assign empty = (count == 0);
  assign level = count;

  function automatic logic [PTR_W-1:0] bump(input logic [PTR_W-1:0] ptr);
    return (ptr == DEPTH-1) ? '0 : ptr + 1'b1;
  endfunction

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      rd_ptr <= '0;
      wr_ptr <= '0;
      count  <= '0;
      dout   <= '0;
    end else begin
      if (push && !full) begin
        mem[wr_ptr] <= din;
        wr_ptr <= bump(wr_ptr);
      end

      if (pop && !empty) begin
`ifdef INJECT_FIFO_BUG
        if (mem[rd_ptr] == 8'hA5 && count > 1)
          dout <= mem[bump(rd_ptr)];
        else
          dout <= mem[rd_ptr];
`else
        dout <= mem[rd_ptr];
`endif
        rd_ptr <= bump(rd_ptr);
      end

      unique case ({push && !full, pop && !empty})
        2'b10: count <= count + 1'b1;
        2'b01: count <= count - 1'b1;
        default: count <= count;
      endcase
    end
  end
endmodule

interface fifo_if(input logic clk, input logic rst_n);
  logic push;
  logic pop;
  logic [7:0] din;
  logic [7:0] dout;
  logic full;
  logic empty;
  logic [$clog2(FIFO_DEPTH+1)-1:0] level;
endinterface

class fifo_txn extends uvm_sequence_item;
  rand fifo_op_e op;
  rand bit [7:0] data;
  bit [7:0] observed_data;
  bit push_accepted;
  bit pop_accepted;
  int unsigned depth_before;

  `uvm_object_utils_begin(fifo_txn)
    `uvm_field_enum(fifo_op_e, op, UVM_ALL_ON)
    `uvm_field_int(data, UVM_ALL_ON)
    `uvm_field_int(observed_data, UVM_ALL_ON)
    `uvm_field_int(push_accepted, UVM_ALL_ON)
    `uvm_field_int(pop_accepted, UVM_ALL_ON)
    `uvm_field_int(depth_before, UVM_ALL_ON)
  `uvm_object_utils_end

  function new(string name = "fifo_txn");
    super.new(name);
  endfunction
endclass

typedef uvm_sequencer #(fifo_txn) fifo_sequencer;

class fifo_base_seq extends uvm_sequence #(fifo_txn);
  `uvm_object_utils(fifo_base_seq)

  function new(string name = "fifo_base_seq");
    super.new(name);
  endfunction

  virtual task send_write(bit [7:0] data);
    fifo_txn txn;
    // TODO: create a fifo_txn, start it, set op/data, and finish it.
  endtask

  virtual task send_read();
    fifo_txn txn;
    // TODO: create a fifo_txn, start it, set op to FIFO_READ, and finish it.
  endtask

  task body();
    // TODO: add a minimal write/read sanity sequence.
  endtask
endclass

class fifo_capstone_seq extends fifo_base_seq;
  `uvm_object_utils(fifo_capstone_seq)

  function new(string name = "fifo_capstone_seq");
    super.new(name);
  endfunction

  task body();
    // TODO: call send_write/send_read to hit:
    // - normal data
    // - 8'hA5 followed by another word, then reads to expose the injected bug
    // - fill-to-full and drain-to-empty coverage cases
  endtask
endclass

class fifo_driver extends uvm_driver #(fifo_txn);
  `uvm_component_utils(fifo_driver)

  virtual fifo_if vif;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual fifo_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "fifo_if not configured for driver")
  endfunction

  task run_phase(uvm_phase phase);
    fifo_txn txn;
    forever begin
      seq_item_port.get_next_item(txn);
      // TODO: drive FIFO_WRITE as a push and FIFO_READ as a pop.
      // Wait if full before a write and wait if empty before a read.
      seq_item_port.item_done();
    end
  endtask
endclass

class fifo_monitor extends uvm_monitor;
  `uvm_component_utils(fifo_monitor)

  virtual fifo_if vif;
  uvm_analysis_port #(fifo_txn) ap;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    ap = new("ap", this);
    if (!uvm_config_db#(virtual fifo_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "fifo_if not configured for monitor")
  endfunction

  task run_phase(uvm_phase phase);
    // TODO: passively sample push/pop requests at the clock edge.
    // Publish one fifo_txn per accepted push or pop through ap.write(txn).
  endtask
endclass

class fifo_agent extends uvm_agent;
  `uvm_component_utils(fifo_agent)

  fifo_sequencer sequencer;
  fifo_driver driver;
  fifo_monitor monitor;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // TODO: create monitor always.
    // TODO: create sequencer and driver when get_is_active() == UVM_ACTIVE.
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    // TODO: connect driver.seq_item_port to sequencer.seq_item_export.
  endfunction
endclass

class fifo_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(fifo_scoreboard)

  uvm_tlm_analysis_fifo #(fifo_txn) observed_fifo;
  bit [7:0] model_q[$];
  int matches;
  int mismatches;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    observed_fifo = new("observed_fifo", this);
  endfunction

  task run_phase(uvm_phase phase);
    fifo_txn txn;
    forever begin
      observed_fifo.get(txn);
      // TODO: update model_q on accepted writes.
      // TODO: pop and compare on accepted reads.
    end
  endtask
endclass

class fifo_coverage extends uvm_subscriber #(fifo_txn);
  `uvm_component_utils(fifo_coverage)

  covergroup fifo_cg with function sample(fifo_txn txn);
    option.per_instance = 1;
    // TODO: cover operation, data class, depth before operation, and op x depth.
  endgroup

  function new(string name, uvm_component parent);
    super.new(name, parent);
    fifo_cg = new();
  endfunction

  function void write(fifo_txn txn);
    fifo_cg.sample(txn);
  endfunction
endclass

class fifo_env extends uvm_env;
  `uvm_component_utils(fifo_env)

  fifo_agent agent;
  fifo_scoreboard scoreboard;
  fifo_coverage coverage;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // TODO: create agent, scoreboard, and coverage.
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    // TODO: connect monitor.ap to scoreboard.observed_fifo.analysis_export.
    // TODO: connect monitor.ap to coverage.analysis_export.
  endfunction
endclass

class fifo_capstone_test extends uvm_test;
  `uvm_component_utils(fifo_capstone_test)

  fifo_env env;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = fifo_env::type_id::create("env", this);
    // TODO: factory-override fifo_base_seq with fifo_capstone_seq.
  endfunction

  task run_phase(uvm_phase phase);
    fifo_base_seq seq;
    phase.raise_objection(this);
    // TODO: create fifo_base_seq through the factory and start it on env.agent.sequencer.
    phase.drop_objection(this);
  endtask
endclass

module tb_top;
  logic clk;
  logic rst_n;

  fifo_if fifo_vif(clk, rst_n);

  packet_fifo dut (
    .clk(clk),
    .rst_n(rst_n),
    .push(fifo_vif.push),
    .pop(fifo_vif.pop),
    .din(fifo_vif.din),
    .dout(fifo_vif.dout),
    .full(fifo_vif.full),
    .empty(fifo_vif.empty),
    .level(fifo_vif.level)
  );

  initial begin
    clk = 1'b0;
    forever #5 clk = ~clk;
  end

  initial begin
    rst_n = 1'b0;
    fifo_vif.push = 1'b0;
    fifo_vif.pop = 1'b0;
    fifo_vif.din = '0;
    repeat (4) @(posedge clk);
    rst_n = 1'b1;
  end

  initial begin
    uvm_config_db#(virtual fifo_if)::set(null, "*", "vif", fifo_vif);
    run_test("fifo_capstone_test");
  end
endmodule

