// testbench.sv (reference, read-only): the AXI read environment for the
// axi-scoreboard-lab. It is the B-AXI-6 Make It Work environment without the
// coverage and performance subscribers. Your files axi_monitor.sv and
// axi_scoreboard.sv are included inside axi_rd_pkg below; compile with
// +define+AXI_LAB_SOLUTION to use solution.sv instead.
// +MUTANT=SAME_ID_SWAP|DROP_RLAST|EXTRA_BEAT|WRONG_RID breaks the responder once.
`timescale 1ns/1ps
`include "uvm_macros.svh"

interface axi_rd_if (input logic ACLK, input logic ARESETn);
  // Handshake signals start LOW: VALIDs must be LOW during reset (A3.1.2).
  logic        ARVALID = 1'b0, ARREADY = 1'b0;
  logic        RVALID  = 1'b0, RREADY  = 1'b0;
  logic [3:0]  ARID, RID;
  logic [31:0] ARADDR, RDATA;
  logic [7:0]  ARLEN;
  logic [2:0]  ARSIZE;
  logic [1:0]  ARBURST, RRESP;
  logic        RLAST;

  // Monitor view: every signal sampled just before the edge (1800-2023 14.13).
  clocking mon_cb @(posedge ACLK);
    default input #1step;
    input ARESETn, ARVALID, ARREADY, ARID, ARADDR, ARLEN, ARSIZE, ARBURST,
          RVALID, RREADY, RID, RDATA, RRESP, RLAST;
  endclocking

  // Master view: drives AR and RREADY, samples what it reacts to.
  clocking mst_cb @(posedge ACLK);
    default input #1step output #1;
    input  ARESETn, ARREADY, RVALID, RLAST;
    output ARVALID, ARID, ARADDR, ARLEN, ARSIZE, ARBURST, RREADY;
  endclocking

  // Responder (slave) view: drives ARREADY and R, samples AR and RREADY.
  clocking slv_cb @(posedge ACLK);
    default input #1step output #1;
    input  ARESETn, ARVALID, ARID, ARADDR, ARLEN, RREADY;
    output ARREADY, RVALID, RID, RDATA, RRESP, RLAST;
  endclocking
endinterface

