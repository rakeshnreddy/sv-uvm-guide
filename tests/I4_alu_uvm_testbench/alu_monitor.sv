class alu_monitor extends uvm_monitor;
  `uvm_component_utils(alu_monitor)

  virtual alu_if vif;
  uvm_analysis_port #(alu_transaction) analysis_port;

  function new(string name = "alu_monitor", uvm_component parent = null);
    super.new(name, parent);
    analysis_port = new("analysis_port", this);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
      `uvm_fatal("VIF", "Failed to get virtual interface")
  endfunction

  virtual task run_phase(uvm_phase phase);
    forever begin
      @(posedge vif.clk);
      alu_transaction tx = alu_transaction::type_id::create("tx");
      tx.a = vif.a;
      tx.b = vif.b;
      tx.opcode = vif.opcode;
      analysis_port.write(tx);
    end
  endtask
endclass
