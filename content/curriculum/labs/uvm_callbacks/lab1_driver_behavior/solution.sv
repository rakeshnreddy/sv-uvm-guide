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

typedef class packet_driver;

virtual class packet_driver_cb extends uvm_callback;
  function new(string name = "packet_driver_cb");
    super.new(name);
  endfunction

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
    packet pkt = packet::type_id::create("pkt");
    start_item(pkt);
    if (!pkt.randomize() with { payload == 8'hAA; })
      `uvm_fatal("RANDFAIL", "Packet randomization failed")
    finish_item(pkt);
  endtask
endclass

class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  packet_driver drv;
  uvm_sequencer #(packet) sqr;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    drv = packet_driver::type_id::create("drv", this);
    sqr = uvm_sequencer#(packet)::type_id::create("sqr", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    drv.seq_item_port.connect(sqr.seq_item_export);
  endfunction
endclass

class error_inject_cb extends packet_driver_cb;
  `uvm_object_utils(error_inject_cb)

  function new(string name = "error_inject_cb");
    super.new(name);
  endfunction

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
    my_cb = error_inject_cb::type_id::create("my_cb");
    uvm_callbacks#(packet_driver, packet_driver_cb)::add(env.drv, my_cb);
  endfunction

  task run_phase(uvm_phase phase);
    my_seq seq = my_seq::type_id::create("seq");
    phase.raise_objection(this);
    seq.start(env.sqr);
    phase.drop_objection(this);
  endtask

  function void final_phase(uvm_phase phase);
    super.final_phase(phase);
    uvm_callbacks#(packet_driver, packet_driver_cb)::delete(env.drv, my_cb);
  endfunction
endclass

module tb_top;
  logic clk = 1'b0;
  always #5ns clk = ~clk;
  packet_if vif(clk);

  initial begin
    uvm_config_db#(virtual packet_if.driver_mp)::set(
      null, "uvm_test_top.env.drv", "vif", vif
    );
    run_test("my_test");
  end
endmodule
