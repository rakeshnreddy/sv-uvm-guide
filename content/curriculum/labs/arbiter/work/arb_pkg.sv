// arb_pkg.sv: the starter UVM environment for lab arbiter-1 (see README.md).
// Compile order: uvm_pkg, work/arb_if.sv, this file, work/rr_arbiter.sv, work/tb_top.sv.
//
// It compiles and runs as it is, and checks nothing. Each "TODO step N" marks
// code you write in step N. The items, the sequencer type, the base sequence,
// the env's build and the tests are complete.
`include "uvm_macros.svh"

package arb_pkg;
  timeunit 1ns; timeprecision 1ps;

  import uvm_pkg::*;

  localparam int ARB_N = 4;          // number of requesters; tb_top passes it to the DUT

  typedef bit [ARB_N-1:0] req_t;

  // ---------------------------------------------------------------------------
  // Stimulus: one request vector, held for a number of cycles. Complete.
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
  // Observation: one arbitration decision, sampled at one rising edge. Complete.
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

    // Hold the request vector r for c cycles. Complete.
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
      // TODO step 4: the smoke row of the README's plan, with send().
    endtask
  endclass

  // Contention: everyone, then two disjoint pairs.
  class arb_load_seq extends arb_base_seq;
    `uvm_object_utils(arb_load_seq)

    function new(string name = "arb_load_seq");
      super.new(name);
    endfunction

    virtual task body();
      // TODO step 4: the load row of the README's plan, with send().
    endtask
  endclass

  // Random request vectors (stretch: arb_random_test). Complete.
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
      // TODO step 2: wait for a drv_cb edge at which rst_n was already 1. Then, forever:
      //   get the next item, drive vif.drv_cb.req <= req.req and wait @(vif.drv_cb),
      //   req.cycles times, then call item_done().
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
      // TODO step 2: forever, wait @(vif.mon_cb); when the sampled rst_n is 1, create
      //   a NEW arb_txn, copy mon_cb.req and mon_cb.gnt into it, and ap.write() it.
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
      ap = new("ap", this);
      // TODO step 2: create mon ("mon") always; create sqr ("sqr") and drv ("drv")
      //   only when get_is_active() == UVM_ACTIVE.
    endfunction

    virtual function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      // TODO step 2: promote mon.ap to ap; when active, connect
      //   drv.seq_item_port to sqr.seq_item_export.
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Scoreboard: a grant predictor (R1 to R4) and a fairness check (the bound).
  // Write both from the README's specification, not from the RTL.
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
      // TODO step 3: start the model where R5 leaves the DUT, and clear check_order
      //   when the plusarg ARB_FAIRNESS_ONLY is given ($test$plusargs).
    endfunction

    // R2, R3: the first requester after the last winner, wrapping.
    function req_t predict(req_t r);
      // TODO step 3
      return '0;
    endfunction

    virtual function void write(arb_txn t);
      // TODO step 3, in this order:
      //   1. count the cycle, and the grant if gnt is not 0;
      //   2. R1: ARB_PROTOCOL error if gnt is not zero or one-hot, or grants a non-requester;
      //   3. R2, R3: when check_order is 1, ARB_MISMATCH error if gnt !== predict(req);
      //   4. R4: move the model's last winner to its OWN prediction;
      //   5. fairness: per requester, clear the wait on a grant or no request, else count
      //      it, and report ARB_STARVED once when it reaches ARB_N cycles.
    endfunction

    virtual function void check_phase(uvm_phase phase);
      super.check_phase(phase);
      // TODO step 3: ARB_NO_TRAFFIC error when no grant was seen.
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
      // TODO step 4: cp_gnt (one bin per winner), cp_load (one, some, all),
      //   cp_wait (one bin per wait 0 to ARB_N-1) and the cross x_gnt_load.
      cp_gnt: coverpoint g_idx;
    endgroup

    function new(string name, uvm_component parent);
      super.new(name, parent);
      arb_cg = new();
    endfunction

    virtual function void write(arb_txn t);
      // TODO step 4: on a one-hot grant, set g_idx, n_req and g_wait and sample;
      //   then update every requester's wait count.
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
      // TODO step 3: connect agent.ap to the scoreboard's analysis_export.
      // TODO step 4: connect agent.ap to the coverage subscriber's analysis_export.
    endfunction
  endclass

  // ---------------------------------------------------------------------------
  // Tests. Complete.
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
