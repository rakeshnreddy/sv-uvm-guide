class my_driver extends uvm_driver;
  `uvm_component_utils(my_driver)
  
  virtual my_if vif;

  function new(string name="my_driver", uvm_component parent=null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    
    // DELIBERATE BUG: Looking for "vif" but the top testbench sets "viiif"
    if (!uvm_config_db#(virtual my_if)::get(this, "", "vif", vif)) begin
      `uvm_fatal("NO_VIF", "The virtual interface handle in my_driver is null. Ensure it was set in the config_db.")
    end
  endfunction

  task run_phase(uvm_phase phase);
    forever begin
      @(posedge vif.clk);
      $display("@%0t [DRV] Wiggling pins", $time);
      vif.valid <= 1;
      vif.data <= $urandom;
      #10;
    end
  endtask
endclass
