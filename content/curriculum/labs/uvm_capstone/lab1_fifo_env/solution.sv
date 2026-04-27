// =============================================================
// Lab: Mini UVM FIFO Environment Capstone
// File: solution.sv
//
// Expected behavior:
//   +define+INJECT_FIFO_BUG -> scoreboard reports the injected bug.
//   no define              -> zero mismatches and coverage closure.
// =============================================================

`include "uvm_macros.svh"
import uvm_pkg::*;

localparam int FIFO_DEPTH = 4;

typedef enum bit [1:0] {
  FIFO_WRITE,
  FIFO_READ
} fifo_op_e;

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

  function string convert2string();
    return $sformatf("op=%s data=0x%02h observed=0x%02h push_ok=%0b pop_ok=%0b depth_before=%0d",
                     op.name(), data, observed_data, push_accepted, pop_accepted, depth_before);
  endfunction
endclass

typedef uvm_sequencer #(fifo_txn) fifo_sequencer;

class fifo_base_seq extends uvm_sequence #(fifo_txn);
  `uvm_object_utils(fifo_base_seq)

  function new(string name = "fifo_base_seq");
    super.new(name);
  endfunction

  virtual task send_write(bit [7:0] data);
    fifo_txn txn = fifo_txn::type_id::create($sformatf("wr_%02h", data));
    start_item(txn);
    txn.op = FIFO_WRITE;
    txn.data = data;
    finish_item(txn);
  endtask

  virtual task send_read();
    fifo_txn txn = fifo_txn::type_id::create("rd");
    start_item(txn);
    txn.op = FIFO_READ;
    txn.data = '0;
    finish_item(txn);
  endtask

  task body();
    send_write(8'h11);
    send_read();
  endtask
endclass

class fifo_capstone_seq extends fifo_base_seq;
  `uvm_object_utils(fifo_capstone_seq)

  function new(string name = "fifo_capstone_seq");
    super.new(name);
  endfunction

  task body();
    `uvm_info("SEQ", "Running factory-overridden fifo_capstone_seq", UVM_MEDIUM)

    send_write(8'h00);
    send_read();

    send_write(8'hA5);
    send_write(8'h5A);
    send_read();
    send_read();

    send_write(8'h11);
    send_write(8'h22);
    send_write(8'h33);
    send_write(8'h44);
    send_read();
    send_read();
    send_read();
    send_read();
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

    vif.push <= 1'b0;
    vif.pop  <= 1'b0;
    vif.din  <= '0;
    wait (vif.rst_n);

    forever begin
      seq_item_port.get_next_item(txn);
      drive_one(txn);
      seq_item_port.item_done();
    end
  endtask

  task drive_one(fifo_txn txn);
    case (txn.op)
      FIFO_WRITE: begin
        do @(negedge vif.clk); while (vif.full);
        vif.din  <= txn.data;
        vif.push <= 1'b1;
        vif.pop  <= 1'b0;
        @(negedge vif.clk);
        vif.push <= 1'b0;
      end
      FIFO_READ: begin
        do @(negedge vif.clk); while (vif.empty);
        vif.push <= 1'b0;
        vif.pop  <= 1'b1;
        @(negedge vif.clk);
        vif.pop <= 1'b0;
      end
    endcase
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
    fifo_txn txn;
    bit push_req;
    bit pop_req;
    bit full_before;
    bit empty_before;
    bit [7:0] din_before;
    int unsigned depth_before;

    forever begin
      @(posedge vif.clk);
      if (!vif.rst_n)
        continue;

      push_req = vif.push;
      pop_req = vif.pop;
      full_before = vif.full;
      empty_before = vif.empty;
      din_before = vif.din;
      depth_before = vif.level;

      #1;

      if (push_req || pop_req) begin
        txn = fifo_txn::type_id::create("observed_txn", this);
        txn.op = push_req ? FIFO_WRITE : FIFO_READ;
        txn.data = din_before;
        txn.observed_data = vif.dout;
        txn.push_accepted = push_req && !full_before;
        txn.pop_accepted = pop_req && !empty_before;
        txn.depth_before = depth_before;
        ap.write(txn);
      end
    end
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
    monitor = fifo_monitor::type_id::create("monitor", this);

    if (get_is_active() == UVM_ACTIVE) begin
      sequencer = fifo_sequencer::type_id::create("sequencer", this);
      driver = fifo_driver::type_id::create("driver", this);
    end
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    if (get_is_active() == UVM_ACTIVE)
      driver.seq_item_port.connect(sequencer.seq_item_export);
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
    bit [7:0] expected;

    forever begin
      observed_fifo.get(txn);

      if (txn.push_accepted) begin
        model_q.push_back(txn.data);
        `uvm_info("SCB_PUSH", $sformatf("modeled push: %s", txn.convert2string()), UVM_LOW)
      end

      if (txn.pop_accepted) begin
        if (model_q.size() == 0) begin
          mismatches++;
          `uvm_error("SCB_UNDERFLOW", "DUT popped when the reference queue was empty")
        end else begin
          expected = model_q.pop_front();
          if (txn.observed_data !== expected) begin
            mismatches++;
            `uvm_error("SCB_MISMATCH",
                       $sformatf("expected 0x%02h observed 0x%02h txn=%s",
                                 expected, txn.observed_data, txn.convert2string()))
          end else begin
            matches++;
            `uvm_info("SCB_MATCH", $sformatf("matched read data 0x%02h", expected), UVM_LOW)
          end
        end
      end
    end
  endtask

  function void report_phase(uvm_phase phase);
    super.report_phase(phase);
    `uvm_info("SCB_SUMMARY",
              $sformatf("matches=%0d mismatches=%0d remaining_model_entries=%0d",
                        matches, mismatches, model_q.size()),
              UVM_NONE)
`ifdef INJECT_FIFO_BUG
    if (mismatches == 0)
      `uvm_error("MISSED_BUG", "Injected FIFO bug was not detected by the scoreboard")
`else
    if (mismatches != 0)
      `uvm_error("UNEXPECTED_MISMATCH", "Fixed-DUT run must have zero mismatches")
    if (model_q.size() != 0)
      `uvm_error("MODEL_NOT_EMPTY", "Reference queue was not drained")
`endif
  endfunction
endclass

class fifo_coverage extends uvm_subscriber #(fifo_txn);
  `uvm_component_utils(fifo_coverage)

  covergroup fifo_cg with function sample(fifo_txn txn);
    option.per_instance = 1;

    op_cp: coverpoint txn.op {
      bins write = {FIFO_WRITE};
      bins read = {FIFO_READ};
    }

    data_cp: coverpoint txn.data {
      bins zero = {8'h00};
      bins bug_pattern[] = {8'hA5, 8'h5A};
      bins normal = default;
    }

    depth_cp: coverpoint txn.depth_before {
      bins empty = {0};
      bins mid = {[1:FIFO_DEPTH-1]};
      bins full = {FIFO_DEPTH};
    }

    op_x_depth: cross op_cp, depth_cp {
      ignore_bins write_when_full = binsof(op_cp.write) && binsof(depth_cp.full);
      ignore_bins read_when_empty = binsof(op_cp.read) && binsof(depth_cp.empty);
    }
  endgroup

  function new(string name, uvm_component parent);
    super.new(name, parent);
    fifo_cg = new();
  endfunction

  function void write(fifo_txn txn);
    fifo_cg.sample(txn);
  endfunction

  function real coverage_pct();
    return fifo_cg.get_coverage();
  endfunction

  function void report_phase(uvm_phase phase);
    real pct;
    super.report_phase(phase);
    pct = coverage_pct();
    `uvm_info("COV_SUMMARY", $sformatf("FIFO capstone coverage = %0.2f%%", pct), UVM_NONE)
    if (pct < 90.0)
      `uvm_error("COV_LOW", "Expected at least 90% FIFO capstone coverage")
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
    agent = fifo_agent::type_id::create("agent", this);
    scoreboard = fifo_scoreboard::type_id::create("scoreboard", this);
    coverage = fifo_coverage::type_id::create("coverage", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    agent.monitor.ap.connect(scoreboard.observed_fifo.analysis_export);
    agent.monitor.ap.connect(coverage.analysis_export);
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
    fifo_base_seq::type_id::set_type_override(fifo_capstone_seq::get_type());
  endfunction

  task run_phase(uvm_phase phase);
    fifo_base_seq seq;
    phase.raise_objection(this);
    seq = fifo_base_seq::type_id::create("seq");
    `uvm_info("TEST", $sformatf("Created sequence type: %s", seq.get_type_name()), UVM_MEDIUM)
    seq.start(env.agent.sequencer);
    #40;
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
