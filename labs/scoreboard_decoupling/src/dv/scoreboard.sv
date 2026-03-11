class my_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(my_scoreboard)
  
  // TODO: Change this imp to a get_port
  uvm_analysis_imp #(my_txn, my_scoreboard) analysis_export;

  function new(string name="my_scoreboard", uvm_component parent=null);
    super.new(name, parent);
    analysis_export = new("analysis_export", this);
  endfunction

  // TODO: Remove this write() method entirely. 
  // Replace it with a run_phase() task that loops forever, calling get() on your new port.
  virtual function void write(my_txn t);
    $display("@%0t [SCB] Received txn data: %h. Processing...", $time, t.data);
    // Simulate slow hardware processing (this blocks the monitor thread!)
    #30; 
    $display("@%0t [SCB] Finished processing.", $time);
  endfunction
endclass
