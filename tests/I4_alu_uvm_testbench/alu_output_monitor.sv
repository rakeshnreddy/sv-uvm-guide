`ifndef ALU_OUTPUT_MONITOR_SV
`define ALU_OUTPUT_MONITOR_SV

class alu_output_monitor extends uvm_monitor;
  `uvm_component_utils(alu_output_monitor)

  virtual alu_if vif;
  uvm_analysis_port #(alu_transaction) item_collected_port;

  function new(string name = "alu_output_monitor", uvm_component parent = null);
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
      if (vif.monitor_cb.done) begin
        alu_transaction item = new();
        item.result = vif.monitor_cb.result;
        item_collected_port.write(item);
      end
    end
  endtask

endclass

`endif // ALU_OUTPUT_MONITOR_SV
