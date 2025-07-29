`ifndef ALU_DRIVER_SV
`define ALU_DRIVER_SV

class alu_driver extends uvm_driver #(alu_transaction);
  `uvm_component_utils(alu_driver)

  virtual alu_if vif;

  function new(string name = "alu_driver", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", vif))
      `uvm_fatal("NOVIF", "Could not get virtual interface")
  endfunction

  virtual task run_phase(uvm_phase phase);
    forever begin
      seq_item_port.get_next_item(req);
      drive_item(req);
      seq_item_port.item_done();
    end
  endtask

  virtual task drive_item(alu_transaction tx);
      vif.driver_cb.start <= 1;
      vif.driver_cb.a <= tx.a;
      vif.driver_cb.b <= tx.b;
      vif.driver_cb.op <= tx.op;
      @(vif.driver_cb);
      vif.driver_cb.start <= 0;
  endtask

endclass

`endif // ALU_DRIVER_SV
