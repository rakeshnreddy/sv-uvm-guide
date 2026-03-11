class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  my_monitor    mon;
  my_scoreboard scb;
  
  // TODO: Declare a uvm_tlm_analysis_fifo #(my_txn) here named sb_fifo

  function new(string name="my_env", uvm_component parent=null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    mon = my_monitor::type_id::create("mon", this);
    scb = my_scoreboard::type_id::create("scb", this);
    
    // TODO: Create the FIFO in the factory
  endfunction

  function void connect_phase(uvm_phase phase);
    // TODO: Disconnect this direct connection.
    // Instead, route mon.ap -> sb_fifo.analysis_export
    // and set up scb to pull from sb_fifo.get_export (optional depending on scb port type)
    mon.ap.connect(scb.analysis_export);
  endfunction
endclass
