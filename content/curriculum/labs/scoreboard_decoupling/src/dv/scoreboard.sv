class my_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(my_scoreboard)
  
  uvm_blocking_get_port #(my_txn) get_port;
  decoupling_lab_config cfg;
  int unsigned processed_count;
  event all_processed;

  function new(string name="my_scoreboard", uvm_component parent=null);
    super.new(name, parent);
    get_port = new("get_port", this);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(decoupling_lab_config)::get(this, "", "cfg", cfg))
      `uvm_fatal("NO_CFG", "decoupling_lab_config is not configured")
  endfunction

  task run_phase(uvm_phase phase);
    my_txn t;
    forever begin
      get_port.get(t);
      `uvm_info("SLOW_CONSUMER", $sformatf("Processing txn data: %h", t.data), UVM_LOW)
      #(cfg.consumer_delay);
      processed_count++;
      if (processed_count == cfg.transaction_count)
        -> all_processed;
    end
  endtask

  task wait_until_complete();
    if (processed_count < cfg.transaction_count)
      @all_processed;
  endtask

  function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    if (processed_count != cfg.transaction_count)
      `uvm_error("COUNT", $sformatf("Processed %0d of %0d transactions",
                                    processed_count, cfg.transaction_count))
  endfunction
endclass
