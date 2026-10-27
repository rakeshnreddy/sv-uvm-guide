// =====================================================================
// Lab scoreboard-reference-model: STARTER (one file; complete the TODOs)
// The bench drives 20 back-to-back requests into alu_pipe and has two
// working monitors, but nothing checks the results: the run passes with
// UVM_ERROR : 0 whatever the DUT does. TODO 1 to TODO 4 make it self-checking.
// Plant a bug with +define+MUT_DROP, +define+MUT_SUB or +define+MUT_EXTRA;
// run the zero-traffic case with +UVM_TESTNAME=alu_zero_test.
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
    // TODO 1: return the specified result for each operation, from the spec
    // in README.md, not from the RTL above: ADD a+b, SUB a-b modulo 2**16,
    // MUL a*b, AND {8'h00, a & b}. An undefined (X) opcode has no result: 'x.
    return 'x;
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
      // TODO 2: clone t into a new alu_item (never modify t: every subscriber
      // of in_mon.ap holds the same handle), set its result with alu_model(),
      // and publish it on ap.
    endfunction
  endclass

  // In-order scoreboard, form B: two analysis FIFOs and a run_phase thread.
  class alu_scoreboard extends uvm_scoreboard;
    `uvm_component_utils(alu_scoreboard)

    // TODO 3a: declare exp_export and act_export (uvm_analysis_export #(alu_item))
    //          and two private uvm_tlm_analysis_fifo #(alu_item): exp_fifo, act_fifo.
    //          Construct all four with new() in build_phase and connect each
    //          export to its FIFO's analysis_export in connect_phase.
    // TODO 3b: create a uvm_comparer with set_threshold(0).

    time max_latency = 100ns;      // the spec's bound plus margin: a knob, not a guess
    int unsigned n_match, n_mismatch;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    // TODO 3c: run_phase, in order. Loop forever: peek() the oldest prediction,
    //          get() the next actual; if its tag is not the prediction's tag, set
    //          the actual aside as unexpected; otherwise try_get() the prediction
    //          and compare by value with compare(), checking the bit it returns.
    //          Count matches; raise `uvm_error("SCB/MISMATCH", ...) on a miscompare.

    // TODO 4a: check_phase. SCB/MISSING for each prediction left in exp_fifo,
    //          SCB/UNEXPECTED for each actual set aside or left in act_fifo,
    //          SCB/NO_TRAFFIC if nothing was compared.
    // TODO 4b: report_phase (and pre_abort): one line,
    //          SCB_SUMMARY matches=<n> mismatches=<n> pending=<n>. Never print PASSED.
    // TODO 4c: phase_ready_to_end. For the run phase only, once, and only if a
    //          prediction is outstanding: raise the phase's objection, wait until
    //          exp_fifo is empty or max_latency passes, then drop it. No fixed delay.
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
      // TODO 3d: connect prd.ap to scb.exp_export and out_agt.out_mon.ap to
      //          scb.act_export.
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
