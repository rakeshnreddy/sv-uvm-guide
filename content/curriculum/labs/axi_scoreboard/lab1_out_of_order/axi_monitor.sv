class axi_transaction extends uvm_sequence_item;
  `uvm_object_utils(axi_transaction)
  
  bit [31:0] addr;
  int        id;
  bit [31:0] data;
  bit        is_write;
  
  function new(string name="axi_transaction");
    super.new(name);
  endfunction

  function string convert2string();
    return $sformatf("%s ID=%0d ADDR=0x%08h DATA=0x%08h", 
      is_write ? "WRITE" : "READ", id, addr, data);
  endfunction

  function bit compare(axi_transaction rhs);
    return (this.id == rhs.id && this.addr == rhs.addr && this.data == rhs.data && this.is_write == rhs.is_write);
  endfunction
endclass

class axi_monitor extends uvm_monitor;
  `uvm_component_utils(axi_monitor)

  uvm_analysis_port #(axi_transaction) ap;
  virtual axi_if vif;

  // Associative array to hold pending reads until R channel completes
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
      // TODO: 1. Check if ARVALID and ARREADY are high
      // TODO: 2. If so, create a new axi_transaction
      // TODO: 3. Set addr = ARADDR, id = ARID, is_write = 0
      // TODO: 4. Store it in pending_reads keyed by ARID
      
      // --- YOUR CODE HERE ---
      
      // ----------------------
    end
  endtask

  virtual task monitor_r_channel();
    forever begin
      @(posedge vif.ACLK);
      // TODO: 1. Check if RVALID and RREADY and RLAST are high (completion of read)
      // TODO: 2. If so, extract the ARID from the interface (vif.RID)
      // TODO: 3. Look up the pending transaction in pending_reads
      // TODO: 4. Assign the data = RDATA
      // TODO: 5. Write the completed transaction to the analysis port (ap.write(txn))
      // TODO: 6. Delete the entry from pending_reads
      
      // --- YOUR CODE HERE ---
      
      // ----------------------
    end
  endtask
endclass
