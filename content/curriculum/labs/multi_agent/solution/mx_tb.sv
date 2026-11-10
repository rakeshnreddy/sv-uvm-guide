// =============================================================
// Lab: Multi-agent environment with virtual sequences (M5)
// File: solution/mx_tb.sv  (reference solution)
//
// Compile with work/key_stream.sv, and with work/ on the include path
// for mx_mutants.svh. Tests (+UVM_TESTNAME=...):
//   mx_reconfig_test     clean run: SCB_SUMMARY matches=12 mismatches=0
//                        pending=0 order=0, RESULT TEST PASSED
//   mx_data_first_test   mutant 1: 3 ORDER + 3 ORDER_SVA, matches=9
//   mx_no_quiesce_test   mutant 2: 1 ORDER + 1 LOCK_SVA, matches=12
//   mx_passive_cfg_test  mutant 3: UVM_FATAL [NO_SQR] at 0 ns
//   +BUG=1 / +BUG=2 plant DUT bugs (README step 7).
// The README's expected logs were captured from Verilator 5.052 runs.
// =============================================================

`include "uvm_macros.svh"

// =============================================================
// interfaces
// =============================================================

// Configuration port: the testbench drives it.
interface cfg_if (input logic clk, input logic rst_n);
  timeunit 1ns;
  timeprecision 1ps;

  logic       we;
  logic [1:0] addr;
  logic [7:0] wdata;

  // Drives land just after the edge, so the DUT samples them at the next
  // edge; inputs are sampled just before the edge (#1step).
  clocking drv_cb @(posedge clk);
    default input #1step output #0;
    input  rst_n;
    output we, addr, wdata;
  endclocking

  clocking mon_cb @(posedge clk);
    default input #1step;
    input rst_n, we, addr, wdata;
  endclocking
endinterface

// Data in: the testbench drives it.
interface din_if (input logic clk, input logic rst_n);
  timeunit 1ns;
  timeprecision 1ps;

  logic       valid;
  logic [7:0] data;

  clocking drv_cb @(posedge clk);
    default input #1step output #0;
    input  rst_n;
    output valid, data;
  endclocking

  clocking mon_cb @(posedge clk);
    default input #1step;
    input rst_n, valid, data;
  endclocking
endinterface

// Data out: the DUT drives it, so it has no driving clocking block.
interface dout_if (input logic clk, input logic rst_n);
  timeunit 1ns;
  timeprecision 1ps;

  logic       valid;
  logic [7:0] data;

  clocking mon_cb @(posedge clk);
    default input #1step;
    input rst_n, valid, data;
  endclocking
endinterface

// =============================================================
// mx_pkg
// =============================================================
package mx_pkg;
  timeunit 1ns;
  timeprecision 1ps;

  import uvm_pkg::*;

  localparam bit [1:0] ADDR_CTRL = 2'd0;
  localparam bit [1:0] ADDR_KEY  = 2'd1;
  localparam bit       MODE_XOR  = 1'b0;
  localparam bit       MODE_ADD  = 1'b1;

  // The scenario the virtual sequence runs (README, "The scenario").
  localparam bit [7:0]    KEY_1     = 8'h3C;
  localparam bit [7:0]    KEY_2     = 8'hA5;
  localparam bit [7:0]    FIRST_1   = 8'h10;
  localparam bit [7:0]    FIRST_2   = 8'hE0;
  localparam bit [7:0]    STEP      = 8'h1D;
  localparam int unsigned BURST_LEN = 6;

  // -----------------------------------------------------------
  // items
  // -----------------------------------------------------------

  // One configuration write. The monitor sets stamp to the time of the
  // edge at which the DUT sampled the write.
  class cfg_item extends uvm_sequence_item;
    `uvm_object_utils(cfg_item)

    bit [1:0] addr;
    bit [7:0] wdata;
    time      stamp;

    function new(string name = "cfg_item");
      super.new(name);
    endfunction

    virtual function string convert2string();
      return $sformatf("%s=0x%02h @%0t", (addr == ADDR_KEY) ? "KEY" : (addr == ADDR_CTRL) ? "CTRL" : "?",
                       wdata, stamp);
    endfunction
  endclass

  // Stimulus for the data agent: a burst of bytes driven on consecutive
  // edges.
  class burst_item extends uvm_sequence_item;
    `uvm_object_utils(burst_item)

    bit [7:0] data[$];

    function new(string name = "burst_item");
      super.new(name);
    endfunction

    virtual function string convert2string();
      return $sformatf("burst of %0d bytes", data.size());
    endfunction
  endclass

  // One byte seen by a monitor, on data in or data out.
  class byte_item extends uvm_sequence_item;
    `uvm_object_utils(byte_item)

    bit [7:0] data;
    time      stamp;

    function new(string name = "byte_item");
      super.new(name);
    endfunction

    virtual function string convert2string();
      return $sformatf("0x%02h @%0t", data, stamp);
    endfunction
  endclass

  typedef uvm_sequencer #(cfg_item)   cfg_sequencer;
  typedef uvm_sequencer #(burst_item) burst_sequencer;

  // -----------------------------------------------------------
  // agent configuration objects
  // -----------------------------------------------------------
  class cfg_agent_cfg extends uvm_object;
    `uvm_object_utils(cfg_agent_cfg)
    virtual cfg_if          vif;
    uvm_active_passive_enum is_active = UVM_ACTIVE;
    function new(string name = "cfg_agent_cfg");
      super.new(name);
    endfunction
  endclass

  class din_agent_cfg extends uvm_object;
    `uvm_object_utils(din_agent_cfg)
    virtual din_if          vif;
    uvm_active_passive_enum is_active = UVM_ACTIVE;
    function new(string name = "din_agent_cfg");
      super.new(name);
    endfunction
  endclass

  // The DUT drives data out, so its agent is always passive.
  class dout_agent_cfg extends uvm_object;
    `uvm_object_utils(dout_agent_cfg)
    virtual dout_if vif;
    function new(string name = "dout_agent_cfg");
      super.new(name);
    endfunction
  endclass

  // -----------------------------------------------------------
  // configuration agent
  // -----------------------------------------------------------
  class cfg_driver extends uvm_driver #(cfg_item);
    `uvm_component_utils(cfg_driver)

    virtual cfg_if vif;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual task run_phase(uvm_phase phase);
      vif.drv_cb.we    <= 1'b0;
      vif.drv_cb.addr  <= '0;
      vif.drv_cb.wdata <= '0;
      do @(vif.drv_cb); while (!vif.drv_cb.rst_n);

      // One write per item: drive it, let the DUT sample it at the next
      // edge, release cfg_we, then item_done().
      forever begin
        seq_item_port.get_next_item(req);
        vif.drv_cb.we    <= 1'b1;
        vif.drv_cb.addr  <= req.addr;
        vif.drv_cb.wdata <= req.wdata;
        @(vif.drv_cb);
        vif.drv_cb.we <= 1'b0;
        seq_item_port.item_done();
      end
    endtask
  endclass

  class cfg_monitor extends uvm_monitor;
    `uvm_component_utils(cfg_monitor)

    virtual cfg_if vif;
    uvm_analysis_port #(cfg_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      ap = new("ap", this);
    endfunction

    virtual task run_phase(uvm_phase phase);
      forever begin
        @(vif.mon_cb);
        if (vif.mon_cb.rst_n && vif.mon_cb.we) begin
          cfg_item w = cfg_item::type_id::create("w");
          w.addr  = vif.mon_cb.addr;
          w.wdata = vif.mon_cb.wdata;
          w.stamp = $time;
          ap.write(w);
        end
      end
    endtask
  endclass

  class cfg_agent extends uvm_agent;
    `uvm_component_utils(cfg_agent)

    cfg_agent_cfg cfg;
    cfg_sequencer sqr;
    cfg_driver    drv;
    cfg_monitor   mon;
    uvm_analysis_port #(cfg_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db #(cfg_agent_cfg)::get(this, "", "cfg", cfg) || cfg == null)
        `uvm_fatal("NO_CFG", "cfg_agent_cfg not set for this agent")
      is_active = cfg.is_active;
      ap  = new("ap", this);
      mon = cfg_monitor::type_id::create("mon", this);
      mon.vif = cfg.vif;
      if (get_is_active() == UVM_ACTIVE) begin
        sqr = cfg_sequencer::type_id::create("sqr", this);
        drv = cfg_driver::type_id::create("drv", this);
        drv.vif = cfg.vif;
      end
    endfunction

    virtual function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      mon.ap.connect(ap);
      if (get_is_active() == UVM_ACTIVE)
        drv.seq_item_port.connect(sqr.seq_item_export);
    endfunction
  endclass

  // -----------------------------------------------------------
  // data-in agent
  // -----------------------------------------------------------
  class din_driver extends uvm_driver #(burst_item);
    `uvm_component_utils(din_driver)

    virtual din_if vif;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual task run_phase(uvm_phase phase);
      vif.drv_cb.valid <= 1'b0;
      vif.drv_cb.data  <= '0;
      do @(vif.drv_cb); while (!vif.drv_cb.rst_n);

      // A burst goes out on consecutive edges, one byte per edge.
      forever begin
        seq_item_port.get_next_item(req);
        foreach (req.data[i]) begin
          vif.drv_cb.valid <= 1'b1;
          vif.drv_cb.data  <= req.data[i];
          @(vif.drv_cb);
        end
        vif.drv_cb.valid <= 1'b0;
        seq_item_port.item_done();
      end
    endtask
  endclass

  // Publishes every byte sampled on data in, stamped with its edge.
  class din_monitor extends uvm_monitor;
    `uvm_component_utils(din_monitor)

    virtual din_if vif;
    uvm_analysis_port #(byte_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      ap = new("ap", this);
    endfunction

    virtual task run_phase(uvm_phase phase);
      forever begin
        @(vif.mon_cb);
        if (vif.mon_cb.rst_n && vif.mon_cb.valid) begin
          byte_item b = byte_item::type_id::create("b");
          b.data  = vif.mon_cb.data;
          b.stamp = $time;
          ap.write(b);
        end
      end
    endtask
  endclass

  class din_agent extends uvm_agent;
    `uvm_component_utils(din_agent)

    din_agent_cfg   cfg;
    burst_sequencer sqr;
    din_driver      drv;
    din_monitor     mon;
    uvm_analysis_port #(byte_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db #(din_agent_cfg)::get(this, "", "cfg", cfg) || cfg == null)
        `uvm_fatal("NO_CFG", "din_agent_cfg not set for this agent")
      is_active = cfg.is_active;
      ap  = new("ap", this);
      mon = din_monitor::type_id::create("mon", this);
      mon.vif = cfg.vif;
      if (get_is_active() == UVM_ACTIVE) begin
        sqr = burst_sequencer::type_id::create("sqr", this);
        drv = din_driver::type_id::create("drv", this);
        drv.vif = cfg.vif;
      end
    endfunction

    virtual function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      mon.ap.connect(ap);
      if (get_is_active() == UVM_ACTIVE)
        drv.seq_item_port.connect(sqr.seq_item_export);
    endfunction
  endclass

  // -----------------------------------------------------------
  // data-out agent (passive only)
  // -----------------------------------------------------------
  class dout_monitor extends uvm_monitor;
    `uvm_component_utils(dout_monitor)

    virtual dout_if vif;
    uvm_analysis_port #(byte_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      ap = new("ap", this);
    endfunction

    virtual task run_phase(uvm_phase phase);
      forever begin
        @(vif.mon_cb);
        if (vif.mon_cb.rst_n && vif.mon_cb.valid) begin
          byte_item b = byte_item::type_id::create("b");
          b.data  = vif.mon_cb.data;
          b.stamp = $time;
          ap.write(b);
        end
      end
    endtask
  endclass

  class dout_agent extends uvm_agent;
    `uvm_component_utils(dout_agent)

    dout_agent_cfg cfg;
    dout_monitor   mon;
    uvm_analysis_port #(byte_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db #(dout_agent_cfg)::get(this, "", "cfg", cfg) || cfg == null)
        `uvm_fatal("NO_CFG", "dout_agent_cfg not set for this agent")
      is_active = UVM_PASSIVE;
      ap  = new("ap", this);
      mon = dout_monitor::type_id::create("mon", this);
      mon.vif = cfg.vif;
    endfunction

    virtual function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      mon.ap.connect(ap);
    endfunction
  endclass

  // -----------------------------------------------------------
  // agent sequences
  // -----------------------------------------------------------

  // One configuration write.
  class cfg_write_seq extends uvm_sequence #(cfg_item);
    `uvm_object_utils(cfg_write_seq)

    bit [1:0] addr;
    bit [7:0] wdata;

    function new(string name = "cfg_write_seq");
      super.new(name);
    endfunction

    virtual task body();
      cfg_item w = cfg_item::type_id::create("w");
      start_item(w);
      w.addr  = addr;
      w.wdata = wdata;
      finish_item(w);
    endtask
  endclass

  // The safe programming sequence (R4): disable, write KEY, then write
  // MODE together with EN = 1. It returns after the DUT has sampled the
  // enabling write.
  class cfg_program_seq extends uvm_sequence #(cfg_item);
    `uvm_object_utils(cfg_program_seq)

    bit [7:0] key;
    bit       mode;

    function new(string name = "cfg_program_seq");
      super.new(name);
    endfunction

    task write_reg(bit [1:0] addr, bit [7:0] wdata);
      cfg_item w = cfg_item::type_id::create("w");
      start_item(w);
      w.addr  = addr;
      w.wdata = wdata;
      finish_item(w);
    endtask

    virtual task body();
      write_reg(ADDR_CTRL, 8'h00);                    // EN = 0 unlocks KEY and MODE
      write_reg(ADDR_KEY,  key);
      write_reg(ADDR_CTRL, {6'b0, mode, 1'b1});       // MODE, and EN = 1
    endtask
  endclass

  // count bytes: first, first + STEP, first + 2*STEP, ... (mod 256).
  class burst_seq extends uvm_sequence #(burst_item);
    `uvm_object_utils(burst_seq)

    bit [7:0]    first;
    int unsigned count = BURST_LEN;

    function new(string name = "burst_seq");
      super.new(name);
    endfunction

    virtual task body();
      burst_item b = burst_item::type_id::create("b");
      bit [7:0] value = first;
      start_item(b);
      repeat (count) begin
        b.data.push_back(value);
        value += STEP;
      end
      finish_item(b);
    endtask
  endclass

  // -----------------------------------------------------------
  // environment configuration, virtual sequencer, scoreboard
  // -----------------------------------------------------------
  class mx_env_cfg extends uvm_object;
    `uvm_object_utils(mx_env_cfg)
    cfg_agent_cfg  cfg_agt_cfg;
    din_agent_cfg  din_agt_cfg;
    dout_agent_cfg dout_agt_cfg;
    bit            has_scoreboard = 1;
    function new(string name = "mx_env_cfg");
      super.new(name);
    endfunction
  endclass

  // Holds handles only. It decides nothing about order.
  class mx_vsqr extends uvm_sequencer;
    `uvm_component_utils(mx_vsqr)

    cfg_sequencer   cfg_sqr;
    burst_sequencer din_sqr;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
  endclass

  `uvm_analysis_imp_decl(_cfg)
  `uvm_analysis_imp_decl(_in)
  `uvm_analysis_imp_decl(_out)

  // End-to-end scoreboard. Its view of the DUT's registers comes from the
  // configuration monitor, applied by time stamp: a write sampled at edge
  // t affects bytes sampled after t, never a byte sampled at t (R1), in
  // whatever order the monitors' write() calls arrive within one time slot.
  class mx_scoreboard extends uvm_scoreboard;
    `uvm_component_utils(mx_scoreboard)

    uvm_analysis_imp_cfg #(cfg_item,  mx_scoreboard) cfg_imp;
    uvm_analysis_imp_in  #(byte_item, mx_scoreboard) in_imp;
    uvm_analysis_imp_out #(byte_item, mx_scoreboard) out_imp;

    // The predictor's copy of the DUT's registers, after every committed write.
    bit       en;
    bit       mode;
    bit [7:0] key;

    cfg_item  pending_cfg[$];   // writes not yet applied, oldest first
    bit [7:0] expected[$];      // predicted outputs, oldest first

    int match_cnt;
    int mismatch_cnt;
    int order_cnt;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      cfg_imp = new("cfg_imp", this);
      in_imp  = new("in_imp", this);
      out_imp = new("out_imp", this);
    endfunction

    // R1 and R4, written from the specification.
    function void apply(cfg_item w);
      case (w.addr)
        ADDR_CTRL: begin
          if (!en) mode = w.wdata[1];
          en = w.wdata[0];
        end
        ADDR_KEY: begin
          if (en) begin
            order_cnt++;
            `uvm_error("ORDER", $sformatf("KEY write 0x%02h at %0t while EN = 1: the DUT ignores it (R4)",
                                          w.wdata, w.stamp))
          end else begin
            key = w.wdata;
          end
        end
        default: ;
      endcase
    endfunction

    // Apply every pending write sampled before time t.
    function void commit_before(time t);
      while (pending_cfg.size() > 0 && pending_cfg[0].stamp < t)
        apply(pending_cfg.pop_front());
    endfunction

    function bit [7:0] predict(bit [7:0] din);
      return mode ? din + key : din ^ key;
    endfunction

    virtual function void write_cfg(cfg_item w);
      commit_before(w.stamp);
      pending_cfg.push_back(w);
    endfunction

    virtual function void write_in(byte_item b);
      commit_before(b.stamp);
      if (!en) begin
        order_cnt++;
        `uvm_error("ORDER", $sformatf("byte %s sent while EN = 0: the DUT drops it (R2)",
                                      b.convert2string()))
      end else begin
        expected.push_back(predict(b.data));
      end
    endfunction

    virtual function void write_out(byte_item b);
      bit [7:0] exp_data;
      if (expected.size() == 0) begin
        mismatch_cnt++;
        `uvm_error("SCB_UNEXPECTED", $sformatf("output %s with nothing predicted", b.convert2string()))
        return;
      end
      exp_data = expected.pop_front();
      if (b.data !== exp_data) begin
        mismatch_cnt++;
        `uvm_error("SCB_MISMATCH", $sformatf("expected 0x%02h observed %s", exp_data, b.convert2string()))
      end else begin
        match_cnt++;
      end
    endfunction

    virtual function void check_phase(uvm_phase phase);
      super.check_phase(phase);
      if (expected.size() != 0)
        `uvm_error("SCB_PENDING", $sformatf("%0d predicted outputs never arrived", expected.size()))
      if (match_cnt + mismatch_cnt == 0)
        `uvm_error("SCB_NO_TRAFFIC", "no output was checked: this run proves nothing")
    endfunction

    virtual function void report_phase(uvm_phase phase);
      super.report_phase(phase);
      `uvm_info("SCB_SUMMARY", $sformatf("SCB_SUMMARY matches=%0d mismatches=%0d pending=%0d order=%0d",
                                         match_cnt, mismatch_cnt, expected.size(), order_cnt), UVM_NONE)
    endfunction
  endclass

  class mx_env extends uvm_env;
    `uvm_component_utils(mx_env)

    mx_env_cfg    cfg;
    cfg_agent     cfg_agt;
    din_agent     din_agt;
    dout_agent    dout_agt;
    mx_vsqr       vsqr;
    mx_scoreboard scb;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db #(mx_env_cfg)::get(this, "", "cfg", cfg) || cfg == null)
        `uvm_fatal("NO_CFG", "mx_env_cfg not set for the env")
      if (cfg.cfg_agt_cfg == null || cfg.din_agt_cfg == null || cfg.dout_agt_cfg == null)
        `uvm_fatal("NO_AGT_CFG", "the test must create every agent's configuration object")

      // Each agent gets its own object at its own path, before it is built.
      uvm_config_db #(cfg_agent_cfg)::set(this, "cfg_agt", "cfg", cfg.cfg_agt_cfg);
      uvm_config_db #(din_agent_cfg)::set(this, "din_agt", "cfg", cfg.din_agt_cfg);
      uvm_config_db #(dout_agent_cfg)::set(this, "dout_agt", "cfg", cfg.dout_agt_cfg);

      cfg_agt  = cfg_agent::type_id::create("cfg_agt", this);
      din_agt  = din_agent::type_id::create("din_agt", this);
      dout_agt = dout_agent::type_id::create("dout_agt", this);
      vsqr     = mx_vsqr::type_id::create("vsqr", this);
      if (cfg.has_scoreboard)
        scb = mx_scoreboard::type_id::create("scb", this);
    endfunction

    virtual function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      // A passive agent has no sequencer: its handle stays null.
      vsqr.cfg_sqr = cfg_agt.sqr;
      vsqr.din_sqr = din_agt.sqr;
      if (cfg.has_scoreboard) begin
        cfg_agt.ap.connect(scb.cfg_imp);
        din_agt.ap.connect(scb.in_imp);
        dout_agt.ap.connect(scb.out_imp);
      end
    endfunction
  endclass

  // -----------------------------------------------------------
  // virtual sequences
  // -----------------------------------------------------------
  class mx_reconfig_vseq extends uvm_sequence;
    `uvm_object_utils(mx_reconfig_vseq)
    `uvm_declare_p_sequencer(mx_vsqr)

    function new(string name = "mx_reconfig_vseq");
      super.new(name);
    endfunction

    // A passive agent's handle is null. Starting a child on it, with this
    // as parent, falls back to the virtual sequencer, which no driver
    // pulls from: a silent hang. Fail at once instead.
    task check_handles();
      if (p_sequencer.cfg_sqr == null)
        `uvm_fatal("NO_SQR", "vsqr.cfg_sqr is null: is cfg_agt passive?")
      if (p_sequencer.din_sqr == null)
        `uvm_fatal("NO_SQR", "vsqr.din_sqr is null: is din_agt passive?")
    endtask

    // Returns after the DUT has sampled the write that sets EN = 1.
    task program_dut(bit [7:0] key, bit mode);
      cfg_program_seq s = cfg_program_seq::type_id::create("program");
      s.key  = key;
      s.mode = mode;
      s.start(p_sequencer.cfg_sqr, this);
    endtask

    // Returns after the DUT has sampled the last byte.
    task send_burst(bit [7:0] first, int unsigned count);
      burst_seq s = burst_seq::type_id::create("burst");
      s.first = first;
      s.count = count;
      s.start(p_sequencer.din_sqr, this);
    endtask

    // Configure, send, then reconfigure at a safe point and send again.
    // start() returns when the child's body() returns, so each line waits
    // for the one before it: body() decides the order, not the sequencer.
    virtual task body();
      check_handles();
      program_dut(KEY_1, MODE_XOR);
      send_burst(FIRST_1, BURST_LEN);
      program_dut(KEY_2, MODE_ADD);      // safe point: burst 1 fully sampled
      send_burst(FIRST_2, BURST_LEN);
    endtask
  endclass

  // -----------------------------------------------------------
  // tests
  // -----------------------------------------------------------
  class mx_reconfig_test extends uvm_test;
    `uvm_component_utils(mx_reconfig_test)

    mx_env     env;
    mx_env_cfg env_cfg;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    // Hook for derived tests that change the topology.
    virtual function void configure_env(mx_env_cfg cfg);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      env_cfg = mx_env_cfg::type_id::create("env_cfg");
      env_cfg.cfg_agt_cfg  = cfg_agent_cfg::type_id::create("cfg_agt_cfg");
      env_cfg.din_agt_cfg  = din_agent_cfg::type_id::create("din_agt_cfg");
      env_cfg.dout_agt_cfg = dout_agent_cfg::type_id::create("dout_agt_cfg");
      if (!uvm_config_db #(virtual cfg_if)::get(this, "", "cfg_vif", env_cfg.cfg_agt_cfg.vif))
        `uvm_fatal("NO_VIF", "cfg_vif not set by tb_top")
      if (!uvm_config_db #(virtual din_if)::get(this, "", "din_vif", env_cfg.din_agt_cfg.vif))
        `uvm_fatal("NO_VIF", "din_vif not set by tb_top")
      if (!uvm_config_db #(virtual dout_if)::get(this, "", "dout_vif", env_cfg.dout_agt_cfg.vif))
        `uvm_fatal("NO_VIF", "dout_vif not set by tb_top")
      configure_env(env_cfg);
      uvm_config_db #(mx_env_cfg)::set(this, "env", "cfg", env_cfg);
      env = mx_env::type_id::create("env", this);
      uvm_root::get().set_timeout(100us);     // a hang ends with PH_TIMEOUT
    endfunction

    virtual task run_phase(uvm_phase phase);
      mx_reconfig_vseq vseq = mx_reconfig_vseq::type_id::create("vseq");
      phase.raise_objection(this);
      // The output of the last byte is sampled one edge after the burst
      // returns; 20 ns covers it.
      phase.get_objection().set_drain_time(this, 20ns);
      `uvm_info("TEST", $sformatf("Running %s", vseq.get_type_name()), UVM_LOW)
      vseq.start(env.vsqr);
      phase.drop_objection(this);
    endtask

    // One verdict line from the report server's counts.
    virtual function void report_phase(uvm_phase phase);
      uvm_report_server srv = uvm_report_server::get_server();
      int errors = srv.get_severity_count(UVM_ERROR) + srv.get_severity_count(UVM_FATAL);
      super.report_phase(phase);
      if (errors == 0)
        `uvm_info("RESULT", "TEST PASSED", UVM_NONE)
      else
        `uvm_info("RESULT", $sformatf("TEST FAILED: %0d errors", errors), UVM_NONE)
    endfunction
  endclass

  `include "mx_mutants.svh"
endpackage

// =============================================================
// tb_top
// =============================================================
module tb_top;
  timeunit 1ns;
  timeprecision 1ps;

  import uvm_pkg::*;
  import mx_pkg::*;

  logic clk;
  logic rst_n;

  initial begin
    clk = 1'b0;
    forever #5 clk = ~clk;
  end

  cfg_if  cfg_bus  (clk, rst_n);
  din_if  din_bus  (clk, rst_n);
  dout_if dout_bus (clk, rst_n);

  key_stream dut (
    .clk        (clk),
    .rst_n      (rst_n),
    .cfg_we     (cfg_bus.we),
    .cfg_addr   (cfg_bus.addr),
    .cfg_wdata  (cfg_bus.wdata),
    .din_valid  (din_bus.valid),
    .din        (din_bus.data),
    .dout_valid (dout_bus.valid),
    .dout       (dout_bus.data)
  );

  initial begin
    rst_n = 1'b0;
    repeat (4) @(posedge clk);
    rst_n <= 1'b1;                    // nonblocking: no race with the DUT's flops
  end

  // Cross-interface ordering rules. They read the DUT's EN register
  // (sampled before the edge, like every concurrent assertion), so they
  // hold whichever virtual sequence runs.
  ORDER_SVA: assert property (@(posedge clk) disable iff (!rst_n) din_bus.valid |-> dut.en)
    else `uvm_error("ORDER_SVA", $sformatf("din_valid sampled while EN = 0: byte 0x%02h dropped",
                                           $sampled(din_bus.data)))

  LOCK_SVA: assert property (@(posedge clk) disable iff (!rst_n)
                             (cfg_bus.we && cfg_bus.addr == ADDR_KEY) |-> !dut.en)
    else `uvm_error("LOCK_SVA", "KEY written while EN = 1: the DUT ignores it")

  initial begin
    uvm_config_db #(virtual cfg_if)::set(null, "uvm_test_top", "cfg_vif", cfg_bus);
    uvm_config_db #(virtual din_if)::set(null, "uvm_test_top", "din_vif", din_bus);
    uvm_config_db #(virtual dout_if)::set(null, "uvm_test_top", "dout_vif", dout_bus);
    run_test("mx_reconfig_test");
  end
endmodule
