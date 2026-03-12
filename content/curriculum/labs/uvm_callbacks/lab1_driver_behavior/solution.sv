`include "uvm_macros.svh"
import uvm_pkg::*;

// 1. Transaction
class packet extends uvm_sequence_item;
  rand logic [7:0] payload;
  logic parity;

  `uvm_object_utils(packet)
  
  function new(string name="packet");
    super.new(name);
  endfunction
  
  function void post_randomize();
    parity = ^payload; // Even parity
  endfunction
endclass

// 2. Callback Virtual Class
// The hook provided by the component developer
virtual class packet_driver_cb extends uvm_callback;
  virtual task pre_drive(packet_driver driver, ref packet pkt);
  endtask
endclass

// 3. Driver
class packet_driver extends uvm_driver#(packet);
  `uvm_component_utils(packet_driver)
  
  // Register the callback type
  `uvm_register_cb(packet_driver, packet_driver_cb)

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  task run_phase(uvm_phase phase);
    packet pkt;
    forever begin
      seq_item_port.get_next_item(pkt);
      
      `uvm_info("DRV", $sformatf("Prepared pkt Payload: %h, Parity: %b at time %0t", pkt.payload, pkt.parity, $time), UVM_LOW)
      
      // Execute the callback hook BEFORE driving
      `uvm_do_callbacks(packet_driver, packet_driver_cb, pre_drive(this, pkt))
      
      // Simulate driving
      #5ns; 
      
      `uvm_info("DRV", $sformatf("Driven pkt Payload: %h, Parity: %b at time %0t", pkt.payload, pkt.parity, $time), UVM_LOW)
      
      seq_item_port.item_done();
    end
  endtask
endclass

// 4. Sequence
class my_seq extends uvm_sequence#(packet);
  `uvm_object_utils(my_seq)
  function new(string name="my_seq"); super.new(name); endfunction
  task body();
    packet pkt = packet::type_id::create("pkt");
    start_item(pkt);
    pkt.randomize() with { payload == 8'hAA; };
    finish_item(pkt);
  endtask
endclass

// 5. Environment
class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  packet_driver drv;
  uvm_sequencer#(packet) sqr;
  
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  
  function void build_phase(uvm_phase phase);
    drv = packet_driver::type_id::create("drv", this);
    sqr = uvm_sequencer#(packet)::type_id::create("sqr", this);
  endfunction
  
  function void connect_phase(uvm_phase phase);
    drv.seq_item_port.connect(sqr.seq_item_export);
  endfunction
endclass


// --- SOLUTION IMPLEMENTATION ---

// Create a callback class 'error_inject_cb' extending from 'packet_driver_cb'.
class error_inject_cb extends packet_driver_cb;
  `uvm_object_utils(error_inject_cb)
  
  function new(string name="error_inject_cb");
    super.new(name);
  endfunction
  
  // Override 'pre_drive' to add a 10ns delay (#10ns) and invert the packet's parity bit.
  virtual task pre_drive(packet_driver driver, ref packet pkt);
    `uvm_info("CB", "Injecting 10ns delay and corrupting parity bit via callback...", UVM_LOW)
    #10ns;
    pkt.parity = ~pkt.parity;
  endtask
endclass

// -----------------------------

// 6. Test
class my_test extends uvm_test;
  `uvm_component_utils(my_test)
  my_env env;
  
  // Declare a handle for your callback class here
  error_inject_cb my_cb;
  
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = my_env::type_id::create("env", this);
    
    // Instantiate your callback here
    my_cb = error_inject_cb::type_id::create("my_cb");
    // Add your callback to the driver using uvm_callbacks API
    uvm_callbacks#(packet_driver, packet_driver_cb)::add(env.drv, my_cb);
    
  endfunction

  task run_phase(uvm_phase phase);
    my_seq seq = my_seq::type_id::create("seq");
    phase.raise_objection(this);
    seq.start(env.sqr);
    phase.drop_objection(this);
  endtask
endclass

// 7. Top Module
module tb_top;
  initial begin
    run_test("my_test");
  end
endmodule
