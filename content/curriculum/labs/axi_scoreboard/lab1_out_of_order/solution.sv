// solution.sv - Complete implementation

class axi_monitor extends uvm_monitor;
  `uvm_component_utils(axi_monitor)

  uvm_analysis_port #(axi_transaction) ap;
  virtual axi_if vif;

  axi_transaction pending_reads[int];

  function new(string name, uvm_component parent);
    super.new(name, parent);
    ap = new("ap", this);
  endfunction

  virtual task run_phase(uvm_phase phase);
    fork
      monitor_ar_channel();
      monitor_r_channel();
    join
  endtask

  virtual task monitor_ar_channel();
    forever begin
      @(posedge vif.ACLK);
      if (vif.ARVALID && vif.ARREADY) begin
        axi_transaction txn = axi_transaction::type_id::create("txn");
        txn.addr = vif.ARADDR;
        txn.id = vif.ARID;
        txn.is_write = 0;
        
        pending_reads[vif.ARID] = txn;
      end
    end
  endtask

  virtual task monitor_r_channel();
    forever begin
      @(posedge vif.ACLK);
      if (vif.RVALID && vif.RREADY && vif.RLAST) begin
        int id = vif.RID;
        if (pending_reads.exists(id)) begin
          axi_transaction txn = pending_reads[id];
          txn.data = vif.RDATA;
          
          ap.write(txn);
          pending_reads.delete(id);
        end else begin
          `uvm_error("MON", $sformatf("Received RVALID for ID %0d with no pending AR", id))
        end
      end
    end
  endtask
endclass

class axi_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(axi_scoreboard)

  uvm_analysis_imp_expected #(axi_transaction, axi_scoreboard) expected_export;
  uvm_analysis_imp_actual #(axi_transaction, axi_scoreboard) actual_export;

  axi_transaction expected_reads[int][$];

  function new(string name, uvm_component parent);
    super.new(name, parent);
    expected_export = new("expected_export", this);
    actual_export = new("actual_export", this);
  endfunction

  virtual function void write_expected(axi_transaction txn);
    if (!txn.is_write) begin
      `uvm_info("SCB_EXPECT", $sformatf("Expecting: %s", txn.convert2string()), UVM_LOW)
      expected_reads[txn.id].push_back(txn);
    end
  endfunction

  virtual function void write_actual(axi_transaction txn);
    if (!txn.is_write) begin
      `uvm_info("SCB_ACTUAL", $sformatf("Received: %s", txn.convert2string()), UVM_LOW)
      
      if (expected_reads.exists(txn.id) && expected_reads[txn.id].size() > 0) begin
        axi_transaction exp = expected_reads[txn.id].pop_front();
        if (!exp.compare(txn)) begin
          `uvm_error("SCB_MISMATCH", $sformatf("Data mismatch! Expected: %0h, Actual: %0h", exp.data, txn.data))
        end else begin
          `uvm_info("SCB_MATCH", "Transaction matched successfully!", UVM_LOW)
        end
      end else begin
        `uvm_error("SCB_UNEXPECTED", $sformatf("Unexpected read for ID %0d", txn.id))
      end
    end
  endfunction
endclass
