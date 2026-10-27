// =====================================================================
// Lab scoreboard-reference-model: SOLUTION (one complete, runnable file)
// The M3 gate: a reference model, a predictor and an in-order scoreboard
// fed by two analysis FIFOs, with end-of-test accounting and a drain.
// Plant a bug with +define+MUT_DROP, +define+MUT_SUB or +define+MUT_EXTRA;
// run the zero-traffic case with +UVM_TESTNAME=alu_zero_test.
// Checked by reading against IEEE 1800-2023 and uvm-core 2020.3.1.
// =====================================================================

// ------------------------------------------------------------------ DUT
// Two-stage ALU: one request per clock; the result appears two rising edges
// later, in request order, with the request's tag.
module alu_pipe (
  input  logic        clk,
  input  logic        rst_n,      // synchronous, active low
  input  logic        valid_in,
  input  logic [3:0]  tag_in,     // returned unchanged with the result
  input  logic [1:0]  op,         // 0 ADD, 1 SUB, 2 MUL, 3 AND
  input  logic [7:0]  a,
  input  logic [7:0]  b,
  output logic        valid_out,
  output logic [3:0]  tag_out,
  output logic [15:0] result
);
  timeunit 1ns; timeprecision 1ps;

  logic        v1;
  logic [3:0]  tag1;
  logic [15:0] res1, f;
  logic [4:0]  n_acc;       // requests accepted so far (MUT_DROP uses it)
  logic        dup_done;    // MUT_EXTRA uses it

  always_comb begin
    unique case (op)
      2'd0:    f = a + b;            // 16-bit context keeps the carry
`ifdef MUT_SUB
      2'd1:    f = a + b;            // planted bug: SUB executes as ADD
`else
      2'd1:    f = a - b;            // wraps modulo 2**16
