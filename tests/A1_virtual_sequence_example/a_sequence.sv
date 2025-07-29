`ifndef A_SEQUENCE_SV
`define A_SEQUENCE_SV

class a_sequence extends base_sequence;
  `uvm_object_utils(a_sequence)

  function new(string name = "a_sequence");
    super.new(name);
  endfunction

  virtual task body();
    `uvm_do_with(sequence_item, { a == 8'hA; })
  endtask

endclass

`endif // A_SEQUENCE_SV
