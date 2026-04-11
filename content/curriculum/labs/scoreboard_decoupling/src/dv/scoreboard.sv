class my_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(my_scoreboard)
  
  uvm_blocking_get_port #(my_txn) get_port;

  function new(string name="my_scoreboard", uvm_component parent=null);
    super.new(name, parent);
    get_port = new("get_port", this);
  endfunction

  task run_phase(uvm_phase phase);
    my_txn t;
    forever begin
      get_port.get(t);
      $display("@%0t [SCB] Received txn data: %h. Processing...", $time, t.data);
      // Simulate slow hardware processing (this no longer blocks the monitor!)
      #30;
      $display("@%0t [SCB] Finished processing.", $time);
    end
  endtask
endclass
