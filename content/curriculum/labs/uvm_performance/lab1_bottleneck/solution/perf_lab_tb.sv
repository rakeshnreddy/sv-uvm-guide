// perf_lab_tb.sv: SOLUTION for lab uvm-performance-1 (E-PERF-1).
// Same checks and same results as the starter; the five costs are removed.
// Each fix is marked FIX 1 to FIX 5. Expected final summary:
//   PERF_SUMMARY items=1000 fmt=0 cfg_get=1 raises=1 cmp=1000 samples=1000 cov=100.0
`include "uvm_macros.svh"

interface stream_if (input logic clk);
  timeunit 1ns; timeprecision 1ps;
  logic        valid;
  logic [15:0] id;
  logic [7:0]  data;
  clocking mon_cb @(posedge clk);
    input valid, id, data;  // sampled just before each rising edge
  endclocking
endinterface

// The DUT: sends N_PKTS packets, one every GAP clocks, then goes idle.
// id counts up from 0; data = 8'(id * 7 + 3).
module pkt_src #(
  parameter int unsigned N_PKTS = 1000,
  parameter int unsigned GAP    = 4
) (
  input  logic        clk,
  input  logic        rst_n,
  output logic        valid,
  output logic [15:0] id,
  output logic [7:0]  data
);
  timeunit 1ns; timeprecision 1ps;
  logic [15:0] next_id;
  int unsigned cyc;
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      valid   <= 1'b0;
      id      <= '0;
      data    <= '0;
      next_id <= '0;
      cyc     <= 0;
    end else begin
      cyc <= (cyc == GAP - 1) ? 0 : cyc + 1;
      if (cyc == GAP - 1 && next_id < N_PKTS) begin
        valid   <= 1'b1;
        id      <= next_id;
        data    <= 8'(next_id * 7 + 3);
        next_id <= next_id + 16'd1;
      end else begin
        valid   <= 1'b0;
      end
    end
  end
endmodule

package perf_lab_pkg;
  timeunit 1ns; timeprecision 1ps;  // every design element declares its own (§3.14.2.3)
  import uvm_pkg::*;

  localparam int unsigned N_ITEMS = 1000;
  localparam int unsigned GAP     = 4;

  // Operation counters. They are exact and repeatable, unlike CPU time,
  // so the final state of the lab is graded on them.
  int unsigned n_fmt;      // messages about an item that were built
  int unsigned n_cfg_get;  // configuration lookups of "strict"
  int unsigned n_raise;    // objection raises
  int unsigned n_cmp;      // scoreboard duplicate-check comparisons
  int unsigned n_sample;   // covergroup samples

  function automatic void raise_counted(uvm_phase phase, uvm_object obj);
    n_raise++;
    phase.raise_objection(obj);
  endfunction

  class pkt_item extends uvm_sequence_item;
    bit [15:0] id;
    bit [7:0]  data;
    `uvm_object_utils(pkt_item)
    function new(string name = "pkt_item");
      super.new(name);
    endfunction
    virtual function string convert2string();
      n_fmt++;  // every message about an item is built here
      return $sformatf("id=%0d data=0x%02h", id, data);
    endfunction
  endclass

  // ---------------------------------------------------------------- monitor
  class pkt_mon extends uvm_monitor;
    `uvm_component_utils(pkt_mon)
    virtual stream_if vif;
    uvm_analysis_port #(pkt_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      ap = new("ap", this);
      if (!uvm_config_db#(virtual stream_if)::get(this, "", "vif", vif))
        `uvm_fatal("NO_VIF", "virtual interface not found")
    endfunction

    task run_phase(uvm_phase phase);
      pkt_item t;
      forever begin
        @(vif.mon_cb);
        if (vif.mon_cb.valid !== 1'b1) continue;
        // FIX 3: no objection per item. The test's single objection keeps the
        // phase open, and write() takes no simulated time, so nothing is missed.
        t = pkt_item::type_id::create("t");  // still a new item every time
        t.id   = vif.mon_cb.id;
        t.data = vif.mon_cb.data;
        ap.write(t);
      end
    endtask
  endclass

  // ------------------------------------------------------------- scoreboard
  class pkt_sb extends uvm_scoreboard;
    `uvm_component_utils(pkt_sb)
    uvm_analysis_imp #(pkt_item, pkt_sb) item_imp;
    int unsigned seen, matched, mismatched;
    int          strict;          // 1: a data mismatch is an error
    bit          id_seen[bit [15:0]];  // FIX 4: ids seen, looked up by key

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      item_imp = new("item_imp", this);
      // FIX 2: one lookup, before the run. A test that must change the value
      // during the run would pass a configuration object instead.
      if (!get_strict())
        `uvm_fatal("NO_CFG", "strict not set")
    endfunction

    // Every lookup of "strict" goes through here, so the bench can count them.
    function bit get_strict();
      n_cfg_get++;
      return uvm_config_db#(int)::get(this, "", "strict", strict);
    endfunction

    // Has this id been seen before? One lookup per item, not one per earlier item.
    function bit is_duplicate(pkt_item t);
      n_cmp++;
      is_duplicate = id_seen.exists(t.id);
      id_seen[t.id] = 1'b1;
    endfunction

    function void write(pkt_item t);
      bit [7:0] exp_data;
      seen++;
      if (is_duplicate(t))
        `uvm_error("DUP_ID", $sformatf("id %0d seen twice", t.id))
      exp_data = 8'(t.id * 7 + 3);  // reference model
      if (t.data === exp_data) begin
        matched++;
        // FIX 1: the macro builds the message only if it will be shown.
        `uvm_info("SB", {"match ", t.convert2string()}, UVM_HIGH)
      end else begin
        mismatched++;
        if (strict != 0)
          `uvm_error("MISMATCH", $sformatf("%s, expected data=0x%02h",
                                           t.convert2string(), exp_data))
        else
          `uvm_warning("MISMATCH", $sformatf("%s, expected data=0x%02h",
                                             t.convert2string(), exp_data))
      end
    endfunction

    function void check_phase(uvm_phase phase);
      super.check_phase(phase);
      if (seen != N_ITEMS)
        `uvm_error("COUNT", $sformatf("expected %0d items, saw %0d", N_ITEMS, seen))
    endfunction

    function void report_phase(uvm_phase phase);
      super.report_phase(phase);
      `uvm_info("SCB_SUMMARY", $sformatf("matches=%0d mismatches=%0d pending=%0d",
                matched, mismatched, (seen < N_ITEMS) ? N_ITEMS - seen : 0), UVM_NONE)
    endfunction
  endclass

  // --------------------------------------------------------------- coverage
  class pkt_cov extends uvm_subscriber #(pkt_item);
    `uvm_component_utils(pkt_cov)

    covergroup data_cg with function sample(bit [7:0] d);
      cp_data: coverpoint d {
        bins low  = {[0:63]};
        bins mid  = {[64:191]};
        bins high = {[192:255]};
      }
    endgroup

    function new(string name, uvm_component parent);
      super.new(name, parent);
      data_cg = new();
    endfunction

    function void sample_counted(bit [7:0] d);
      n_sample++;
      data_cg.sample(d);
    endfunction

    // FIX 5: sample once per transaction, not once per clock. Idle cycles
    // are no longer counted as data, and there is no polling process.
    function void write(pkt_item t);
      sample_counted(t.data);
    endfunction
  endclass

  // -------------------------------------------------------------------- env
  class perf_env extends uvm_env;
    `uvm_component_utils(perf_env)
    pkt_mon mon;
    pkt_sb  sb;
    pkt_cov cov;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      mon = pkt_mon::type_id::create("mon", this);
      sb  = pkt_sb::type_id::create("sb", this);
      cov = pkt_cov::type_id::create("cov", this);
    endfunction
    function void connect_phase(uvm_phase phase);
      mon.ap.connect(sb.item_imp);
      mon.ap.connect(cov.analysis_export);
    endfunction
  endclass

  // ------------------------------------------------------------------- test
  class perf_test extends uvm_test;
    `uvm_component_utils(perf_test)
    perf_env env;
    virtual stream_if vif;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      // Twenty other blocks of a bigger TB set their own "strict".
      for (int i = 0; i < 20; i++)
        uvm_config_db#(int)::set(this, $sformatf("env.blk%0d.*", i), "strict", 0);
      uvm_config_db#(int)::set(this, "env.sb", "strict", 1);
      if (!uvm_config_db#(virtual stream_if)::get(this, "", "vif", vif))
        `uvm_fatal("NO_VIF", "virtual interface not found")
      env = perf_env::type_id::create("env", this);
    endfunction

    task run_phase(uvm_phase phase);
      raise_counted(phase, this);
      // Reset, N_ITEMS packets one every GAP clocks, and a margin.
      repeat (GAP * N_ITEMS + 8) @(vif.mon_cb);
      phase.drop_objection(this);
    endtask

    function void report_phase(uvm_phase phase);
      super.report_phase(phase);
      `uvm_info("PERF_SUMMARY", $sformatf(
                "items=%0d fmt=%0d cfg_get=%0d raises=%0d cmp=%0d samples=%0d cov=%0.1f",
                env.sb.seen, n_fmt, n_cfg_get, n_raise, n_cmp, n_sample,
                env.cov.data_cg.get_coverage()), UVM_NONE)
    endfunction
  endclass
endpackage

module tb_top;
  timeunit 1ns; timeprecision 1ps;
  import uvm_pkg::*;
  import perf_lab_pkg::*;

  logic clk;
  logic rst_n;
  stream_if sif (.clk(clk));
  pkt_src #(.N_PKTS(N_ITEMS), .GAP(GAP)) dut (
    .clk(clk), .rst_n(rst_n), .valid(sif.valid), .id(sif.id), .data(sif.data)
  );

  initial clk = 1'b0;
  always #5ns clk = ~clk;

  initial begin
    rst_n = 1'b0;
    #12ns rst_n = 1'b1;  // released between edges, so it cannot race the flops
  end

  initial begin
    uvm_config_db#(virtual stream_if)::set(null, "uvm_test_top*", "vif", sif);
    run_test("perf_test");
  end
endmodule
