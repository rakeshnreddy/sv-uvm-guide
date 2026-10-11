// =============================================================
// Lab: Mini UVM FIFO Environment Capstone
// File: testbench.sv (starter)
//
// Complete the TODOs. The file compiles as given; the run is only
// meaningful once the TODOs are done. Run once with
// +define+INJECT_FIFO_BUG to prove the scoreboard catches the ordering
// bug, then without the define for the clean run. README.md lists the
// expected log signatures.
// =============================================================

// Compilation-unit time unit (IEEE 1800-2023 3.14.2.2-3.14.2.3): every
// module and class in this file uses 1 ns. Compile uvm_pkg with the same
// default time unit.
timeunit 1ns;
timeprecision 1ps;

`include "uvm_macros.svh"
import uvm_pkg::*;

localparam int FIFO_DEPTH = 4;

typedef enum bit [1:0] {
  FIFO_WRITE,
  FIFO_READ
} fifo_op_e;

// -------------------------------------------------------------
// DUT with optional injected bug. Do not edit.
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

// -------------------------------------------------------------
// Interface (complete). The driver must drive only through driver_cb
// and the monitor must sample only through monitor_cb.
// -------------------------------------------------------------
interface fifo_if(input logic clk, input logic rst_n);
  logic push;
  logic pop;
  logic [7:0] din;
  logic [7:0] dout;
  logic full;
  logic empty;
  logic [$clog2(FIFO_DEPTH+1)-1:0] level;

  // Drives land just after the edge (Re-NBA region), so the DUT sees them
  // at the next edge. Inputs are sampled just before the edge (#1step).
  clocking driver_cb @(posedge clk);
    default input #1step output #0;
    input rst_n, full, empty;
    output push, pop, din;
  endclocking

  // Read these skews before you write the monitor. Everything that decides
  // whether a push or pop is accepted (push, pop, din, full, empty, level)
  // is sampled with #1step: the values the DUT's flops use at this edge.
  // dout is registered by a pop at this same edge, so it is sampled with
  // #0, after the edge's nonblocking updates: the popped word.
  clocking monitor_cb @(posedge clk);
    default input #1step;
    input rst_n, push, pop, din, full, empty, level;
    input #0 dout;
  endclocking
endinterface

// -------------------------------------------------------------
// Transaction and sequencer (complete).
// -------------------------------------------------------------
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

  virtual function string convert2string();
    return $sformatf("op=%s data=0x%02h observed=0x%02h push_ok=%0b pop_ok=%0b depth_before=%0d",
                     op.name(), data, observed_data, push_accepted, pop_accepted, depth_before);
  endfunction
endclass

typedef uvm_sequencer #(fifo_txn) fifo_sequencer;

// -------------------------------------------------------------
// Sequences.
// -------------------------------------------------------------
class fifo_base_seq extends uvm_sequence #(fifo_txn);
  `uvm_object_utils(fifo_base_seq)

  function new(string name = "fifo_base_seq");
    super.new(name);
  endfunction

  virtual task send_write(bit [7:0] data);
    fifo_txn txn;
    // TODO: create txn through the factory, start_item, set op to FIFO_WRITE
    // and data, then finish_item.
  endtask

  virtual task send_read();
    fifo_txn txn;
    // TODO: create txn through the factory, start_item, set op to FIFO_READ,
    // then finish_item.
  endtask

  virtual task body();
    // TODO: a minimal sanity sequence: one write, then one read.
  endtask
endclass

class fifo_capstone_seq extends fifo_base_seq;
  `uvm_object_utils(fifo_capstone_seq)

  function new(string name = "fifo_capstone_seq");
    super.new(name);
  endfunction

  virtual task body();
    // TODO: call send_write/send_read to hit:
    // - a write of 8'h00 and its read
    // - 8'hA5 followed by another word, then two reads (exposes the bug)
    // - four writes that fill the FIFO, then four reads that drain it
  endtask
endclass

// -------------------------------------------------------------
// Driver.
// -------------------------------------------------------------
class fifo_driver extends uvm_driver #(fifo_txn);
  `uvm_component_utils(fifo_driver)

  virtual fifo_if vif;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual fifo_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "fifo_if not configured for driver")
  endfunction

  virtual task run_phase(uvm_phase phase);
    // TODO: idle push, pop and din through driver_cb, then wait until
    // driver_cb samples rst_n as 1.
    forever begin
      seq_item_port.get_next_item(req);
      // TODO: FIFO_WRITE: wait (edge by edge) while driver_cb.full, drive din
      // and push for one cycle, then release push.
      // TODO: FIFO_READ: wait while driver_cb.empty, drive pop for one cycle,
      // then release pop.
      seq_item_port.item_done();
    end
  endtask
endclass

