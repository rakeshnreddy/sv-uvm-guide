class my_txn extends uvm_sequence_item;
  rand bit [7:0] data;
  `uvm_object_utils_begin(my_txn)
    `uvm_field_int(data, UVM_ALL_ON)
  `uvm_object_utils_end
  function new(string name="my_txn"); super.new(name); endfunction
endclass

class decoupling_lab_config extends uvm_object;
  `uvm_object_utils(decoupling_lab_config)

  int unsigned transaction_count = 10;
  time consumer_delay = 30ns;

  function new(string name = "decoupling_lab_config");
    super.new(name);
  endfunction
endclass
