class alu_base_sequence extends uvm_sequence #(alu_transaction);
  `uvm_object_utils(alu_base_sequence)

  function new(string name = "alu_base_sequence");
    super.new(name);
  endfunction

  virtual task body();
    repeat (10) begin
      `uvm_do_with(alu_transaction, { op == ADD; })
      `uvm_do_with(alu_transaction, { op == SUB; })
      `uvm_do_with(alu_transaction, { op == MUL; })
    end
  endtask
endclass
