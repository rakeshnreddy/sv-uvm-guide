`timescale 1ns/1ps
`include "uvm_macros.svh"
import uvm_pkg::*;

interface packet_if(input logic clk);
  logic valid;
  logic [7:0] payload;
  logic parity;

  clocking driver_cb @(posedge clk);
    output valid, payload, parity;
  endclocking

  modport driver_mp(clocking driver_cb);

  // Checker: every valid beat must carry even parity (parity == ^payload).
  // %m names this interface instance, so you can tell vif0's errors from vif1's.
  property p_parity_ok;
    @(posedge clk) valid |-> (parity == ^payload);
  endproperty
  a_parity_ok: assert property (p_parity_ok)
    else `uvm_error("PARITY_ERR", $sformatf("%m: payload=%02h parity=%0b",
                                            $sampled(payload), $sampled(parity)))
endinterface

class packet extends uvm_sequence_item;
  rand logic [7:0] payload;
  logic parity;
  bit inject_parity_error;
  int unsigned extra_delay_cycles;

  `uvm_object_utils_begin(packet)
    `uvm_field_int(payload, UVM_ALL_ON)
    `uvm_field_int(parity, UVM_ALL_ON)
    `uvm_field_int(inject_parity_error, UVM_ALL_ON)
    `uvm_field_int(extra_delay_cycles, UVM_ALL_ON)
  `uvm_object_utils_end

  function new(string name = "packet");
    super.new(name);
  endfunction

  function void post_randomize();
    parity = ^payload;
  endfunction
endclass

// The callback class refers to the driver, which is declared below it.
typedef class packet_driver;

virtual class packet_driver_cb extends uvm_callback;
  function new(string name = "packet_driver_cb");
    super.new(name);
  endfunction

  // Hook: runs just before the driver drives pkt. It may change the
  // packet's control fields; it returns to the driver when done.
  virtual function void pre_drive(packet_driver driver, packet pkt);
  endfunction
endclass

class packet_driver extends uvm_driver #(packet);
  `uvm_component_utils(packet_driver)
  `uvm_register_cb(packet_driver, packet_driver_cb)

  virtual packet_if.driver_mp vif;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual packet_if.driver_mp)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "packet_if.driver_mp is not configured")
  endfunction

  task run_phase(uvm_phase phase);
    packet pkt;
    vif.driver_cb.valid <= 1'b0;
    forever begin
      seq_item_port.get_next_item(pkt);
      `uvm_do_callbacks(packet_driver, packet_driver_cb, pre_drive(this, pkt))

      repeat (pkt.extra_delay_cycles)
        @(vif.driver_cb);

      @(vif.driver_cb);
      vif.driver_cb.valid <= 1'b1;
      vif.driver_cb.payload <= pkt.payload;
      vif.driver_cb.parity <= pkt.parity ^ pkt.inject_parity_error;
      @(vif.driver_cb);
      vif.driver_cb.valid <= 1'b0;

      `uvm_info("DRV", $sformatf(
        "Drove payload=%02h parity=%0b error=%0b delay_cycles=%0d",
        pkt.payload, pkt.parity ^ pkt.inject_parity_error,
        pkt.inject_parity_error, pkt.extra_delay_cycles), UVM_LOW)
      seq_item_port.item_done();
    end
  endtask
endclass

class my_seq extends uvm_sequence #(packet);
  `uvm_object_utils(my_seq)

  function new(string name = "my_seq");
    super.new(name);
  endfunction

  task body();
    repeat (3) begin
      packet pkt = packet::type_id::create("pkt");
      start_item(pkt);
      if (!pkt.randomize())
        `uvm_fatal("RANDFAIL", "Packet randomization failed")
      finish_item(pkt);
    end
  endtask
endclass

// Two identical driver/sequencer pairs. The test must change drv0 only;
// drv1 must keep sending clean packets.
class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  packet_driver drv0, drv1;
  uvm_sequencer #(packet) sqr0, sqr1;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    drv0 = packet_driver::type_id::create("drv0", this);
    sqr0 = uvm_sequencer#(packet)::type_id::create("sqr0", this);
    drv1 = packet_driver::type_id::create("drv1", this);
    sqr1 = uvm_sequencer#(packet)::type_id::create("sqr1", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    drv0.seq_item_port.connect(sqr0.seq_item_export);
    drv1.seq_item_port.connect(sqr1.seq_item_export);
  endfunction
endclass

// --- LAB EXERCISE: the callback ---
class error_inject_cb extends packet_driver_cb;
  `uvm_object_utils(error_inject_cb)

  function new(string name = "error_inject_cb");
    super.new(name);
  endfunction

  // pkt is passed by value: a copy of the handle, so these field writes
  // change the packet the driver is about to drive.
  virtual function void pre_drive(packet_driver driver, packet pkt);
    pkt.inject_parity_error = 1'b1;
    pkt.extra_delay_cycles = 2;
    `uvm_info("CB", "Configured parity error and two cycle delay", UVM_LOW)
  endfunction
endclass

class my_test extends uvm_test;
  `uvm_component_utils(my_test)
  my_env env;
  error_inject_cb my_cb;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = my_env::type_id::create("env", this);
  endfunction

  // Every component exists by connect_phase, so env.drv0 is a real handle
  // and the callback is attached to that one driver instance only.
  // (In build_phase env.drv0 is still null: add(null, cb) is type-wide.)
  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    if (env.drv0 == null) `uvm_fatal("CBNULL", "env.drv0 is null")
    my_cb = error_inject_cb::type_id::create("my_cb");
    uvm_callbacks#(packet_driver, packet_driver_cb)::add(env.drv0, my_cb);
  endfunction

  // Prints every callback queue for packet_driver: (*) rows are type-wide.
  function void end_of_elaboration_phase(uvm_phase phase);
    super.end_of_elaboration_phase(phase);
    uvm_callbacks#(packet_driver, packet_driver_cb)::display();
  endfunction

  task run_phase(uvm_phase phase);
    my_seq seq0 = my_seq::type_id::create("seq0");
    my_seq seq1 = my_seq::type_id::create("seq1");
    phase.raise_objection(this);
    fork
      seq0.start(env.sqr0);
      seq1.start(env.sqr1);
    join
    // The checker reports a packet one clock after it is driven. Without a
    // drain time, the run ends in the time step of the last check and that
    // last error is never printed.
    phase.get_objection().set_drain_time(this, 20ns);
    phase.drop_objection(this);
  endtask

  // Remove it from the same instance it was added to.
  function void final_phase(uvm_phase phase);
    super.final_phase(phase);
    uvm_callbacks#(packet_driver, packet_driver_cb)::delete(env.drv0, my_cb);
  endfunction
endclass

module tb_top;
  logic clk = 1'b0;
  always #5ns clk = ~clk;
  packet_if vif0(clk);
  packet_if vif1(clk);

  initial begin
    uvm_config_db#(virtual packet_if.driver_mp)::set(
      null, "uvm_test_top.env.drv0", "vif", vif0
    );
    uvm_config_db#(virtual packet_if.driver_mp)::set(
      null, "uvm_test_top.env.drv1", "vif", vif1
    );
    run_test("my_test");
  end
endmodule