`endif
      2'd2:    f = a * b;
      2'd3:    f = {8'h00, a & b};
      default: f = 'x;               // op is X or Z
    endcase
  end

  always_ff @(posedge clk) begin
    if (!rst_n) begin
      v1        <= 1'b0;
      valid_out <= 1'b0;
      n_acc     <= '0;
      dup_done  <= 1'b0;
    end else begin
      // Stage 1: register the request and its result.
      v1   <= valid_in;
      tag1 <= tag_in;
      res1 <= f;
      if (valid_in) n_acc <= n_acc + 5'd1;
`ifdef MUT_DROP
      if (valid_in && n_acc == 5'd19) v1 <= 1'b0;  // planted bug: request 20 is lost
`endif
      // Stage 2: present the result; tag and result hold while idle.
      valid_out <= v1;
      if (v1) begin
        tag_out <= tag1;
        result  <= res1;
      end
`ifdef MUT_EXTRA
      // Planted bug: the first result followed by an idle cycle is sent twice.
      if (!v1 && valid_out && !dup_done) begin
        valid_out <= 1'b1;
        dup_done  <= 1'b1;
      end
`endif
    end
  end
endmodule

// ------------------------------------------------------------ interface
interface alu_if (input logic clk, input logic rst_n);
  timeunit 1ns; timeprecision 1ps;

  logic        valid_in;
  logic [3:0]  tag_in;
  logic [1:0]  op;
  logic [7:0]  a, b;
  logic        valid_out;
  logic [3:0]  tag_out;
  logic [15:0] result;

  // The driver's view: drives land just after the edge, so alu_pipe samples
  // them at the next one.
  clocking drv_cb @(posedge clk);
    default input #1step output #0;
    output valid_in, tag_in, op, a, b;
    input  rst_n;
  endclocking

  // The monitors' view: everything sampled just before the edge, as the
  // DUT's flip-flops see it.
  clocking mon_cb @(posedge clk);
    default input #1step;
    input valid_in, tag_in, op, a, b, valid_out, tag_out, result, rst_n;
  endclocking
endinterface

// -------------------------------------------------------------- package
package alu_pkg;
  timeunit 1ns; timeprecision 1ps;
  import uvm_pkg::*;
  `include "uvm_macros.svh"

  typedef enum logic [1:0] {ALU_ADD, ALU_SUB, ALU_MUL, ALU_AND} alu_op_e;

  // The reference model: what the specification says each operation returns.
  function automatic logic [15:0] alu_model(alu_op_e op,
                                            logic [7:0] a, logic [7:0] b);
    case (op)
      ALU_ADD: return 16'(a) + 16'(b);
      ALU_SUB: return 16'(a) - 16'(b);   // wraps modulo 2**16, as specified
      ALU_MUL: return 16'(a) * 16'(b);
      ALU_AND: return {8'h00, a & b};
      default: return 'x;                // an X opcode has no defined result
    endcase
  endfunction

  class alu_item extends uvm_sequence_item;
    `uvm_object_utils(alu_item)

    logic      [3:0]  tag;           // set by the sequence, returned by the DUT
    rand alu_op_e     op;
    rand logic [7:0]  a, b;
    logic      [15:0] result;        // predicted (expected) or observed (actual)
    int unsigned      idle_cycles;   // driver knob: idle cycles after this request

    function new(string name = "alu_item");
      super.new(name);
    endfunction

    virtual function void do_copy(uvm_object rhs);
      alu_item rhs_;
      super.do_copy(rhs);
      if (!$cast(rhs_, rhs)) `uvm_fatal("ITEM/COPY", "rhs is not an alu_item")
      tag    = rhs_.tag;
      op     = rhs_.op;
      a      = rhs_.a;
      b      = rhs_.b;
      result = rhs_.result;
    endfunction

    // Compare only what the output side carries: an actual has no op, a or b.
    virtual function bit do_compare(uvm_object rhs, uvm_comparer comparer);
      alu_item rhs_;
      if (!$cast(rhs_, rhs)) return 0;
      do_compare  = super.do_compare(rhs, comparer);
      do_compare &= comparer.compare_field_int("tag", tag, rhs_.tag, 4);
      do_compare &= comparer.compare_field_int("result", result, rhs_.result, 16);
    endfunction

    virtual function string convert2string();
      return $sformatf("tag=%0d %s a=%0d b=%0d result=%0d",
                       tag, op.name(), a, b, result);
    endfunction
  endclass

  class alu_seq extends uvm_sequence #(alu_item);
    `uvm_object_utils(alu_seq)

    int unsigned num_items = 20;

    function new(string name = "alu_seq");
      super.new(name);
    endfunction

    virtual task body();
      for (int unsigned i = 0; i < num_items; i++) begin
        alu_item it = alu_item::type_id::create("it");
        start_item(it);
        if (!it.randomize()) `uvm_fatal("RAND", "alu_item randomization failed")
        it.tag         = 4'(i);             // the DUT returns it: the match key
        it.idle_cycles = (i == 9) ? 1 : 0;  // one gap mid-stream, as real traffic has
        finish_item(it);
      end
    endtask
  endclass

  class alu_driver extends uvm_driver #(alu_item);
    `uvm_component_utils(alu_driver)

    virtual alu_if vif;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "virtual alu_if 'vif' is not set for the driver")
    endfunction

    virtual task run_phase(uvm_phase phase);
      vif.drv_cb.valid_in <= 1'b0;          // idle the bus from the first edge
      do @(vif.drv_cb); while (vif.drv_cb.rst_n !== 1'b1);
      forever begin
        seq_item_port.get_next_item(req);
        vif.drv_cb.valid_in <= 1'b1;
        vif.drv_cb.tag_in   <= req.tag;
        vif.drv_cb.op       <= req.op;
        vif.drv_cb.a        <= req.a;
        vif.drv_cb.b        <= req.b;
        @(vif.drv_cb);                      // alu_pipe accepts it at this edge
        vif.drv_cb.valid_in <= 1'b0;        // a following item overrides this
        repeat (req.idle_cycles) @(vif.drv_cb);
        seq_item_port.item_done();
      end
    endtask
  endclass

  // Publishes one new item for every request the DUT accepts.
  class alu_in_mon extends uvm_monitor;
    `uvm_component_utils(alu_in_mon)

    virtual alu_if vif;
    uvm_analysis_port #(alu_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      ap = new("ap", this);
      if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "virtual alu_if 'vif' is not set for in_mon")
    endfunction

    virtual task run_phase(uvm_phase phase);
      forever begin
        @(vif.mon_cb);
        if (vif.mon_cb.rst_n === 1'b1 && vif.mon_cb.valid_in === 1'b1) publish();
      end
    endtask

    protected function void publish();
      alu_item t = alu_item::type_id::create("t");   // a new object every time
      if ($isunknown({vif.mon_cb.tag_in, vif.mon_cb.op, vif.mon_cb.a, vif.mon_cb.b}))
        `uvm_error("MON/X", "valid_in is 1 but a request field is X or Z")
      t.tag = vif.mon_cb.tag_in;
      t.op  = alu_op_e'(vif.mon_cb.op);
      t.a   = vif.mon_cb.a;
      t.b   = vif.mon_cb.b;
      ap.write(t);
    endfunction
  endclass

  // Publishes one new item for every result the DUT presents.
  class alu_out_mon extends uvm_monitor;
    `uvm_component_utils(alu_out_mon)

    virtual alu_if vif;
    uvm_analysis_port #(alu_item) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      ap = new("ap", this);
      if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "virtual alu_if 'vif' is not set for out_mon")
    endfunction

    virtual task run_phase(uvm_phase phase);
      forever begin
        @(vif.mon_cb);
        if (vif.mon_cb.rst_n === 1'b1 && vif.mon_cb.valid_out === 1'b1) publish();
      end
    endtask

    protected function void publish();
      alu_item t = alu_item::type_id::create("t");
      if ($isunknown(vif.mon_cb.tag_out))
        `uvm_error("MON/X", "valid_out is 1 but tag_out is X or Z")
      t.tag    = vif.mon_cb.tag_out;
      t.result = vif.mon_cb.result;
      ap.write(t);
    endfunction
  endclass

  typedef uvm_sequencer #(alu_item) alu_sqr;

  class alu_in_agent extends uvm_agent;     // active: drives and watches requests
    `uvm_component_utils(alu_in_agent)

    alu_sqr    sqr;
    alu_driver drv;
    alu_in_mon in_mon;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      sqr = alu_sqr::type_id::create("sqr", this);
      drv = alu_driver::type_id::create("drv", this);
      in_mon = alu_in_mon::type_id::create("in_mon", this);
    endfunction

    virtual function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      drv.seq_item_port.connect(sqr.seq_item_export);
    endfunction
  endclass

  class alu_out_agent extends uvm_agent;    // passive: only watches results
    `uvm_component_utils(alu_out_agent)

    alu_out_mon out_mon;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      out_mon = alu_out_mon::type_id::create("out_mon", this);
    endfunction
  endclass

  // Turns each accepted request into an expected item.
  class alu_predictor extends uvm_subscriber #(alu_item);
    `uvm_component_utils(alu_predictor)

    uvm_analysis_port #(alu_item) ap;       // one expected item per request

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      ap = new("ap", this);
    endfunction

    // Called inside in_mon's ap.write(), in the time step the request was
    // accepted, so the prediction exists before any result can arrive.
    virtual function void write(alu_item t);
      alu_item exp;
      if (!$cast(exp, t.clone()))
        `uvm_fatal("PRD/CLONE", "clone() did not return an alu_item")
      exp.result = alu_model(t.op, t.a, t.b);   // t itself is never modified
      ap.write(exp);
    endfunction
  endclass

  // In-order scoreboard, form B: two analysis FIFOs and a run_phase thread.
  class alu_scoreboard extends uvm_scoreboard;
    `uvm_component_utils(alu_scoreboard)

    uvm_analysis_export #(alu_item) exp_export;   // from prd.ap
    uvm_analysis_export #(alu_item) act_export;   // from out_mon.ap

    time max_latency = 100ns;      // the spec's bound plus margin: a knob, not a guess

    protected uvm_tlm_analysis_fifo #(alu_item) exp_fifo, act_fifo;
    protected alu_item     held_q[$];     // actuals that were not the oldest's partner
    protected uvm_comparer cmp;
    protected bit          drained;
    protected event        compared;      // triggered after each actual is handled
    int unsigned n_match, n_mismatch;
    int unsigned n_missing;               // predictions check_phase found unanswered

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      exp_export = new("exp_export", this);
      act_export = new("act_export", this);
      exp_fifo   = new("exp_fifo", this);
      act_fifo   = new("act_fifo", this);
      cmp = uvm_comparer::type_id::create("cmp");
      cmp.set_threshold(0);          // compare every field, report every miscompare
      cmp.set_verbosity(UVM_HIGH);   // SCB/MISMATCH below carries the detail
    endfunction

    // The env connects to the exports; the FIFOs stay private.
    virtual function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      exp_export.connect(exp_fifo.analysis_export);
      act_export.connect(act_fifo.analysis_export);
    endfunction

    // In order: the oldest prediction is the only legal partner of the next
    // actual. peek() leaves the prediction in exp_fifo until its answer is in
    // hand, so check_phase still sees it if the answer never comes.
    virtual task run_phase(uvm_phase phase);
      alu_item exp, act;
      forever begin
        exp_fifo.peek(exp);
        act_fifo.get(act);
        if (act.tag != exp.tag) begin
          held_q.push_back(act);             // not this prediction's answer
        end else begin
          void'(exp_fifo.try_get(exp));      // only now consume the prediction
          compare_pair(exp, act);
        end
        -> compared;
      end
    endtask

    protected function void compare_pair(alu_item exp, alu_item act);
      if (exp.compare(act, cmp)) begin       // by value, and the result is checked
        n_match++;
        `uvm_info("SCB/MATCH", exp.convert2string(), UVM_HIGH)
      end else begin
        n_mismatch++;
        `uvm_error("SCB/MISMATCH", $sformatf("expected %s, got tag=%0d result=%0d; %s",
                   exp.convert2string(), act.tag, act.result, cmp.get_miscompares()))
      end
    endfunction

    // Hold run_phase until every prediction is answered, with a watchdog.
    virtual function void phase_ready_to_end(uvm_phase phase);
      // Called for run and for every run-time phase: hold only run, and only
      // once, because UVM calls this again after our own drop.
      if (phase.get_name() != "run" || drained || exp_fifo.used() == 0) return;
      drained = 1;
      `uvm_info("SCB/DRAIN", $sformatf("holding run_phase: %0d outstanding",
                                       exp_fifo.used()), UVM_MEDIUM)
      phase.raise_objection(this, "scoreboard: predictions outstanding");
      fork
        begin
          fork
            // wait (exp_fifo.used() == 0) is not allowed: used() is virtual,
            // and an event expression may call only non-virtual methods.
            // Re-test the count each time the loop has handled an actual.
            while (exp_fifo.used() != 0) @(compared);
            #(max_latency);                  // watchdog: a lost result must not hang
          join_any
          disable fork;
          if (exp_fifo.used() != 0)
            `uvm_warning("SCB/DRAIN_TIMEOUT", $sformatf(
              "%0d outstanding after %0t; check_phase reports them",
              exp_fifo.used(), max_latency))
          phase.drop_objection(this, "scoreboard: idle or timed out");
        end
      join_none
    endfunction

    // After run_phase: report everything that was never paired.
    virtual function void check_phase(uvm_phase phase);
      alu_item t;
      super.check_phase(phase);
      while (exp_fifo.try_get(t)) begin
        n_missing++;
        `uvm_error("SCB/MISSING", {t.convert2string(), " was never answered"})
      end
      while (act_fifo.try_get(t))            // actuals that arrived with nothing
        held_q.push_back(t);                 // left to predict: unexpected too
      foreach (held_q[i])
        `uvm_error("SCB/UNEXPECTED", $sformatf(
          "tag=%0d result=%0d matched no prediction", held_q[i].tag, held_q[i].result))
      if (n_match + n_mismatch == 0)
        `uvm_error("SCB/NO_TRAFFIC", "no result was compared: this run proves nothing")
    endfunction

    protected function string summary();
      return $sformatf("SCB_SUMMARY matches=%0d mismatches=%0d pending=%0d",
                       n_match, n_mismatch,
                       n_missing + exp_fifo.used() + act_fifo.used() + held_q.size());
    endfunction

    virtual function void report_phase(uvm_phase phase);
      super.report_phase(phase);
      `uvm_info("SCB_SUMMARY", summary(), UVM_NONE)
    endfunction

    // A fatal (PH_TIMEOUT, for one) skips check_phase and report_phase:
    // leave the counts in the log before the simulator stops.
    virtual function void pre_abort();
      `uvm_info("SCB_SUMMARY", {summary(), " (run aborted)"}, UVM_NONE)
    endfunction
  endclass

  class alu_env extends uvm_env;
    `uvm_component_utils(alu_env)

    alu_in_agent   in_agt;
    alu_out_agent  out_agt;
    alu_predictor  prd;
    alu_scoreboard scb;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      in_agt  = alu_in_agent::type_id::create("in_agt", this);
      out_agt = alu_out_agent::type_id::create("out_agt", this);
      prd     = alu_predictor::type_id::create("prd", this);
      scb     = alu_scoreboard::type_id::create("scb", this);
    endfunction

    virtual function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      in_agt.in_mon.ap.connect(prd.analysis_export);  // accepted requests to the model
      prd.ap.connect(scb.exp_export);                 // expected items
      out_agt.out_mon.ap.connect(scb.act_export);     // actual results
    endfunction
  endclass

  class alu_test extends uvm_test;
    `uvm_component_utils(alu_test)

    alu_env      env;
    int unsigned num_items = 20;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      env = alu_env::type_id::create("env", this);
      uvm_root::get().set_timeout(1ms);      // a hang ends here, not after 9200 s
    endfunction

    virtual task run_phase(uvm_phase phase);
      alu_seq seq = alu_seq::type_id::create("seq");
      seq.num_items = num_items;
      phase.raise_objection(this, "alu_seq running");
      seq.start(env.in_agt.sqr);
      // No drain time and no delay: the scoreboard holds the phase until
      // every prediction is answered.
      phase.drop_objection(this, "alu_seq done");
    endtask
  endclass

  // Proves that a silent run cannot pass: no stimulus at all.
  class alu_zero_test extends alu_test;
    `uvm_component_utils(alu_zero_test)

    function new(string name, uvm_component parent);
      super.new(name, parent);
      num_items = 0;
    endfunction
  endclass
