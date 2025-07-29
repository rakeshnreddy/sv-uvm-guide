`ifndef SEQUENCE_ITEM_SV
`define SEQUENCE_ITEM_SV

class sequence_item extends uvm_sequence_item;
  rand bit [7:0] a;
  rand bit [7:0] b;
  rand bit [3:0] op;

  `uvm_object_utils_begin(sequence_item)
    `uvm_field_int(a, UVM_ALL_ON)
    `uvm_field_int(b, UVM_ALL_ON)
    `uvm_field_int(op, UVM_ALL_ON)
  `uvm_object_utils_end

  function new(string name = "sequence_item");
    super.new(name);
  endfunction

endclass

`endif // SEQUENCE_ITEM_SV
