class my_monitor extends uvm_monitor;
  `uvm_component_utils(my_monitor)
  uvm_analysis_port #(my_txn) ap;
  
  function new(string name="my_monitor", uvm_component parent=null);
    super.new(name, parent);
    ap = new("ap", this);
  endfunction

  task run_phase(uvm_phase phase);
    my_txn txn;
    forever begin
      #10; // Fast Clock tick
      txn = my_txn::type_id::create("txn");
      txn.randomize();
      $display("@%0t [MON] Broadcasting txn data: %h", $time, txn.data);
      ap.write(txn);
      $display("@%0t [MON] Broadcast complete.", $time);
    end
  endtask
endclass
