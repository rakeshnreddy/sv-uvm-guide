class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  my_monitor    mon;
  my_scoreboard scb;
  
  uvm_tlm_analysis_fifo #(my_txn) sb_fifo;

  function new(string name="my_env", uvm_component parent=null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    mon = my_monitor::type_id::create("mon", this);
    scb = my_scoreboard::type_id::create("scb", this);
    
    sb_fifo = new("sb_fifo", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    mon.ap.connect(sb_fifo.analysis_export);
    scb.get_port.connect(sb_fifo.get_export);
  endfunction
endclass
