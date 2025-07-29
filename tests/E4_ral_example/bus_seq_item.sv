`include "uvm_macros.svh"

// Define the bus transaction type
typedef enum { READ, WRITE } bus_op_t;

class bus_seq_item extends uvm_sequence_item;
  rand bus_op_t   kind;
  rand bit [31:0] addr;
  rand bit [31:0] data;

  `uvm_object_utils_begin(bus_seq_item)
    `uvm_field_enum(bus_op_t, kind, UVM_ALL_ON)
    `uvm_field_int(addr, UVM_ALL_ON)
    `uvm_field_int(data, UVM_ALL_ON)
  `uvm_object_utils_end

  function new(string name = "bus_seq_item");
    super.new(name);
  endfunction
endclass
