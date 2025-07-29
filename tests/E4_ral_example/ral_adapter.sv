`include "uvm_macros.svh"

class ral_adapter extends uvm_reg_adapter;
  `uvm_object_utils(ral_adapter)

  function new(string name = "ral_adapter");
    super.new(name);
  endfunction

  virtual function uvm_sequence_item reg2bus(const ref uvm_reg_bus_op rw);
    bus_seq_item tx = bus_seq_item::type_id::create("tx");
    tx.addr = rw.addr;
    tx.data = rw.data;
    tx.kind = (rw.kind == UVM_READ) ? READ : WRITE;
    return tx;
  endfunction

  virtual function void bus2reg(uvm_sequence_item bus_item, ref uvm_reg_bus_op rw);
    bus_seq_item tx;
    if (!$cast(tx, bus_item)) begin
      `uvm_fatal("ADAPT", "Could not cast bus_item to bus_seq_item")
    end
    rw.kind = (tx.kind == READ) ? UVM_READ : UVM_WRITE;
    rw.addr = tx.addr;
    rw.data = tx.data;
    rw.status = UVM_IS_OK;
  endfunction
endclass
