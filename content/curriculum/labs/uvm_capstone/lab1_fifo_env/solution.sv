// =============================================================
// Lab: Mini UVM FIFO Environment Capstone
// File: solution.sv (reference solution)
//
// Expected signatures (hand trace against IEEE 1800-2023 clocking
// semantics; confirm on your simulator):
//   no define               -> SCB_SUMMARY matches=7 mismatches=0 pending=0,
//                              COV_SUMMARY 100.00%, UVM_ERROR : 0, UVM_FATAL : 0
//   +define+INJECT_FIFO_BUG -> exactly 1 SCB_MISMATCH (expected 0xa5,
//                              observed 0x5a), SCB_SUMMARY matches=6
//                              mismatches=1 pending=0, no MISSED_BUG
// =============================================================

// Compilation-unit time unit (IEEE 1800-2023 3.14.2.2-3.14.2.3): every
// module and class in this file uses 1 ns, so 10ns and 100us below mean
// what they say. Compile uvm_pkg with the same default time unit.
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

// -------------------------------------------------------------
// Interface. Only the driver writes push, pop and din, through
// driver_cb; the DUT drives the rest.
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

  // Everything that decides whether a push or pop is accepted is sampled
  // with #1step: the values the DUT's flops use at this edge (IEEE 1800-2023
  // 14.4, 14.13). dout is registered by the pop at this same edge, so it is
  // sampled with #0, in the Observed region after the NBA update: the
  // popped word. Mixing the two views for full/empty/level is the bug the
  // earlier version of this lab had.
  clocking monitor_cb @(posedge clk);
    default input #1step;
    input rst_n, push, pop, din, full, empty, level;
    input #0 dout;
  endclocking
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

  virtual function string convert2string();
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

  virtual task body();
    send_write(8'h11);
    send_read();
  endtask
endclass

class fifo_capstone_seq extends fifo_base_seq;
  `uvm_object_utils(fifo_capstone_seq)

  function new(string name = "fifo_capstone_seq");
    super.new(name);
  endfunction

  virtual task body();
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

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual fifo_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "fifo_if not configured for driver")
  endfunction

  virtual task run_phase(uvm_phase phase);
    // Idle the bus from the first edge, then wait for reset to end.
    vif.driver_cb.push <= 1'b0;
    vif.driver_cb.pop  <= 1'b0;
    vif.driver_cb.din  <= '0;
    do @(vif.driver_cb); while (!vif.driver_cb.rst_n);

    forever begin
      seq_item_port.get_next_item(req);
      drive_one(req);
      seq_item_port.item_done();
    end
  endtask

  // Each operation: wait until it is legal, drive it for one cycle, then
  // release it. item_done() follows the edge at which the DUT executed it.
  virtual task drive_one(fifo_txn txn);
    case (txn.op)
      FIFO_WRITE: begin
        do @(vif.driver_cb); while (vif.driver_cb.full);
        vif.driver_cb.din  <= txn.data;
        vif.driver_cb.push <= 1'b1;
        vif.driver_cb.pop  <= 1'b0;
        @(vif.driver_cb);
        vif.driver_cb.push <= 1'b0;
      end
      FIFO_READ: begin
        do @(vif.driver_cb); while (vif.driver_cb.empty);
        vif.driver_cb.push <= 1'b0;
        vif.driver_cb.pop  <= 1'b1;
        @(vif.driver_cb);
        vif.driver_cb.pop <= 1'b0;
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

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    ap = new("ap", this);
    if (!uvm_config_db#(virtual fifo_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "fifo_if not configured for monitor")
  endfunction

  virtual task run_phase(uvm_phase phase);
    forever begin
      @(vif.monitor_cb);
      if (!vif.monitor_cb.rst_n)
        continue;

      // One new transaction for every edge with a push or pop request.
      // full/empty/level are the pre-edge values the DUT used to decide.
      if (vif.monitor_cb.push || vif.monitor_cb.pop) begin
        fifo_txn txn = fifo_txn::type_id::create("observed_txn");
        txn.op            = vif.monitor_cb.push ? FIFO_WRITE : FIFO_READ;
        txn.data          = vif.monitor_cb.push ? vif.monitor_cb.din : 8'h00;
        txn.observed_data = vif.monitor_cb.dout;
        txn.push_accepted = vif.monitor_cb.push && !vif.monitor_cb.full;
        txn.pop_accepted  = vif.monitor_cb.pop && !vif.monitor_cb.empty;
        txn.depth_before  = vif.monitor_cb.level;
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
  uvm_analysis_port #(fifo_txn) ap;   // monitor.ap, promoted to the boundary

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    ap = new("ap", this);
    monitor = fifo_monitor::type_id::create("monitor", this);

    if (get_is_active() == UVM_ACTIVE) begin
      sequencer = fifo_sequencer::type_id::create("sequencer", this);
      driver = fifo_driver::type_id::create("driver", this);
    end
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    monitor.ap.connect(ap);
    if (get_is_active() == UVM_ACTIVE)
      driver.seq_item_port.connect(sequencer.seq_item_export);
  endfunction
endclass

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
    observed_export.connect(observed_fifo.analysis_export);
  endfunction

  virtual task run_phase(uvm_phase phase);
    fifo_txn txn;
    bit [7:0] expected;

    forever begin
      observed_fifo.get(txn);

      if (txn.push_accepted) begin
        model_q.push_back(txn.data);
        `uvm_info("SCB_PUSH", $sformatf("modeled push: %s", txn.convert2string()), UVM_HIGH)
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
            match_count++;
            `uvm_info("SCB_MATCH", $sformatf("matched read data 0x%02h", expected), UVM_HIGH)
          end
        end
      end
    end
  endtask

  // Accounting from observed state only: no knowledge of the sequence length.
  virtual function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    if (!observed_fifo.is_empty())
      `uvm_error("SCB_PENDING", $sformatf("%0d observed transactions were never checked",
                                          observed_fifo.used()))
    if (model_q.size() != 0)
      `uvm_error("SCB_PENDING", $sformatf("%0d written words were never read back",
                                          model_q.size()))
    if (match_count + mismatches == 0)
      `uvm_error("SCB_NO_TRAFFIC", "no read was checked: this run proves nothing")
  endfunction

  virtual function void report_phase(uvm_phase phase);
    super.report_phase(phase);
    `uvm_info("SCB_SUMMARY",
              $sformatf("SCB_SUMMARY matches=%0d mismatches=%0d pending=%0d",
                        match_count, mismatches, model_q.size() + observed_fifo.used()),
              UVM_NONE)
`ifdef INJECT_FIFO_BUG
    if (mismatches == 0)
      `uvm_error("MISSED_BUG", "Injected FIFO bug was not detected by the scoreboard")
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

    // Data classes matter for writes only; reads carry no data.
    data_cp: coverpoint txn.data iff (txn.op == FIFO_WRITE) {
      bins zero = {8'h00};
      bins bug_pattern[] = {8'hA5, 8'h5A};
      bins normal = default;            // default bins do not count toward coverage
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

  // uvm_subscriber declares write(T t); an override keeps the argument name t.
  virtual function void write(fifo_txn t);
    fifo_cg.sample(t);
  endfunction

  virtual function void report_phase(uvm_phase phase);
    real pct;
    super.report_phase(phase);
    pct = fifo_cg.get_inst_coverage();
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

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    agent = fifo_agent::type_id::create("agent", this);
    scoreboard = fifo_scoreboard::type_id::create("scoreboard", this);
    coverage = fifo_coverage::type_id::create("coverage", this);
  endfunction

  // One level at a time: the env sees the agent's port and the
  // scoreboard's export, never the components inside them.
  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    agent.ap.connect(scoreboard.observed_export);
    agent.ap.connect(coverage.analysis_export);
  endfunction
endclass

class fifo_capstone_test extends uvm_test;
  `uvm_component_utils(fifo_capstone_test)

  fifo_env env;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = fifo_env::type_id::create("env", this);
    fifo_base_seq::type_id::set_type_override(fifo_capstone_seq::get_type());
    uvm_root::get().set_timeout(100us);   // a hang ends with PH_TIMEOUT
  endfunction

  virtual task run_phase(uvm_phase phase);
    fifo_base_seq seq = fifo_base_seq::type_id::create("seq");
    phase.raise_objection(this);
    // The monitor publishes the last pop at the edge of its item_done();
    // one more clock after the drop lets that edge's work finish.
    phase.get_objection().set_drain_time(this, 10ns);
    `uvm_info("TEST", $sformatf("Created sequence type: %s", seq.get_type_name()), UVM_LOW)
    seq.start(env.agent.sequencer);
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
