`ifndef ALU_MONITOR_SV
`define ALU_MONITOR_SV

class alu_monitor extends uvm_monitor;
  `uvm_component_utils(alu_monitor)

  virtual alu_if vif;
  uvm_analysis_port #(alu_transaction) item_collected_port;

  function new(string name = "alu_monitor", uvm_component parent = null);
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
      @(vif.monitor_cb);
      if (vif.monitor_cb.start) begin
        alu_transaction item = new();
        item.a = vif.monitor_cb.a;
        item.b = vif.monitor_cb.b;
        item.op = alu_op_e'(vif.monitor_cb.op);
        item_collected_port.write(item);
      end
    end
  endtask

endclass

`endif // ALU_MONITOR_SV
