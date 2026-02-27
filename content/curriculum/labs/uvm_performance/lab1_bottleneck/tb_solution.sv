class packet extends uvm_sequence_item;
  rand int id;
  rand int data;
  `uvm_object_utils(packet)
  function new(string name = "packet"); super.new(name); endfunction
endclass

class my_monitor extends uvm_monitor;
  `uvm_component_utils(my_monitor)
  uvm_analysis_port #(packet) ap;

  function new(string name, uvm_component parent);
    super.new(name, parent);
    ap = new("ap", this);
  endfunction

  task run_phase(uvm_phase phase);
    packet p;
    for (int i = 0; i < 5000; i++) begin
      p = packet::type_id::create("p");
      p.id = i;
      p.data = $urandom;
      #1; // Simulate clock delay
      ap.write(p);
    end
  endtask
endclass

class my_fast_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(my_fast_scoreboard)
  
  // Decoupled GET port instead of blocking analysis imp
  uvm_get_port #(packet) get_export;
  
  // Associative array instead of queue for O(1) lookups
  packet expected_aa[int];

  function new(string name, uvm_component parent);
    super.new(name, parent);
    get_export = new("get_export", this);
  endfunction

  task run_phase(uvm_phase phase);
    packet p;
    forever begin
      get_export.get(p); // Pulls from FIFO asynchronously
      
      expected_aa[p.id] = p; // O(1) store
      
      if (!expected_aa.exists(p.id)) begin
        `uvm_error("SCB", "Packet lost!")
      end
    end
  endtask
endclass

class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  my_monitor mon;
  my_fast_scoreboard scb;
  uvm_tlm_analysis_fifo #(packet) scb_fifo; // The missing architectural link

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    mon = my_monitor::type_id::create("mon", this);
    scb = my_fast_scoreboard::type_id::create("scb", this);
    scb_fifo = new("scb_fifo", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    // Monitor pushes to FIFO independently
    mon.ap.connect(scb_fifo.analysis_export);
    // Scoreboard pulls from FIFO independently
    scb.get_export.connect(scb_fifo.get_export);
  endfunction
endclass
