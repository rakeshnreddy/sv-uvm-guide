// The transaction both streams carry, and the lab's configuration object.

class my_txn extends uvm_sequence_item;
  `uvm_object_utils(my_txn)

  int unsigned   seq;    // request number; the response carries the same value
  rand bit [7:0] data;

  function new(string name = "my_txn");
    super.new(name);
  endfunction

  virtual function void do_copy(uvm_object rhs);
    my_txn rhs_;
    super.do_copy(rhs);
    if (!$cast(rhs_, rhs)) `uvm_fatal("TXN/COPY", "rhs is not a my_txn")
    seq  = rhs_.seq;
    data = rhs_.data;
  endfunction

  virtual function bit do_compare(uvm_object rhs, uvm_comparer comparer);
    my_txn rhs_;
    if (!$cast(rhs_, rhs)) return 0;
    do_compare  = super.do_compare(rhs, comparer);
    do_compare &= comparer.compare_field_int("seq", seq, rhs_.seq, 32);
    do_compare &= comparer.compare_field_int("data", data, rhs_.data, 8);
  endfunction

  virtual function string convert2string();
    return $sformatf("seq=%0d data=%02h", seq, data);
  endfunction
endclass

class decoupling_lab_config extends uvm_object;
  `uvm_object_utils(decoupling_lab_config)

  int unsigned transaction_count = 10;
  time         rsp_latency       = 30ns;  // a response follows its request by 3 cycles
  int          corrupt_index     = -1;    // set to a request number to plant a bug

  function new(string name = "decoupling_lab_config");
    super.new(name);
  endfunction
endclass