endpackage

// ------------------------------------------------------------------ top
module tb_top;
  timeunit 1ns; timeprecision 1ps;
  import uvm_pkg::*;
  `include "uvm_macros.svh"
  import alu_pkg::*;

  logic clk;
  logic rst_n;

  alu_if   alu_if0 (.clk(clk), .rst_n(rst_n));
  alu_pipe dut (.clk(clk), .rst_n(rst_n),
                .valid_in(alu_if0.valid_in), .tag_in(alu_if0.tag_in),
                .op(alu_if0.op), .a(alu_if0.a), .b(alu_if0.b),
                .valid_out(alu_if0.valid_out), .tag_out(alu_if0.tag_out),
                .result(alu_if0.result));

  initial begin
    clk = 1'b0;
    forever #5 clk = ~clk;               // rising edges at 5, 15, 25 ns ...
  end

  initial begin
    rst_n = 1'b0;
    repeat (2) @(posedge clk);
    rst_n <= 1'b1;                       // nonblocking: the flops at 15 ns see 0
  end

  initial begin
    $timeformat(-9, 0, " ns", 0);
    // Publish the interface before run_test(): the components read it in build_phase.
    uvm_config_db#(virtual alu_if)::set(null, "uvm_test_top.env.*", "vif", alu_if0);
    run_test("alu_test");                // +UVM_TESTNAME=<test> overrides this
  end
endmodule
