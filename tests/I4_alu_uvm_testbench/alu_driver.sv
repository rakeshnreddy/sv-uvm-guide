class alu_driver extends uvm_driver #(alu_transaction);
  `uvm_component_utils(alu_driver)

  virtual alu_if vif;

  function new(string name = "alu_driver", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
      `uvm_fatal("VIF", "Failed to get virtual interface")
  endfunction

  virtual task run_phase(uvm_phase phase);
    forever begin
      seq_item_port.get_next_item(req);
      vif.driver_cb.start <= 1;
      vif.driver_cb.a <= req.a;
      vif.driver_cb.b <= req.b;
      vif.driver_cb.op <= req.op;
      @(vif.driver_cb);
      vif.driver_cb.start <= 0;
      seq_item_port.item_done();
    end
  endtask
endclass
