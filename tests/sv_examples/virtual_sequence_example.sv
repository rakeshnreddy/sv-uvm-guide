`include "uvm_macros.svh"
import uvm_pkg::*;

class simple_seq extends uvm_sequence#(int);
  int value;
  `uvm_object_utils(simple_seq)
  function new(string name="simple_seq"); super.new(name); endfunction
  virtual task body();
    `uvm_info(get_type_name(), $sformatf("Running seq with value %0d", value), UVM_LOW)
  endtask
endclass

class top_virtual_seq extends uvm_sequence;
  `uvm_object_utils(top_virtual_seq)
  simple_seq seqA;
  simple_seq seqB;
  virtual task body();
    seqA = simple_seq::type_id::create("seqA"); seqA.value = 1;
    seqB = simple_seq::type_id::create("seqB"); seqB.value = 2;
    p_sequencer.seqrA.lock(this);
    fork
      seqA.start(p_sequencer.seqrA);
      seqB.start(p_sequencer.seqrB);
    join
    p_sequencer.seqrA.unlock(this);
  endtask
endclass

class virtual_sequencer extends uvm_sequencer;
  `uvm_component_utils(virtual_sequencer)
  uvm_sequencer #(int) seqrA;
  uvm_sequencer #(int) seqrB;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
endclass
