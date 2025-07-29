class alu_base_sequence extends uvm_sequence #(alu_transaction);
  `uvm_object_utils(alu_base_sequence)

  function new(string name = "alu_base_sequence");
    super.new(name);
  endfunction

  virtual task body();
    alu_transaction req;
    req = alu_transaction::type_id::create("req");
    start_item(req);
    assert(req.randomize());
    finish_item(req);
  endtask
endclass
