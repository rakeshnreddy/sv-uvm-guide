// config-debug lab: solution version of src/dv/monitor.sv
// Counts the transfers it sees on the bus.
class my_monitor extends uvm_component;
  `uvm_component_utils(my_monitor)

  virtual my_if vif;
  int unsigned  n_seen;

  function new(string name = "my_monitor", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // FIX 2: the field name must match the one tb_top publishes.
    if (!uvm_config_db#(virtual my_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "my_monitor could not get its virtual interface from uvm_config_db")
  endfunction

  task run_phase(uvm_phase phase);
    forever begin
      @(vif.mon_cb);
      if (vif.mon_cb.valid === 1'b1) n_seen++;   // === ignores X before the first drive
    end
  endtask
endclass
