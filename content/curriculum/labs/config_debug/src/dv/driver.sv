class my_driver extends uvm_component;
  `uvm_component_utils(my_driver)
  
  virtual my_if.driver_mp vif;

  function new(string name="my_driver", uvm_component parent=null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    
    // DELIBERATE BUG: Looking for "vif" but the top testbench sets "viiif"
    if (!uvm_config_db#(virtual my_if.driver_mp)::get(this, "", "vif", vif)) begin
      `uvm_fatal("NO_VIF", "The virtual interface handle in my_driver is null. Ensure it was set in the config_db.")
    end
  endfunction

  task run_phase(uvm_phase phase);
    vif.driver_cb.valid <= 1'b0;
    repeat (4) begin
      @(vif.driver_cb);
      `uvm_info("DRV", "Driving pins through the clocking block", UVM_LOW)
      vif.driver_cb.valid <= 1'b1;
      vif.driver_cb.data <= $urandom;
    end
    @(vif.driver_cb);
    vif.driver_cb.valid <= 1'b0;
  endtask
endclass
