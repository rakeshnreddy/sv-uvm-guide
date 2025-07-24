`include "uvm_macros.svh"
import uvm_pkg::*;

class reset_phase extends uvm_phase;
  function new(); super.new("reset_phase", UVM_PHASE_SCHEDULE | UVM_PHASE_NODE); endfunction
  virtual task exec_task(uvm_component c, uvm_phase phase);
    `uvm_info("RESET", "Applying reset", UVM_LOW)
  endtask
endclass

class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
endclass
