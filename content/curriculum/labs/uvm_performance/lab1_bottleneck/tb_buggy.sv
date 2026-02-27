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

class my_slow_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(my_slow_scoreboard)
  uvm_analysis_imp #(packet, my_slow_scoreboard) export_in;
  packet expected_q[$];

  function new(string name, uvm_component parent);
    super.new(name, parent);
    export_in = new("export_in", this);
  endfunction

  function void write(packet p);
    // INEFFECTIVE LOOKUP: O(N) search simulating a deep loop bottleneck
    int found = 0;
    expected_q.push_back(p);
    
    // Simulate awful performance on every packet
    foreach(expected_q[i]) begin
      if (expected_q[i].id == p.id) begin
        found = 1;
        // Do not break early to show worst-case
      end
    end
    if (!found) `uvm_error("SCB", "Packet lost!")
  endfunction
endclass

class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  my_monitor mon;
  my_slow_scoreboard scb;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    mon = my_monitor::type_id::create("mon", this);
    scb = my_slow_scoreboard::type_id::create("scb", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    // Tightly coupled write!
    mon.ap.connect(scb.export_in);
  endfunction
endclass
