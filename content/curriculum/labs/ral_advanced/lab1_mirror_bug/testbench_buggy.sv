// ============================================================
// RAL Mirror Bug Lab — BUGGY Testbench
// ============================================================
// Bug: The predictor is instantiated but the bus monitor's
//      analysis port is NOT connected to predictor.bus_in
//      in connect_phase, so the RAL mirror never updates.
// ============================================================

`include "uvm_macros.svh"
import uvm_pkg::*;

// --- Minimal AXI-lite item ---
class axi_item extends uvm_sequence_item;
  `uvm_object_utils(axi_item)
  rand bit [31:0] addr;
  rand bit [31:0] data;
  rand bit        write;

  function new(string name = "axi_item");
    super.new(name);
  endfunction
endclass

// --- AXI-lite adapter ---
class axi_adapter extends uvm_reg_adapter;
  `uvm_object_utils(axi_adapter)

  function new(string name = "axi_adapter");
    super.new(name);
    supports_byte_enable = 0;
    provides_responses   = 0;
  endfunction

  virtual function uvm_sequence_item reg2bus(const ref uvm_reg_bus_op rw);
    axi_item item = axi_item::type_id::create("item");
    item.addr  = rw.addr;
    item.data  = rw.data;
    item.write = (rw.kind == UVM_WRITE);
    return item;
  endfunction

  virtual function void bus2reg(uvm_sequence_item bus_item, ref uvm_reg_bus_op rw);
    axi_item item;
    if (!$cast(item, bus_item))
      `uvm_fatal("CAST", "Bad item type")
    rw.addr   = item.addr;
    rw.data   = item.data;
    rw.kind   = item.write ? UVM_WRITE : UVM_READ;
    rw.status = UVM_IS_OK;
  endfunction
endclass

// --- Simple register ---
class codec_status_reg extends uvm_reg;
  `uvm_object_utils(codec_status_reg)
  rand uvm_reg_field value;

  function new(string name = "codec_status_reg");
    super.new(name, 32, UVM_NO_COVERAGE);
  endfunction

  virtual function void build();
    value = uvm_reg_field::type_id::create("value");
    value.configure(this, 8, 0, "RW", 0, 0, 1, 1, 0);
  endfunction
endclass

// --- Register block ---
class codec_block extends uvm_reg_block;
  `uvm_object_utils(codec_block)
  codec_status_reg status;
  uvm_reg_map cfg_map;

  function new(string name = "codec_block");
    super.new(name);
  endfunction

  virtual function void build();
    status = codec_status_reg::type_id::create("status");
    status.configure(this, null);
    status.build();

    cfg_map = create_map("cfg_map", 'h0, 4, UVM_LITTLE_ENDIAN);
    cfg_map.add_reg(status, 'h00, "RW");
    lock_model();
  endfunction
endclass

// --- Stub monitor (represents your real bus monitor) ---
class axi_monitor extends uvm_monitor;
  `uvm_component_utils(axi_monitor)
  uvm_analysis_port #(axi_item) ap;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    ap = new("ap", this);
  endfunction
endclass

// --- Stub agent ---
class axi_agent extends uvm_agent;
  `uvm_component_utils(axi_agent)
  axi_monitor monitor;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    monitor = axi_monitor::type_id::create("monitor", this);
  endfunction
endclass

// --- Environment (THE BUG IS HERE) ---
class codec_env extends uvm_env;
  `uvm_component_utils(codec_env)

  axi_agent                       axi_agt;
  codec_block                     ral;
  uvm_reg_predictor #(axi_item)  predictor;
  axi_adapter                     adapter;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    axi_agt   = axi_agent::type_id::create("axi_agt", this);
    ral       = codec_block::type_id::create("ral");
    ral.build();
    predictor = uvm_reg_predictor#(axi_item)::type_id::create("predictor", this);
    adapter   = axi_adapter::type_id::create("adapter");
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    predictor.map     = ral.cfg_map;
    predictor.adapter = adapter;

    // ======================================================
    // BUG: The following line is MISSING.
    // Without it, the predictor never receives bus transactions
    // and the RAL mirror stays at reset forever.
    //
    // axi_agt.monitor.ap.connect(predictor.bus_in);
    // ======================================================
  endfunction
endclass
