`ifndef B_SEQUENCE_SV
`define B_SEQUENCE_SV

class b_sequence extends base_sequence;
  `uvm_object_utils(b_sequence)

  function new(string name = "b_sequence");
    super.new(name);
  endfunction

  virtual task body();
    `uvm_do_with(sequence_item, { b == 8'hB; })
  endtask

endclass

`endif // B_SEQUENCE_SV
