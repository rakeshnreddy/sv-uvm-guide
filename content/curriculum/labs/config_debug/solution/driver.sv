// config-debug lab: solution version of src/dv/driver.sv
// A pin-wiggling component standing in for a uvm_driver: it needs only a
// virtual interface and a count, so the lab can focus on configuration.
class my_driver extends uvm_component;
  `uvm_component_utils(my_driver)

  virtual my_if.driver_mp vif;
  int unsigned            num_pkts;   // set by my_agent before this build_phase runs
  bit                     done;       // the test waits for this

  function new(string name = "my_driver", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    virtual my_if base_vif;
    super.build_phase(phase);
    // FIX 1: tb_top publishes virtual my_if, so ask for exactly that type, then
    // narrow it to the modport view (legal: IEEE 1800-2023 §25.9).
    if (!uvm_config_db#(virtual my_if)::get(this, "", "vif", base_vif))
      `uvm_fatal("NO_VIF", "my_driver could not get its virtual interface from uvm_config_db")
    vif = base_vif;
  endfunction

  task run_phase(uvm_phase phase);
    for (int unsigned i = 0; i < num_pkts; i++) begin
      @(vif.driver_cb);
      `uvm_info("DRV", "Driving pins through the clocking block", UVM_LOW)
      vif.driver_cb.valid <= 1'b1;
      vif.driver_cb.data  <= 8'(i);
    end
    @(vif.driver_cb);
    vif.driver_cb.valid <= 1'b0;
    @(vif.driver_cb);   // one more edge, so the monitor has counted the last transfer
    done = 1;
  endtask
endclass