// -------------------------------------------------------------
// Monitor.
// -------------------------------------------------------------
class fifo_monitor extends uvm_monitor;
  `uvm_component_utils(fifo_monitor)

  virtual fifo_if vif;
  uvm_analysis_port #(fifo_txn) ap;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    ap = new("ap", this);
    if (!uvm_config_db#(virtual fifo_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "fifo_if not configured for monitor")
  endfunction

  virtual task run_phase(uvm_phase phase);
    // TODO: at every @(vif.monitor_cb) with rst_n sampled as 1, if push or
    // pop is requested, create a NEW fifo_txn and fill op, data (din for a
    // write), observed_data (dout), push_accepted (push && !full),
    // pop_accepted (pop && !empty) and depth_before (level), all through
    // monitor_cb. Then ap.write(txn).
  endtask
endclass

// -------------------------------------------------------------
// Agent.
// -------------------------------------------------------------
class fifo_agent extends uvm_agent;
  `uvm_component_utils(fifo_agent)

  fifo_sequencer sequencer;
  fifo_driver driver;
  fifo_monitor monitor;
  uvm_analysis_port #(fifo_txn) ap;   // monitor.ap, promoted to the boundary

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // TODO: construct ap with new.
    // TODO: create the monitor always.
    // TODO: create the sequencer and driver only when get_is_active() == UVM_ACTIVE.
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    // TODO: promote monitor.ap to ap.
    // TODO: when active, connect driver.seq_item_port to sequencer.seq_item_export.
  endfunction
endclass

// -------------------------------------------------------------
// Scoreboard.
// -------------------------------------------------------------
class fifo_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(fifo_scoreboard)

  uvm_analysis_export   #(fifo_txn) observed_export;  // the env connects here
  uvm_tlm_analysis_fifo #(fifo_txn) observed_fifo;
  bit [7:0] model_q[$];
  int match_count;
  int mismatches;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    observed_export = new("observed_export", this);
    observed_fifo   = new("observed_fifo", this);
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    // TODO: connect observed_export to observed_fifo.analysis_export.
  endfunction

  virtual task run_phase(uvm_phase phase);
    fifo_txn txn;
    forever begin
      observed_fifo.get(txn);
      // TODO: on push_accepted, push txn.data into model_q.
      // TODO: on pop_accepted, pop the expected word and compare it with
      // observed_data using !==; count match_count or mismatches, and report
      // each mismatch with `uvm_error("SCB_MISMATCH", ...). A pop with an
      // empty model_q is an error too.
    end
  endtask

  virtual function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    // TODO: SCB_PENDING error if observed_fifo is not empty or model_q is not
    // empty; SCB_NO_TRAFFIC error if no read was checked at all.
  endfunction

  virtual function void report_phase(uvm_phase phase);
    super.report_phase(phase);
    // TODO: one line, UVM_NONE verbosity:
    // SCB_SUMMARY matches=<n> mismatches=<n> pending=<model_q + fifo entries>
    // TODO: under `ifdef INJECT_FIFO_BUG, a MISSED_BUG error if mismatches == 0.
  endfunction
endclass

// -------------------------------------------------------------
// Coverage subscriber.
// -------------------------------------------------------------
class fifo_coverage extends uvm_subscriber #(fifo_txn);
  `uvm_component_utils(fifo_coverage)

  covergroup fifo_cg with function sample(fifo_txn txn);
    option.per_instance = 1;
    // TODO: op (write, read); data of writes only (8'h00, 8'hA5, 8'h5A);
    // depth before the operation (empty 0, mid 1..3, full 4); and the cross
    // of op and depth, ignoring write-when-full and read-when-empty.
  endgroup

  function new(string name, uvm_component parent);
    super.new(name, parent);
    fifo_cg = new();
  endfunction

  // uvm_subscriber declares write(T t); an override keeps the argument name t.
  virtual function void write(fifo_txn t);
    fifo_cg.sample(t);
  endfunction

  virtual function void report_phase(uvm_phase phase);
    super.report_phase(phase);
    // TODO: print COV_SUMMARY with fifo_cg.get_inst_coverage(), and a
    // COV_LOW error below 90%.
  endfunction
endclass

// -------------------------------------------------------------
// Environment.
// -------------------------------------------------------------
class fifo_env extends uvm_env;
  `uvm_component_utils(fifo_env)

  fifo_agent agent;
  fifo_scoreboard scoreboard;
  fifo_coverage coverage;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // TODO: create agent, scoreboard and coverage through the factory.
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    // TODO: connect agent.ap to scoreboard.observed_export and to
    // coverage.analysis_export (one level at a time: never reach inside).
  endfunction
endclass

// -------------------------------------------------------------
// Test.
// -------------------------------------------------------------
class fifo_capstone_test extends uvm_test;
  `uvm_component_utils(fifo_capstone_test)

  fifo_env env;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = fifo_env::type_id::create("env", this);
    uvm_root::get().set_timeout(100us);   // a hang ends with PH_TIMEOUT
    // TODO: factory-override fifo_base_seq with fifo_capstone_seq.
  endfunction

  virtual task run_phase(uvm_phase phase);
    fifo_base_seq seq;
    // TODO: raise an objection before anything consumes time.
    // TODO: set a drain time of one clock (10ns) on the phase's objection,
    // so the monitor's last transaction is checked before run_phase ends.
    // TODO: create fifo_base_seq through the factory, print its type name
    // with `uvm_info("TEST", ...), and start it on env.agent.sequencer.
    // TODO: drop the objection.
  endtask
endclass

// -------------------------------------------------------------
// Top module (complete).
// -------------------------------------------------------------
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

  // The driver idles push/pop/din itself, so tb_top writes no interface signal.
  initial begin
    rst_n = 1'b0;
    repeat (4) @(posedge clk);
    rst_n <= 1'b1;                      // nonblocking: no race with the DUT's flops
  end

  initial begin
    // Scoped to the agent's subtree: only the driver and monitor can get it.
    uvm_config_db#(virtual fifo_if)::set(null, "uvm_test_top.env.agent.*", "vif", fifo_vif);
    run_test("fifo_capstone_test");
  end
endmodule
