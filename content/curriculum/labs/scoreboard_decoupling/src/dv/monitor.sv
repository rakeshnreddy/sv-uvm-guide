class my_monitor extends uvm_monitor;
  `uvm_component_utils(my_monitor)
  uvm_analysis_port #(my_txn) ap;
  decoupling_lab_config cfg;
  
  function new(string name="my_monitor", uvm_component parent=null);
    super.new(name, parent);
    ap = new("ap", this);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(decoupling_lab_config)::get(this, "", "cfg", cfg))
      `uvm_fatal("NO_CFG", "decoupling_lab_config is not configured")
  endfunction

  task run_phase(uvm_phase phase);
    my_txn txn;
    repeat (cfg.transaction_count) begin
      #10ns; // Dedicated finite synthetic producer tick.
      txn = my_txn::type_id::create("txn", this);
      if (!txn.randomize())
        `uvm_fatal("RANDFAIL", "Unable to randomize synthetic monitor transaction")
      `uvm_info("MON", $sformatf("Broadcasting txn data: %h", txn.data), UVM_LOW)
      ap.write(txn);
    end
    `uvm_info("MON", $sformatf("Published %0d transactions", cfg.transaction_count), UVM_LOW)
  endtask
endclass
