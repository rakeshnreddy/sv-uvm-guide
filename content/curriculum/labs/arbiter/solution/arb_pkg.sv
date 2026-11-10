// arb_pkg.sv: reference solution for lab arbiter-1 (see README.md).
// Compile order: uvm_pkg, work/arb_if.sv, this file, work/rr_arbiter.sv, work/tb_top.sv.
//
// Expected summary lines (see the README for the full table):
//   arb_regress_test, ARB_BUG=0 -> ARB_SUMMARY cycles=30 grants=24 mismatches=0 protocol=0 starved=0
//                                  ARB_COVERAGE grant-pattern coverage = 100.00%, UVM_ERROR : 0
//   arb_regress_test, ARB_BUG=1 -> ARB_SUMMARY cycles=30 grants=24 mismatches=8 protocol=0 starved=4
//   arb_regress_test, ARB_BUG=2 -> ARB_SUMMARY cycles=30 grants=24 mismatches=10 protocol=0 starved=5
`include "uvm_macros.svh"

package arb_pkg;
  timeunit 1ns; timeprecision 1ps;

  import uvm_pkg::*;

  localparam int ARB_N = 4;          // number of requesters; tb_top passes it to the DUT

  typedef bit [ARB_N-1:0] req_t;

  // ---------------------------------------------------------------------------
  // Stimulus: one request vector, held for a number of cycles.
  // ---------------------------------------------------------------------------
  class arb_item extends uvm_sequence_item;
    `uvm_object_utils(arb_item)

    rand req_t        req;
    rand int unsigned cycles;

    constraint c_cycles { cycles inside {[1:4]}; }

    function new(string name = "arb_item");
      super.new(name);
    endfunction

    virtual function string convert2string();
      return $sformatf("req=%b cycles=%0d", req, cycles);
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Observation: one arbitration decision, sampled at one rising edge.
  // ---------------------------------------------------------------------------
  class arb_txn extends uvm_sequence_item;
    `uvm_object_utils(arb_txn)

    req_t req;
    req_t gnt;

    function new(string name = "arb_txn");
      super.new(name);
    endfunction

    virtual function string convert2string();
      return $sformatf("req=%b gnt=%b", req, gnt);
    endfunction
  endclass

  typedef uvm_sequencer #(arb_item) arb_sequencer;

  // ---------------------------------------------------------------------------
  // Sequences
  // ---------------------------------------------------------------------------
  class arb_base_seq extends uvm_sequence #(arb_item);
    `uvm_object_utils(arb_base_seq)

    function new(string name = "arb_base_seq");
      super.new(name);
    endfunction

    // Hold the request vector r for c cycles.
    protected task send(req_t r, int unsigned c);
      arb_item it = arb_item::type_id::create("it");
      start_item(it);
      it.req    = r;
      it.cycles = c;
      finish_item(it);
    endtask
  endclass

  // One requester at a time: every grant is uncontended.
  class arb_smoke_seq extends arb_base_seq;
    `uvm_object_utils(arb_smoke_seq)

    function new(string name = "arb_smoke_seq");
      super.new(name);
    endfunction

    virtual task body();
      for (int i = 0; i < ARB_N; i++) send(req_t'(1) << i, 2);
      send('0, 2);
    endtask
  endclass

  // Contention: everyone, then two disjoint pairs.
  class arb_load_seq extends arb_base_seq;
    `uvm_object_utils(arb_load_seq)

    function new(string name = "arb_load_seq");
      super.new(name);
    endfunction

    virtual task body();
      send('1, 2 * ARB_N);           // full load: two complete rotations
      send('0, 1);
      send(req_t'(4'b0101), 4);      // requesters 0 and 2 alternate
      send(req_t'(4'b1010), 4);      // requesters 1 and 3 alternate
      send('0, 2);
    endtask
  endclass

  // Random request vectors (stretch: arb_random_test).
  class arb_random_seq extends arb_base_seq;
    `uvm_object_utils(arb_random_seq)

    int unsigned n_items = 60;

    function new(string name = "arb_random_seq");
      super.new(name);
    endfunction

    virtual task body();
      repeat (n_items) begin
        arb_item it = arb_item::type_id::create("it");
        start_item(it);
        if (!it.randomize()) `uvm_fatal("ARB_RAND", "randomize() failed: the stimulus would be meaningless")
        finish_item(it);
      end
      send('0, 2);
    endtask
  endclass

  // ---------------------------------------------------------------------------
  // Driver: drives req through drv_cb, one item at a time.
  // ---------------------------------------------------------------------------
  class arb_driver extends uvm_driver #(arb_item);
    `uvm_component_utils(arb_driver)

    virtual arb_if #(ARB_N) vif;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(virtual arb_if #(ARB_N))::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "no virtual interface set for the driver")
    endfunction

    virtual task run_phase(uvm_phase phase);
      // Wait for an edge at which reset was already released.
      do @(vif.drv_cb); while (vif.drv_cb.rst_n !== 1'b1);
      forever begin
        seq_item_port.get_next_item(req);
        repeat (req.cycles) begin
          vif.drv_cb.req <= req.req;   // lands just after this edge
          @(vif.drv_cb);
        end
        seq_item_port.item_done();
      end
    endtask
  endclass

  // ---------------------------------------------------------------------------
  // Monitor: one new arb_txn per rising edge after reset. It never drives.
  // ---------------------------------------------------------------------------
  class arb_monitor extends uvm_monitor;
    `uvm_component_utils(arb_monitor)

    virtual arb_if #(ARB_N) vif;
    uvm_analysis_port #(arb_txn) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      ap = new("ap", this);
      if (!uvm_config_db#(virtual arb_if #(ARB_N))::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "no virtual interface set for the monitor")
    endfunction

    virtual task run_phase(uvm_phase phase);
      forever begin
        @(vif.mon_cb);
        if (vif.mon_cb.rst_n === 1'b1) begin
          arb_txn t = arb_txn::type_id::create("t");   // a new object every cycle
          t.req = vif.mon_cb.req;
          t.gnt = vif.mon_cb.gnt;
          ap.write(t);
        end
      end
    endtask
  endclass

  // ---------------------------------------------------------------------------
  // Agent: the monitor always; the sequencer and driver only when active.
  // ---------------------------------------------------------------------------
  class arb_agent extends uvm_agent;
    `uvm_component_utils(arb_agent)

    arb_sequencer sqr;
    arb_driver    drv;
    arb_monitor   mon;
    uvm_analysis_port #(arb_txn) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      ap  = new("ap", this);
      mon = arb_monitor::type_id::create("mon", this);
      if (get_is_active() == UVM_ACTIVE) begin
        sqr = arb_sequencer::type_id::create("sqr", this);
        drv = arb_driver::type_id::create("drv", this);
      end
    endfunction

    virtual function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      mon.ap.connect(ap);
      if (get_is_active() == UVM_ACTIVE) drv.seq_item_port.connect(sqr.seq_item_export);
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Scoreboard: a grant predictor (R1 to R4) and a fairness check (the bound).
  // Both are written from the specification, not from the RTL.
  // ---------------------------------------------------------------------------
  class arb_scoreboard extends uvm_scoreboard;
    `uvm_component_utils(arb_scoreboard)

    uvm_analysis_imp #(arb_txn, arb_scoreboard) analysis_export;

    bit          check_order = 1;    // +ARB_FAIRNESS_ONLY turns the predictor's compare off
    int unsigned last;               // the model's last winner (R4, R5)
    int unsigned wait_cnt[ARB_N];    // cycles each requester has waited
    bit          starving[ARB_N];    // already reported in this wait
    int unsigned n_cycles, n_grants, n_mismatch, n_protocol, n_starved;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      analysis_export = new("analysis_export", this);
      last = ARB_N - 1;              // R5: the monitor publishes nothing during reset
      if ($test$plusargs("ARB_FAIRNESS_ONLY")) check_order = 0;
    endfunction

    // R2, R3: the first requester after the last winner, wrapping.
    function req_t predict(req_t r);
      for (int unsigned k = 1; k <= ARB_N; k++) begin
        int unsigned idx = (last + k) % ARB_N;
        if (r[idx]) return req_t'(1) << idx;
      end
      return '0;
    endfunction

    virtual function void write(arb_txn t);
      req_t exp_gnt = predict(t.req);
      n_cycles++;
      if (t.gnt != 0) n_grants++;

      // R1: zero or one-hot, and only to a requester.
      if (!$onehot0(t.gnt) || (t.gnt & ~t.req) != 0) begin
        n_protocol++;
        `uvm_error("ARB_PROTOCOL", $sformatf("%s: a grant must be zero or one-hot, and only to a requester",
                                            t.convert2string()))
      end

      // R2, R3: the exact winner.
      if (check_order && t.gnt !== exp_gnt) begin
        n_mismatch++;
        `uvm_error("ARB_MISMATCH", $sformatf("%s, expected gnt=%b", t.convert2string(), exp_gnt))
      end

      // R4: the model follows its own prediction, never the DUT.
      for (int i = 0; i < ARB_N; i++) if (exp_gnt[i]) last = i;

      // The fairness bound, from the DUT's actual grants.
      for (int i = 0; i < ARB_N; i++) begin
        if (t.gnt[i] || !t.req[i]) begin
          wait_cnt[i] = 0;
          starving[i] = 0;
        end else begin
          wait_cnt[i]++;
          if (wait_cnt[i] >= ARB_N && !starving[i]) begin
            starving[i] = 1;
            n_starved++;
            `uvm_error("ARB_STARVED", $sformatf("requester %0d has waited %0d cycles; the bound is %0d",
                                               i, wait_cnt[i], ARB_N - 1))
          end
        end
      end
    endfunction

    virtual function void check_phase(uvm_phase phase);
      super.check_phase(phase);
      if (n_grants == 0)
        `uvm_error("ARB_NO_TRAFFIC", $sformatf("%0d cycles observed and no grant: nothing was checked", n_cycles))
    endfunction

    virtual function void report_phase(uvm_phase phase);
      super.report_phase(phase);
      `uvm_info("ARB_SUMMARY", $sformatf("ARB_SUMMARY cycles=%0d grants=%0d mismatches=%0d protocol=%0d starved=%0d",
                                        n_cycles, n_grants, n_mismatch, n_protocol, n_starved), UVM_NONE)
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Coverage of grant patterns: who won, under how much contention, after how long.
  // ---------------------------------------------------------------------------
  class arb_coverage extends uvm_subscriber #(arb_txn);
    `uvm_component_utils(arb_coverage)

    int unsigned wait_cnt[ARB_N];
    int unsigned g_idx;              // the winner
    int unsigned n_req;              // how many requested in that cycle
    int unsigned g_wait;             // how long the winner had waited

    covergroup arb_cg;
      option.per_instance = 1;
      cp_gnt:  coverpoint g_idx  { bins idx[] = {[0:ARB_N-1]}; }
      cp_load: coverpoint n_req  { bins one = {1}; bins some = {[2:ARB_N-1]}; bins all = {ARB_N}; }
      cp_wait: coverpoint g_wait { bins w[] = {[0:ARB_N-1]}; }
      x_gnt_load: cross cp_gnt, cp_load;
    endgroup

    function new(string name, uvm_component parent);
      super.new(name, parent);
      arb_cg = new();
    endfunction

    virtual function void write(arb_txn t);
      if ($onehot(t.gnt)) begin
        for (int i = 0; i < ARB_N; i++) if (t.gnt[i]) g_idx = i;
        n_req  = $countones(t.req);
        g_wait = wait_cnt[g_idx];
        arb_cg.sample();
      end
      for (int i = 0; i < ARB_N; i++) wait_cnt[i] = (t.req[i] && !t.gnt[i]) ? wait_cnt[i] + 1 : 0;
    endfunction

    virtual function void report_phase(uvm_phase phase);
      super.report_phase(phase);
      `uvm_info("ARB_COVERAGE", $sformatf("grant-pattern coverage = %0.2f%%", arb_cg.get_inst_coverage()), UVM_NONE)
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Environment
  // ---------------------------------------------------------------------------
  class arb_env extends uvm_env;
    `uvm_component_utils(arb_env)

    arb_agent      agent;
    arb_scoreboard scb;
    arb_coverage   cov;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      agent = arb_agent::type_id::create("agent", this);
      scb   = arb_scoreboard::type_id::create("scb", this);
      cov   = arb_coverage::type_id::create("cov", this);
    endfunction

    virtual function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      agent.ap.connect(scb.analysis_export);
      agent.ap.connect(cov.analysis_export);
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Tests
  // ---------------------------------------------------------------------------
  class arb_base_test extends uvm_test;
    `uvm_component_utils(arb_base_test)

    arb_env env;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      env = arb_env::type_id::create("env", this);
      uvm_root::get().set_timeout(100us, 1);   // a hang ends with PH_TIMEOUT
    endfunction

    // Each test runs its sequences here.
    virtual task run_seqs();
    endtask

    virtual task run_phase(uvm_phase phase);
      phase.raise_objection(this);
      run_seqs();
      // Half a clock period: the run ends between two edges, after the last sample.
      phase.get_objection().set_drain_time(this, 5ns);
      phase.drop_objection(this);
    endtask
  endclass

  class arb_smoke_test extends arb_base_test;
    `uvm_component_utils(arb_smoke_test)
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    virtual task run_seqs();
      arb_smoke_seq s = arb_smoke_seq::type_id::create("s");
      s.start(env.agent.sqr);
    endtask
  endclass

  class arb_load_test extends arb_base_test;
    `uvm_component_utils(arb_load_test)
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    virtual task run_seqs();
      arb_load_seq s = arb_load_seq::type_id::create("s");
      s.start(env.agent.sqr);
    endtask
  endclass

  class arb_regress_test extends arb_base_test;
    `uvm_component_utils(arb_regress_test)
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    virtual task run_seqs();
      arb_smoke_seq s = arb_smoke_seq::type_id::create("s");
      arb_load_seq  l = arb_load_seq::type_id::create("l");
      s.start(env.agent.sqr);
      l.start(env.agent.sqr);
    endtask
  endclass

  class arb_random_test extends arb_base_test;
    `uvm_component_utils(arb_random_test)
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    virtual task run_seqs();
      arb_random_seq r = arb_random_seq::type_id::create("r");
      r.start(env.agent.sqr);
    endtask
  endclass

endpackage