// Pin-level read checks, bound into every axi_rd_if instance. The bind
// target is an interface, so the checker is an interface too (1800-2023 23.11).
// [Protocol] = a rule of IHI0022E. [Policy] = a rule this testbench adds.
interface axi_rd_checker #(int unsigned DATA_BYTES = 4) (
  input logic        ACLK, ARESETn,
  input logic        ARVALID, ARREADY, RVALID, RREADY, RLAST,
  input logic [3:0]  ARID, RID,
  input logic [31:0] ARADDR,
  input logic [7:0]  ARLEN,
  input logic [2:0]  ARSIZE,
  input logic [1:0]  ARBURST, RRESP
);
  import uvm_pkg::*;
  int unsigned ar_done, rlast_done;   // handshakes seen so far

  always_ff @(posedge ACLK or negedge ARESETn)
    if (!ARESETn) begin
      ar_done    <= 0;
      rlast_done <= 0;
    end else begin
      if (ARVALID && ARREADY)        ar_done    <= ar_done + 1;
      if (RVALID && RREADY && RLAST) rlast_done <= rlast_done + 1;
    end

  default clocking @(posedge ACLK); endclocking
  default disable iff (!ARESETn);

  // [Protocol A3.3.1] RVALID only after the AR handshake of its read.
  a_r_after_ar: assert property (RVALID |-> ar_done > rlast_done)
    else `uvm_error("AXI_CHK", "RVALID with no read outstanding (A3.3.1)")
  // [Protocol A3.4.1] A WRAP burst has 2, 4, 8 or 16 beats ...
  a_wrap_len: assert property (ARVALID && ARBURST == 2'b10
                               |-> ARLEN inside {1, 3, 7, 15})
    else `uvm_error("AXI_CHK", "WRAP length not 2, 4, 8 or 16 (A3.4.1)")
  // ... and a start address aligned to the transfer size.
  a_wrap_align: assert property (ARVALID && ARBURST == 2'b10
                                 |-> (ARADDR & ((1 << ARSIZE) - 1)) == 0)
    else `uvm_error("AXI_CHK", "unaligned WRAP start (A3.4.1)")
  // [Protocol A3.4.1] A transfer is never wider than the data bus.
  a_size_fits: assert property (ARVALID |-> (1 << ARSIZE) <= DATA_BYTES)
    else `uvm_error("AXI_CHK", "ARSIZE wider than the bus (A3.4.1)")
  // [Protocol Table A3-3] AxBURST 2'b11 is reserved.
  a_burst_enc: assert property (ARVALID |-> ARBURST != 2'b11)
    else `uvm_error("AXI_CHK", "reserved ARBURST encoding (Table A3-3)")
  // [Policy] Handshake signals are never X after reset; IHI0022E has no X
  // rule, but an X here means an undriven or uninitialised port.
  a_hs_known: assert property (!$isunknown({ARVALID, ARREADY, RVALID, RREADY}))
    else `uvm_error("AXI_CHK", "X on a VALID or READY")
  // [Policy] While VALID is HIGH, the control it qualifies is known.
  a_ar_known: assert property (ARVALID
                               |-> !$isunknown({ARID, ARADDR, ARLEN, ARSIZE, ARBURST}))
    else `uvm_error("AXI_CHK", "X on AR control while ARVALID")
  a_r_known: assert property (RVALID |-> !$isunknown({RID, RRESP, RLAST}))
    else `uvm_error("AXI_CHK", "X on RID, RRESP or RLAST while RVALID")
endinterface

bind axi_rd_if axi_rd_checker #(.DATA_BYTES(4)) u_chk (.*);

package axi_rd_pkg;
  import uvm_pkg::*;
  `include "uvm_macros.svh"

  localparam bit [1:0] RESP_OKAY = 2'b00, RESP_SLVERR = 2'b10;

  // Every knob a test may change, in one object (A-UVM-7 pattern).
  class axi_rd_cfg extends uvm_object;
    `uvm_object_utils(axi_rd_cfg)
    int unsigned n_reads         = 40;
    int unsigned max_outstanding = 8;    // master: reads in flight at once
    int unsigned rready_pct      = 60;   // master: RREADY HIGH this often
    int unsigned ar_ready_pct    = 70;   // responder: ARREADY HIGH this often
    int unsigned r_gap_pct       = 25;   // responder: idle R cycles
    bit          interleave      = 1;    // responder: RID may change mid-burst
    bit [31:0]   err_lo          = 32'h0000_3000;  // SLVERR window
    bit [31:0]   err_hi          = 32'h0000_30FF;
    string       mutant          = "NONE";
    function new(string name = "axi_rd_cfg");
      super.new(name);
    endfunction
  endclass

  // The reference memory. A word's value is a fixed function of its address,
  // so the responder and the predictor agree without sharing state. Beats
  // inside [err_lo, err_hi] answer SLVERR, a legal response (A3.4.4).
  class axi_mem_model;
    static function bit [31:0] data_at(bit [31:0] addr);
      return addr ^ 32'hC0DE_0000;
    endfunction
    static function bit [1:0] resp_at(axi_rd_cfg cfg, bit [31:0] addr);
      return (addr >= cfg.err_lo && addr <= cfg.err_hi) ? RESP_SLVERR : RESP_OKAY;
    endfunction
  endclass

  class axi_rd_item extends uvm_sequence_item;
    `uvm_object_utils(axi_rd_item)
    rand bit [3:0]  id;
    rand bit [31:0] addr;
    rand bit [7:0]  len;                 // ARLEN: the burst has len + 1 beats
    bit [31:0]      data[$];             // RDATA, one entry per beat
    bit [1:0]       resp[$];             // RRESP, one entry per beat (A3.4.4)

    // INCR, 4-byte beats (ARSIZE = 2) on a 32-bit bus, so every lane is
    // active on every beat. Few IDs make same-ID reuse common.
    constraint c_shape {
      id inside {[0:3]};
      len inside {[0:7]};
      addr[1:0] == 2'b00;
      addr dist {[32'h0000_0000:32'h0000_2FFF] :/ 85,
                 [32'h0000_3000:32'h0000_30FF] :/ 15};
      (addr % 4096) + (len + 1) * 4 <= 4096;     // never cross 4KB (A3.4.1)
    }

    function new(string name = "axi_rd_item");
      super.new(name);
    endfunction

    function string convert2string();
      return $sformatf("id=%0d addr=0x%08h len=%0d beats=%0d",
                       id, addr, len, data.size());
    endfunction

    // "" when act matches this expected read, else the first difference.
    function string diff(axi_rd_item act);
      if (act.id != id || act.addr != addr || act.len != len)
        return $sformatf("header: exp %s, act %s",
                         convert2string(), act.convert2string());
      if (act.data.size() != data.size())
        return $sformatf("beat count: exp %0d, act %0d",
                         data.size(), act.data.size());
      foreach (data[i]) begin
        if (act.data[i] != data[i])
          return $sformatf("beat %0d data: exp 0x%08h, act 0x%08h",
                           i, data[i], act.data[i]);
        if (act.resp[i] != resp[i])
          return $sformatf("beat %0d resp: exp %0d, act %0d",
                           i, resp[i], act.resp[i]);
      end
      return "";
    endfunction
  endclass

  class axi_rd_rand_seq extends uvm_sequence #(axi_rd_item);
    `uvm_object_utils(axi_rd_rand_seq)
    int unsigned n_reads = 40;
    function new(string name = "axi_rd_rand_seq");
      super.new(name);
    endfunction
    task body();
      repeat (n_reads) begin
        req = axi_rd_item::type_id::create("req");
        start_item(req);
        if (!req.randomize()) `uvm_fatal("RAND", "axi_rd_item randomize failed")
        finish_item(req);
      end
    endtask
  endclass

  // Master: issues ARs up to an outstanding window, drives a random RREADY.
  class axi_rd_master_drv extends uvm_driver #(axi_rd_item);
    `uvm_component_utils(axi_rd_master_drv)
    virtual axi_rd_if vif;
    axi_rd_cfg        cfg;
    int unsigned      outstanding;      // AR handshakes not yet ended by RLAST

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(virtual axi_rd_if)::get(this, "", "vif", vif))
        `uvm_fatal("NO_VIF", "virtual interface not set")
      if (!uvm_config_db#(axi_rd_cfg)::get(this, "", "cfg", cfg))
        `uvm_fatal("NO_CFG", "axi_rd_cfg not set")
    endfunction

    task run_phase(uvm_phase phase);
      bit         ar_vld, r_rdy;        // what this driver drives this cycle
      axi_rd_item it;
      do @(vif.mst_cb); while (!vif.mst_cb.ARESETn);   // start after reset
      forever begin
        // Handshakes at this edge: our own outputs plus the sampled inputs.
        if (ar_vld && vif.mst_cb.ARREADY) begin
          ar_vld = 0;
          outstanding++;
          seq_item_port.item_done();       // the AR has been accepted
        end
        if (r_rdy && vif.mst_cb.RVALID && vif.mst_cb.RLAST && outstanding > 0)
          outstanding--;
        // ARVALID never waits for ARREADY (A3.3.1). It waits only for room in
        // the outstanding window, which is the master's own choice.
        if (!ar_vld && outstanding < cfg.max_outstanding) begin
          seq_item_port.try_next_item(it);
          if (it != null) begin
            vif.mst_cb.ARID    <= it.id;
            vif.mst_cb.ARADDR  <= it.addr;
            vif.mst_cb.ARLEN   <= it.len;
            vif.mst_cb.ARSIZE  <= 3'd2;     // 4-byte beats
            vif.mst_cb.ARBURST <= 2'b01;    // INCR
            ar_vld = 1;
          end
        end
        vif.mst_cb.ARVALID <= ar_vld;
        // A random RREADY is legal (A3.3.1) and makes the slave hold R.
        r_rdy = ($urandom_range(99) < cfg.rready_pct);
        vif.mst_cb.RREADY <= r_rdy;
        @(vif.mst_cb);
      end
    endtask
  endclass

  // Responder: a reordering, interleaving slave with random ARREADY, random
  // R gaps and an SLVERR window. It stands in for the slave DUT.
  class axi_rd_responder extends uvm_component;
    `uvm_component_utils(axi_rd_responder)

    typedef struct {
      bit [3:0]    id;
      bit [31:0]   addr;
      int unsigned beats;               // ARLEN + 1
      int unsigned sent;                // beats already transferred
    } rd_req_t;

    virtual axi_rd_if vif;
    axi_rd_cfg        cfg;
    rd_req_t          pend[int unsigned][$];   // per ARID, arrival order
    bit               mutated;                 // each mutant fires once

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(virtual axi_rd_if)::get(this, "", "vif", vif))
        `uvm_fatal("NO_VIF", "virtual interface not set")
      if (!uvm_config_db#(axi_rd_cfg)::get(this, "", "cfg", cfg))
        `uvm_fatal("NO_CFG", "axi_rd_cfg not set")
    endfunction

    task run_phase(uvm_phase phase);
      bit          ar_rdy, r_vld;       // what this responder drives
      int unsigned cur;                 // ARID of the beat on R
      do @(vif.slv_cb); while (!vif.slv_cb.ARESETn);
      forever begin
        if (ar_rdy && vif.slv_cb.ARVALID) accept_ar();
        if (r_vld && vif.slv_cb.RREADY) begin   // the beat on R was taken
          r_vld = 0;
          beat_done(cur);
        end
        // Start a beat only when none is waiting: RVALID and the payload
        // hold until the handshake (A3.2.1). Random gaps idle the channel.
        if (!r_vld && $urandom_range(99) >= cfg.r_gap_pct) next_beat(cur, r_vld);
        vif.slv_cb.RVALID <= r_vld;
        // ARREADY is random; it may fall before ARVALID rises (A3.2.1).
        ar_rdy = ($urandom_range(99) < cfg.ar_ready_pct);
        vif.slv_cb.ARREADY <= ar_rdy;
        @(vif.slv_cb);
      end
    endtask

    function void accept_ar();
      rd_req_t r;
      r.id    = vif.slv_cb.ARID;
      r.addr  = vif.slv_cb.ARADDR;
      r.beats = vif.slv_cb.ARLEN + 1;
      r.sent  = 0;
      pend[r.id].push_back(r);          // behind older reads with this ID
    endfunction

    // Only the oldest read of each ID may send (same-ID order, A5.3.1). Any
    // ID may go next, so reads overtake and, with interleave set, the RID
    // can change between the beats of one burst (A5.3.1).
    task next_beat(inout int unsigned cur, output bit vld);
      int unsigned ids[$];
      rd_req_t     h;
      bit [31:0]   a;
      bit          bad_rid;
      vld = 0;
      if (!cfg.interleave && pend.exists(cur) && pend[cur].size() > 0 &&
          pend[cur][0].sent > 0)
        ids.push_back(cur);             // finish the burst under way
      else
        foreach (pend[i]) if (pend[i].size() > 0) ids.push_back(i);
      if (ids.size() == 0) return;
      cur = ids[$urandom_range(ids.size() - 1)];
      inject_swap(cur);
      h       = pend[cur][0];
      a       = h.addr + 4 * h.sent;    // INCR, 4-byte beats
      bad_rid = inject_wrong_rid(h);
      vif.slv_cb.RID   <= bad_rid ? cur ^ 8 : cur;
      vif.slv_cb.RDATA <= axi_mem_model::data_at(a);
      vif.slv_cb.RRESP <= axi_mem_model::resp_at(cfg, a);   // per beat
      vif.slv_cb.RLAST <= last_flag(h);
      vld = 1;
    endtask

    function void beat_done(int unsigned id);
      pend[id][0].sent++;
      if (pend[id][0].sent < pend[id][0].beats) return;
      void'(pend[id].pop_front());
      inject_extra_beat(id);
    endfunction

    // ---- Mutants: each breaks one rule once, to prove the checks see it.
    function void inject_swap(int unsigned id);           // SAME_ID_SWAP
      rd_req_t t;
      if (cfg.mutant != "SAME_ID_SWAP" || mutated || pend[id].size() < 2) return;
      if (pend[id][0].sent != 0 || pend[id][1].sent != 0) return;
      t           = pend[id][0];
      pend[id][0] = pend[id][1];        // the younger read answers first
      pend[id][1] = t;
      mutated     = 1;
    endfunction

    function bit inject_wrong_rid(rd_req_t h);            // WRONG_RID
      if (cfg.mutant != "WRONG_RID" || mutated || h.beats != 1) return 0;
      mutated = 1;                      // IDs 8..15 are never issued
      return 1;
    endfunction

    function bit last_flag(rd_req_t h);                   // DROP_RLAST
      bit last = (h.sent + 1 == h.beats);
      if (last && h.beats > 1 && cfg.mutant == "DROP_RLAST" && !mutated) begin
        mutated = 1;
        return 0;                       // the final beat goes out without RLAST
      end
      return last;
    endfunction

    function void inject_extra_beat(int unsigned id);     // EXTRA_BEAT
      rd_req_t ghost;
      if (cfg.mutant != "EXTRA_BEAT" || mutated || pend[id].size() != 0) return;
      ghost.id    = id;
      ghost.addr  = 32'h0;
      ghost.beats = 1;                  // one more beat, with RLAST, nobody asked for
      ghost.sent  = 0;
      pend[id].push_back(ghost);
      mutated = 1;
    endfunction
  endclass


  // ---- Your code: the monitor and the scoreboard.
`ifdef AXI_LAB_SOLUTION
  `include "solution.sv"
`else
  `include "axi_monitor.sv"
  `include "axi_scoreboard.sv"
`endif

  // Predictor: at each AR, computes every expected beat and response.
  class axi_rd_predictor extends uvm_subscriber #(axi_rd_item);
    `uvm_component_utils(axi_rd_predictor)
    uvm_analysis_port #(axi_rd_item) exp_ap;
    axi_rd_cfg cfg;

    function new(string name, uvm_component parent);
      super.new(name, parent);
      exp_ap = new("exp_ap", this);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(axi_rd_cfg)::get(this, "", "cfg", cfg))
        `uvm_fatal("NO_CFG", "axi_rd_cfg not set")
    endfunction

    function void write(axi_rd_item t);
      axi_rd_item e = axi_rd_item::type_id::create("e");
      e.id   = t.id;
      e.addr = t.addr;
      e.len  = t.len;
      for (int unsigned k = 0; k <= t.len; k++) begin
        e.data.push_back(axi_mem_model::data_at(t.addr + 4 * k));
        e.resp.push_back(axi_mem_model::resp_at(cfg, t.addr + 4 * k));
      end
      exp_ap.write(e);
    endfunction
  endclass


  class axi_rd_env extends uvm_env;
    `uvm_component_utils(axi_rd_env)
    uvm_sequencer #(axi_rd_item) sqr;
    axi_rd_master_drv            drv;
    axi_rd_responder             rsp;
    axi_rd_monitor               mon;
    axi_rd_predictor             prd;
    axi_rd_scoreboard            scb;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      sqr  = uvm_sequencer#(axi_rd_item)::type_id::create("sqr", this);
      drv  = axi_rd_master_drv::type_id::create("drv", this);
      rsp  = axi_rd_responder::type_id::create("rsp", this);
      mon  = axi_rd_monitor::type_id::create("mon", this);
      prd  = axi_rd_predictor::type_id::create("prd", this);
      scb  = axi_rd_scoreboard::type_id::create("scb", this);
    endfunction

    function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      drv.seq_item_port.connect(sqr.seq_item_export);
      mon.req_ap.connect(prd.analysis_export);   // AR -> prediction
      prd.exp_ap.connect(scb.exp_imp);
      mon.ap.connect(scb.act_imp);               // completed read -> compare
    endfunction
  endclass


  class axi_rd_test extends uvm_test;
    `uvm_component_utils(axi_rd_test)
    localparam int unsigned EOT_TIMEOUT = 2000;   // cycles
    axi_rd_env        env;
    axi_rd_cfg        cfg;
    virtual axi_rd_if vif;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      cfg = axi_rd_cfg::type_id::create("cfg");
      void'($value$plusargs("MUTANT=%s", cfg.mutant));  // 1800-2023 21.6
      uvm_config_db#(axi_rd_cfg)::set(this, "env.*", "cfg", cfg);
      if (!uvm_config_db#(virtual axi_rd_if)::get(this, "", "vif", vif))
        `uvm_fatal("NO_VIF", "virtual interface not set")
      env = axi_rd_env::type_id::create("env", this);
    endfunction

    task run_phase(uvm_phase phase);
      axi_rd_rand_seq seq = axi_rd_rand_seq::type_id::create("seq");
      phase.raise_objection(this);
      `uvm_info("CFG", $sformatf("mutant=%s reads=%0d", cfg.mutant, cfg.n_reads),
                UVM_NONE)
      seq.n_reads = cfg.n_reads;
      seq.start(env.sqr);              // returns when every AR is accepted
      @(vif.mon_cb);                   // let the last AR reach the scoreboard
      fork                             // wait for the data, but never forever
        wait (env.scb.n_pending == 0);
        repeat (EOT_TIMEOUT) @(vif.mon_cb);
      join_any
      disable fork;
      if (env.scb.n_pending != 0)
        `uvm_warning("EOT", $sformatf("%0d read(s) still open after %0d cycles",
                     env.scb.n_pending, EOT_TIMEOUT))
      phase.drop_objection(this);
    endtask

    // A run that compared nothing, or fewer reads than it issued, is no pass.
    function void check_phase(uvm_phase phase);
      super.check_phase(phase);
      if (env.scb.n_match + env.scb.n_mismatch != cfg.n_reads)
        `uvm_error("EOT", $sformatf("%0d of %0d reads compared",
                   env.scb.n_match + env.scb.n_mismatch, cfg.n_reads))
    endfunction
  endclass
endpackage

module tb_top;
  import uvm_pkg::*;
  import axi_rd_pkg::*;

  logic ACLK    = 1'b0;
  logic ARESETn = 1'b0;
  always #5 ACLK = ~ACLK;

  axi_rd_if vif (.ACLK(ACLK), .ARESETn(ARESETn));

  // Reset for four edges; release it at an edge (A3.1.2: deassertion is
  // synchronous with ACLK).
  initial begin
    repeat (4) @(posedge ACLK);
    ARESETn <= 1'b1;
  end

  initial begin
    // "uvm_test_top*" matches the test and every component below it.
    uvm_config_db#(virtual axi_rd_if)::set(null, "uvm_test_top*", "vif", vif);
    run_test("axi_rd_test");
  end
endmodule
