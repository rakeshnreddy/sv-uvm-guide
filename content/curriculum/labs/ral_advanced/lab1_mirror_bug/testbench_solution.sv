`include "uvm_macros.svh"
import uvm_pkg::*;

interface codec_bus_if(input logic clk, input logic rst_n);
  logic valid;
  logic write;
  logic [31:0] addr;
  logic [31:0] wdata;
  logic [31:0] rdata;
  logic ready;

  clocking driver_cb @(posedge clk);
    default input #1step output #0;
    output valid, write, addr, wdata;
    input ready, rdata, rst_n;
  endclocking

  clocking monitor_cb @(posedge clk);
    default input #0;
    input valid, write, addr, wdata, rdata, ready, rst_n;
  endclocking

  modport driver_mp(clocking driver_cb);
  modport monitor_mp(clocking monitor_cb);
endinterface

module codec_dut(codec_bus_if bus);
  logic [31:0] status_reg;
  assign bus.ready = 1'b1;
  assign bus.rdata = status_reg;

  always_ff @(posedge bus.clk or negedge bus.rst_n) begin
    if (!bus.rst_n)
      status_reg <= '0;
    else if (bus.valid && bus.ready && bus.write && bus.addr == 32'h0)
      status_reg <= bus.wdata;
  end
endmodule

class axi_item extends uvm_sequence_item;
  rand bit [31:0] addr;
  rand bit [31:0] data;
  rand bit write;

  `uvm_object_utils_begin(axi_item)
    `uvm_field_int(addr, UVM_ALL_ON)
    `uvm_field_int(data, UVM_ALL_ON)
    `uvm_field_int(write, UVM_ALL_ON)
  `uvm_object_utils_end

  function new(string name = "axi_item"); super.new(name); endfunction
endclass

typedef uvm_sequencer #(axi_item) axi_sequencer;

class axi_adapter extends uvm_reg_adapter;
  `uvm_object_utils(axi_adapter)

  function new(string name = "axi_adapter");
    super.new(name);
    supports_byte_enable = 0;
    provides_responses = 0;
  endfunction

  virtual function uvm_sequence_item reg2bus(const ref uvm_reg_bus_op rw);
    axi_item item = axi_item::type_id::create("item");
    item.addr = rw.addr;
    item.data = rw.data;
    item.write = (rw.kind == UVM_WRITE);
    return item;
  endfunction

  virtual function void bus2reg(uvm_sequence_item bus_item, ref uvm_reg_bus_op rw);
    axi_item item;
    if (!$cast(item, bus_item)) begin
      rw.status = UVM_NOT_OK;
      `uvm_error("CAST", "Expected axi_item")
      return;
    end
    rw.addr = item.addr;
    rw.data = item.data;
    rw.kind = item.write ? UVM_WRITE : UVM_READ;
    rw.status = UVM_IS_OK;
  endfunction
endclass

