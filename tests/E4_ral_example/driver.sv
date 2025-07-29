`include "uvm_macros.svh"

class driver extends uvm_driver #(bus_seq_item);
  `uvm_component_utils(driver)

  virtual bus_if vif;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual bus_if)::get(this, "", "vif", vif))
      `uvm_fatal("NOVIF", "Could not get virtual interface")
  endfunction

  virtual task run_phase(uvm_phase phase);
    forever begin
      seq_item_port.get_next_item(req);
      vif.req <= 1;
      vif.rw <= (req.kind == WRITE);
      vif.addr <= req.addr;
      if (req.kind == WRITE)
        vif.wdata <= req.data;

      wait (vif.gnt);
      @(posedge vif.clk);
      vif.req <= 0;

      if (req.kind == READ)
        req.data = vif.rdata;

      seq_item_port.item_done();
    end
  endtask
endclass
