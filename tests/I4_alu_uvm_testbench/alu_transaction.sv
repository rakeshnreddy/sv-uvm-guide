class alu_transaction extends uvm_sequence_item;
  rand logic [3:0] a;
  rand logic [3:0] b;
  rand enum {ADD, SUB} opcode;

  `uvm_object_utils_begin(alu_transaction)
    `uvm_field_int(a, UVM_ALL_ON)
    `uvm_field_int(b, UVM_ALL_ON)
    `uvm_field_enum(opcode, UVM_ALL_ON)
  `uvm_object_utils_end

  function new(string name = "alu_transaction");
    super.new(name);
  endfunction
endclass
