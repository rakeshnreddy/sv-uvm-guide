`ifndef MONITOR_SV
`define MONITOR_SV

class monitor extends uvm_monitor;
  `uvm_component_utils(monitor)

  virtual alu_if vif;
  uvm_analysis_port #(sequence_item) item_collected_port;

  function new(string name = "monitor", uvm_component parent = null);
    super.new(name, parent);
    item_collected_port = new("item_collected_port", this);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
      `uvm_fatal("NOVIF", "Could not get virtual interface")
  endfunction

  virtual task run_phase(uvm_phase phase);
    forever begin
      sequence_item item = new();
      @(vif.monitor_cb);
      item.a = vif.monitor_cb.a;
      item.b = vif.monitor_cb.b;
      item.op = vif.monitor_cb.op;
      item_collected_port.write(item);
    end
  endtask

endclass

`endif // MONITOR_SV
