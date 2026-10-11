// Reads one optional knob and builds the driver and the monitor.
class my_agent extends uvm_component;
  `uvm_component_utils(my_agent)

  my_driver    drv;
  my_monitor   mon;
  int unsigned num_pkts = 2;   // used when nobody configures num_pkts

  function new(string name = "my_agent", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // Optional setting: keep the default when the lookup misses.
    void'(uvm_config_db#(int unsigned)::get(this, "", "num_pkts", num_pkts));
    `uvm_info("AGT", $sformatf("num_pkts=%0d", num_pkts), UVM_LOW)
    drv = my_driver::type_id::create("drv", this);
    drv.num_pkts = num_pkts;
    mon = my_monitor::type_id::create("mon", this);
  endfunction
endclass
