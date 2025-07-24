`include "uvm_macros.svh"
import uvm_pkg::*;

class my_reg extends uvm_reg;
  rand uvm_reg_field f;
  function new(string name="my_reg");
    super.new(name, 8, UVM_NO_COVERAGE);
  endfunction
  virtual function void build();
    f = uvm_reg_field::type_id::create("f");
    f.configure(this, 8, 0, "RW", 0, 0, 1, 0);
  endfunction
endclass

class my_reg_block extends uvm_reg_block;
  rand my_reg r1;
  function new(string name="my_reg_block");
    super.new(name, UVM_NO_COVERAGE);
  endfunction
  virtual function void build();
    r1 = my_reg::type_id::create("r1");
    r1.configure(this, null);
    r1.build();
    default_map = create_map("map", 'h0, 4, UVM_LITTLE_ENDIAN);
    default_map.add_reg(r1, 'h0, "RW");
  endfunction
endclass

class my_seq extends uvm_sequence#(uvm_reg_item);
  my_reg_block model;
  `uvm_object_utils(my_seq)
  function new(string name="my_seq"); super.new(name); endfunction
  virtual task body();
    uvm_status_e status;
    model.r1.write(status, 'hAA, UVM_FRONTDOOR);
    model.r1.write(status, 'h55, UVM_BACKDOOR);
  endtask
endclass

class my_predictor extends uvm_reg_predictor;
  `uvm_component_utils(my_predictor)
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  virtual function void write(uvm_reg_bus_op rw);
    rw.data = ~rw.data;
    super.write(rw);
  endfunction
endclass
