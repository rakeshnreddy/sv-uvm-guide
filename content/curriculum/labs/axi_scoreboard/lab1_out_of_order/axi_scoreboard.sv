class axi_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(axi_scoreboard)

  uvm_analysis_imp_expected #(axi_transaction, axi_scoreboard) expected_export;
  uvm_analysis_imp_actual #(axi_transaction, axi_scoreboard) actual_export;

  // One queue per ID for expected reads
  // This allows out-of-order completion across different IDs, 
  // but maintains in-order checking for the same ID.
  axi_transaction expected_reads[int][$];

  function new(string name, uvm_component parent);
    super.new(name, parent);
    expected_export = new("expected_export", this);
    actual_export = new("actual_export", this);
  endfunction

  // Called when reference model predicts a read
  virtual function void write_expected(axi_transaction txn);
    if (!txn.is_write) begin
      `uvm_info("SCB_EXPECT", $sformatf("Expecting: %s", txn.convert2string()), UVM_LOW)
      expected_reads[txn.id].push_back(txn);
    end
  endfunction

  // Called when monitor reconstructs an actual read from the bus
  virtual function void write_actual(axi_transaction txn);
    if (!txn.is_write) begin
      `uvm_info("SCB_ACTUAL", $sformatf("Received: %s", txn.convert2string()), UVM_LOW)
      
      // TODO: 1. Check if expected_reads[txn.id] exists and has size > 0
      // TODO: 2. If so, pop the front transaction
      // TODO: 3. Compare the popped expected transaction against 'txn'
      // TODO: 4. If mismatch, throw a UVM_ERROR
      // TODO: 5. If expected_reads[txn.id] doesn't exist or is empty, throw UVM_ERROR "Unexpected read"
      
      // --- YOUR CODE HERE ---
      
      // ----------------------
    end
  endfunction
endclass
