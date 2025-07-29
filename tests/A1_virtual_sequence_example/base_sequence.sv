`ifndef BASE_SEQUENCE_SV
`define BASE_SEQUENCE_SV

class base_sequence extends uvm_sequence #(sequence_item);
  `uvm_object_utils(base_sequence)

  function new(string name = "base_sequence");
    super.new(name);
  endfunction

  virtual task body();
    // Base sequence does nothing
  endtask

endclass

`endif // BASE_SEQUENCE_SV
