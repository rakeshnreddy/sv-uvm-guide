class alu_monitor extends uvm_monitor;
  `uvm_component_utils(alu_monitor)

  virtual alu_if vif;
  uvm_analysis_port #(alu_transaction) item_collected_port;

  function new(string name = "alu_monitor", uvm_component parent = null);
    super.new(name, parent);
    item_collected_port = new("item_collected_port", this);
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
      tx.op = alu_op_e'(vif.op);
      item_collected_port.write(tx);
    end
  endtask
endclass
