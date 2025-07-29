`ifndef ALU_TRANSACTION_SV
`define ALU_TRANSACTION_SV

typedef enum {ADD, SUB, MUL} alu_op_e;

class alu_transaction extends uvm_sequence_item;
  rand logic [7:0] a;
  rand logic [7:0] b;
  rand alu_op_e op;
  logic [7:0] result;

  `uvm_object_utils_begin(alu_transaction)
    `uvm_field_int(a, UVM_ALL_ON)
    `uvm_field_int(b, UVM_ALL_ON)
    `uvm_field_enum(alu_op_e, op, UVM_ALL_ON)
    `uvm_field_int(result, UVM_ALL_ON)
  `uvm_object_utils_end

  function new(string name = "alu_transaction");
    super.new(name);
  endfunction
endclass

`endif // ALU_TRANSACTION_SV