class axi_driver extends uvm_driver #(axi_item);
  `uvm_component_utils(axi_driver)
  virtual codec_bus_if.driver_mp vif;

  function new(string name, uvm_component parent); super.new(name, parent); endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual codec_bus_if.driver_mp)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "codec bus driver interface is not configured")
  endfunction

  task run_phase(uvm_phase phase);
    axi_item item;
    vif.driver_cb.valid <= 1'b0;
    do @(vif.driver_cb); while (!vif.driver_cb.rst_n);
    forever begin
      seq_item_port.get_next_item(item);
      vif.driver_cb.valid <= 1'b1;
      vif.driver_cb.write <= item.write;
      vif.driver_cb.addr <= item.addr;
      vif.driver_cb.wdata <= item.data;
      do @(vif.driver_cb); while (!vif.driver_cb.ready);
      if (!item.write)
        item.data = vif.driver_cb.rdata;
      vif.driver_cb.valid <= 1'b0;
      seq_item_port.item_done();
    end
  endtask
endclass

class axi_monitor extends uvm_monitor;
  `uvm_component_utils(axi_monitor)
  virtual codec_bus_if.monitor_mp vif;
  uvm_analysis_port #(axi_item) ap;

  function new(string name, uvm_component parent); super.new(name, parent); endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    ap = new("ap", this);
    if (!uvm_config_db#(virtual codec_bus_if.monitor_mp)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "codec bus monitor interface is not configured")
  endfunction

  task run_phase(uvm_phase phase);
    forever begin
      @(vif.monitor_cb);
      if (vif.monitor_cb.rst_n && vif.monitor_cb.valid && vif.monitor_cb.ready) begin
        axi_item item = axi_item::type_id::create("observed", this);
        item.addr = vif.monitor_cb.addr;
        item.write = vif.monitor_cb.write;
        item.data = item.write ? vif.monitor_cb.wdata : vif.monitor_cb.rdata;
        ap.write(item);
      end
    end
  endtask
endclass

class axi_agent extends uvm_agent;
  `uvm_component_utils(axi_agent)
  axi_sequencer sequencer;
  axi_driver driver;
  axi_monitor monitor;

  function new(string name, uvm_component parent); super.new(name, parent); endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    monitor = axi_monitor::type_id::create("monitor", this);
    if (get_is_active() == UVM_ACTIVE) begin
      sequencer = axi_sequencer::type_id::create("sequencer", this);
      driver = axi_driver::type_id::create("driver", this);
    end
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    if (get_is_active() == UVM_ACTIVE)
      driver.seq_item_port.connect(sequencer.seq_item_export);
  endfunction
endclass

class codec_status_reg extends uvm_reg;
  `uvm_object_utils(codec_status_reg)
  rand uvm_reg_field value;

  function new(string name = "codec_status_reg");
    super.new(name, 32, UVM_NO_COVERAGE);
  endfunction

  virtual function void build();
    value = uvm_reg_field::type_id::create("value");
    value.configure(this, 32, 0, "RW", 0, 0, 1, 1, 0);
  endfunction
endclass

class codec_block extends uvm_reg_block;
  `uvm_object_utils(codec_block)
  codec_status_reg status;
  uvm_reg_map cfg_map;

  function new(string name = "codec_block"); super.new(name); endfunction

  virtual function void build();
    status = codec_status_reg::type_id::create("status");
    status.configure(this, null);
    status.build();
    cfg_map = create_map("cfg_map", 'h0, 4, UVM_LITTLE_ENDIAN);
    cfg_map.add_reg(status, 'h0, "RW");
    lock_model();
  endfunction
endclass

class codec_env extends uvm_env;
  `uvm_component_utils(codec_env)
  axi_agent axi_agt;
  codec_block ral;
  uvm_reg_predictor #(axi_item) predictor;
  axi_adapter adapter;

  function new(string name, uvm_component parent); super.new(name, parent); endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    axi_agt = axi_agent::type_id::create("axi_agt", this);
    ral = codec_block::type_id::create("ral");
    ral.build();
    predictor = uvm_reg_predictor#(axi_item)::type_id::create("predictor", this);
    adapter = axi_adapter::type_id::create("adapter");
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    ral.cfg_map.set_sequencer(axi_agt.sequencer, adapter);
    ral.cfg_map.set_auto_predict(0);
    predictor.map = ral.cfg_map;
    predictor.adapter = adapter;
    axi_agt.monitor.ap.connect(predictor.bus_in);
  endfunction
endclass

class codec_test extends uvm_test;
  `uvm_component_utils(codec_test)
  codec_env env;

  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = codec_env::type_id::create("env", this);
  endfunction

  task run_phase(uvm_phase phase);
    uvm_status_e status;
    uvm_reg_data_t value;
    phase.raise_objection(this);

    env.ral.status.write(status, 32'h55, UVM_FRONTDOOR, env.ral.cfg_map, null);
    if (status != UVM_IS_OK)
      `uvm_error("WRITE", "Frontdoor register write failed")
    env.ral.status.read(status, value, UVM_FRONTDOOR, env.ral.cfg_map, null);
    if (status != UVM_IS_OK || value != 32'h55)
      `uvm_error("READ", $sformatf("Expected 0x55, read 0x%0h", value))
    env.ral.status.mirror(status, UVM_CHECK, UVM_FRONTDOOR, env.ral.cfg_map, null);
    if (status != UVM_IS_OK || env.ral.status.get_mirrored_value() != 32'h55)
      `uvm_error("MIRROR", "Explicit predictor did not update the mirror")

    phase.drop_objection(this);
  endtask
endclass

module tb_top;
  logic clk = 1'b0;
  logic rst_n = 1'b0;
  always #5ns clk = ~clk;
  codec_bus_if bus(clk, rst_n);
  codec_dut dut(bus);

  initial begin
    repeat (3) @(posedge clk);
    rst_n = 1'b1;
  end

  initial begin
    uvm_config_db#(virtual codec_bus_if.driver_mp)::set(null, "*", "vif", bus);
    uvm_config_db#(virtual codec_bus_if.monitor_mp)::set(null, "*", "vif", bus);
    run_test("codec_test");
  end
endmodule
