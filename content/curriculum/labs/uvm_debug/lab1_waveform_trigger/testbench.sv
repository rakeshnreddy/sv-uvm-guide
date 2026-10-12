// Lab debug-waveform-trigger (module E-DBG-1): starter.
// One file. Compile with uvm-core 2020.3.1 (or your simulator's UVM), top module
// tb_top. It compiles and runs as given; the README tells you what to add.
`include "uvm_macros.svh"

// ---------------------------------------------------------------------------
// 1. The bus between the testbench and the DUT stand-in
// ---------------------------------------------------------------------------
interface bus_if (input logic clk, input logic rst_n);
  timeunit 1ns; timeprecision 1ps;
  logic       valid;
  logic       ready;
  logic [7:0] data;

  // The traffic generator drives through drv_cb, 1 ns after each edge.
  clocking drv_cb @(posedge clk);
    default input #1step output #1;
    output valid, data;
    input  ready;
  endclocking

  // The monitor samples everything just before each edge.
  clocking mon_cb @(posedge clk);
    default input #1step;
    input valid, ready, data;
  endclocking
endinterface

// ---------------------------------------------------------------------------
// 2. The DUT stand-in: a sink with the bug this lab hunts
// ---------------------------------------------------------------------------
module stall_sink #(parameter int unsigned STALL_AFTER = 300) (
  input  logic       clk,
  input  logic       rst_n,
  input  logic       valid,
  input  logic [7:0] data,
  output logic       ready
);
  timeunit 1ns; timeprecision 1ps;
  logic [15:0] accepted;    // beats accepted so far
  logic [7:0]  last_data;   // data of the last accepted beat

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      accepted  <= '0;
      last_data <= '0;
    end else if (valid && ready) begin
      accepted  <= accepted + 16'd1;
      last_data <= data;
    end
  end

  // The bug: once STALL_AFTER beats are accepted, ready falls and nothing
  // ever raises it again. The waveform window must show this moment.
  assign ready = rst_n && (accepted < STALL_AFTER);
endmodule

// ---------------------------------------------------------------------------
// 3. The verification classes. They live in a package, as in a real bench, so
//    they cannot refer to tb_top by name (IEEE 1800-2023 §26.2).
// ---------------------------------------------------------------------------
package dbg_lab_pkg;
  timeunit 1ns; timeprecision 1ps;
  import uvm_pkg::*;

  // A debug event: what happened, and the last time the bus made progress.
  class debug_event extends uvm_object;
    `uvm_object_utils(debug_event)
    string tag;          // e.g. "WATCHDOG_TIMEOUT"
    string detail;
    time   last_ok_ns;   // last accepted beat, in ns

    function new(string name = "debug_event");
      super.new(name);
    endfunction
  endclass

  // The bus: one analysis port that any component can publish on.
  class debug_event_bus extends uvm_component;
    `uvm_component_utils(debug_event_bus)
    uvm_analysis_port #(debug_event) ap;

    function new(string name, uvm_component parent);
      super.new(name, parent);
      ap = new("ap", this);
    endfunction

    // A function: every subscriber's write() runs now, in zero time,
    // in the publisher's process.
    function void publish(string tag, string detail, time last_ok_ns);
      debug_event evt = debug_event::type_id::create("evt");
      evt.tag        = tag;
      evt.detail     = detail;
      evt.last_ok_ns = last_ok_ns;
      `uvm_info("BUS", $sformatf("Broadcasting %s: %s", tag, detail), UVM_LOW)
      ap.write(evt);
    endfunction
  endclass

  // Stands in for a driver: sends num_beats beats with a valid/ready handshake.
  class traffic_gen extends uvm_component;
    `uvm_component_utils(traffic_gen)
    virtual bus_if vif;
    int unsigned   num_beats = 500;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db #(virtual bus_if)::get(this, "", "vif", vif)) begin
        `uvm_fatal("NO_VIF", "traffic_gen needs a virtual bus_if")
      end
    endfunction

    // Returns only when every beat has been accepted.
    task send_all();
      vif.drv_cb.valid <= 1'b0;
      wait (vif.rst_n === 1'b1);
      @(vif.drv_cb);
      for (int unsigned n = 0; n < num_beats; n++) begin
        vif.drv_cb.valid <= 1'b1;
        vif.drv_cb.data  <= n[7:0];
        // Hold the beat until an edge at which ready was sampled high.
        @(vif.drv_cb iff vif.drv_cb.ready === 1'b1);
      end
      vif.drv_cb.valid <= 1'b0;
    endtask
  endclass

  // Counts accepted beats and remembers when the last one happened.
  class bus_monitor extends uvm_component;
    `uvm_component_utils(bus_monitor)
    virtual bus_if vif;
    int unsigned   beats;
    time           last_beat_ns;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db #(virtual bus_if)::get(this, "", "vif", vif)) begin
        `uvm_fatal("NO_VIF", "bus_monitor needs a virtual bus_if")
      end
    endfunction

    task run_phase(uvm_phase phase);
      forever begin
        @(vif.mon_cb);
        if (vif.mon_cb.valid === 1'b1 && vif.mon_cb.ready === 1'b1) begin
          beats++;
          last_beat_ns = $time;
        end
      end
    endtask
  endclass

  // Declares a stall when no beat has been accepted for limit_ns.
  class watchdog_timer extends uvm_component;
    `uvm_component_utils(watchdog_timer)
    debug_event_bus bus;            // set by the env in connect_phase
    bus_monitor     mon;            // set by the env in connect_phase
    time            check_ns = 100;
    time            limit_ns = 2000;
    time            grace_ns = 50;  // lets subscribers act before the fatal

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    task run_phase(uvm_phase phase);
      forever begin
        #(check_ns * 1ns);
        if ($time - mon.last_beat_ns >= limit_ns) begin
          bus.publish("WATCHDOG_TIMEOUT",
                      $sformatf("no transfer for %0d ns after %0d beats",
                                $time - mon.last_beat_ns, mon.beats),
                      mon.last_beat_ns);
          // The grace time is not a history buffer: nothing before the
          // publish can be recorded any more.
          #(grace_ns * 1ns);
          `uvm_fatal("WDG", "bus stalled: stopping the run")
        end
      end
    endtask
  endclass

  // --- LAB EXERCISE: the subscriber (Steps 2 and 3 of the README) ----------
  class waveform_trigger_sub extends uvm_subscriber #(debug_event);
    `uvm_component_utils(waveform_trigger_sub)
    time      pre_ns = 200;   // history wanted before the last good beat
    uvm_event dump_now;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    // TODO (Step 2): in build_phase, get the global event named "dump_now"
    //   from uvm_event_pool. tb_top waits on the same key.

    // write() is a function: it must not block or consume time.
    virtual function void write(debug_event t);
      // TODO (Step 2): when t.tag is "WATCHDOG_TIMEOUT", trigger dump_now.
      // TODO (Step 3): also compute start_ns = t.last_ok_ns - pre_ns
      //   (0 if that would be negative) and print it with `uvm_info at
      //   UVM_NONE as the +DUMP_START value for a rerun.
    endfunction
  endclass
  // -------------------------------------------------------------------------

  class dbg_env extends uvm_env;
    `uvm_component_utils(dbg_env)
    debug_event_bus      bus;
    traffic_gen          gen;
    bus_monitor          mon;
    watchdog_timer       wdg;
    waveform_trigger_sub trig_sub;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      bus      = debug_event_bus::type_id::create("bus", this);
      gen      = traffic_gen::type_id::create("gen", this);
      mon      = bus_monitor::type_id::create("mon", this);
      wdg      = watchdog_timer::type_id::create("wdg", this);
      // TODO (Step 2): create trig_sub with the factory.
    endfunction

    function void connect_phase(uvm_phase phase);
      wdg.bus = bus;
      wdg.mon = mon;
      // TODO (Step 2): connect bus.ap to trig_sub's analysis_export.
    endfunction
  endclass

  class stall_test extends uvm_test;
    `uvm_component_utils(stall_test)
    dbg_env env;

    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction

    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      env = dbg_env::type_id::create("env", this);
    endfunction

    task run_phase(uvm_phase phase);
      phase.raise_objection(this, "send 500 beats");
      env.gen.send_all();
      phase.drop_objection(this, "all beats accepted");
    endtask
  endclass
endpackage

// ---------------------------------------------------------------------------
// 4. The top module: clock, reset, DUT stand-in, and dump control
// ---------------------------------------------------------------------------
module tb_top;
  timeunit 1ns; timeprecision 1ps;
  import uvm_pkg::*;
  import dbg_lab_pkg::*;

  logic clk;
  logic rst_n;

  bus_if bif (.clk(clk), .rst_n(rst_n));

  stall_sink #(.STALL_AFTER(300)) u_sink (
    .clk(clk), .rst_n(rst_n),
    .valid(bif.valid), .data(bif.data), .ready(bif.ready)
  );

  initial clk = 1'b0;
  always #5ns clk = ~clk;   // rising edges at 5, 15, 25, ... ns

  // Release reset between two clock edges, so no edge races with it.
  initial begin
    rst_n = 1'b0;
    #22ns rst_n = 1'b1;
  end

  // Dump control lives here, not in a class: a class in a package cannot
  // name tb_top (IEEE 1800-2023 §26.2).
  initial begin : dump_ctl
    int unsigned start_ns;
    uvm_event    dump_now;
    // TODO (Step 4): if +DUMP_START=<ns> is on the command line (read it with
    //   $value$plusargs into start_ns), wait until that time and open
    //   window.vcd with $dumpfile and $dumpvars(0, tb_top) instead of the
    //   code below. Print a DUMP message with the time, as below.
    // Run 1: dump nothing unless the debug bus asks.
    dump_now = uvm_event_pool::get_global("dump_now");
    dump_now.wait_trigger();
    $dumpfile("after_trigger.vcd");
    $dumpvars(0, tb_top);
    `uvm_info("DUMP", $sformatf("after_trigger.vcd opened at %0d ns", $time), UVM_NONE)
  end

  initial begin
    $timeformat(-9, 0, " ns", 0);   // UVM then prints times as "5100 ns"
    uvm_config_db #(virtual bus_if)::set(null, "uvm_test_top.env.*", "vif", bif);
    run_test("stall_test");
  end
endmodule
