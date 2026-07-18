`include "uvm_macros.svh"
import uvm_pkg::*;

interface spi_bus_if(input logic clk);
  logic vip_drive_en;
  logic vip_cs_n;
  logic [7:0] vip_mosi;
  logic firmware_drive_en;
  logic firmware_cs_n;
  logic [7:0] firmware_mosi;
  wire cs_n = vip_drive_en ? vip_cs_n : firmware_cs_n;
  wire [7:0] mosi = vip_drive_en ? vip_mosi : firmware_mosi;

  clocking vip_driver_cb @(posedge clk);
    output vip_drive_en, vip_cs_n, vip_mosi;
  endclocking

  clocking monitor_cb @(posedge clk);
    input cs_n, mosi, vip_drive_en, firmware_drive_en;
  endclocking

  modport vip_driver_mp(clocking vip_driver_cb);
  modport monitor_mp(clocking monitor_cb);

  no_multiple_driver_intent: assert property (@(posedge clk)
    !(vip_drive_en && firmware_drive_en))
    else $error("SPI bus collision: VIP and firmware both intend to drive");
endinterface

class spi_transfer extends uvm_sequence_item;
  rand bit [7:0] data;
  `uvm_object_utils_begin(spi_transfer)
    `uvm_field_int(data, UVM_ALL_ON)
  `uvm_object_utils_end
  function new(string name = "spi_transfer"); super.new(name); endfunction
endclass

typedef uvm_sequencer #(spi_transfer) spi_sequencer;

class spi_driver extends uvm_driver #(spi_transfer);
  `uvm_component_utils(spi_driver)
  virtual spi_bus_if.vip_driver_mp vif;

  function new(string name, uvm_component parent); super.new(name, parent); endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual spi_bus_if.vip_driver_mp)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "SPI driver interface is not configured")
  endfunction

  task run_phase(uvm_phase phase);
    spi_transfer txn;
    vif.vip_driver_cb.vip_drive_en <= 1'b0;
    forever begin
      seq_item_port.get_next_item(txn);
      @(vif.vip_driver_cb);
      vif.vip_driver_cb.vip_drive_en <= 1'b1;
      vif.vip_driver_cb.vip_cs_n <= 1'b0;
      vif.vip_driver_cb.vip_mosi <= txn.data;
      @(vif.vip_driver_cb);
      vif.vip_driver_cb.vip_cs_n <= 1'b1;
      vif.vip_driver_cb.vip_drive_en <= 1'b0;
      seq_item_port.item_done();
    end
  endtask
endclass

class spi_monitor extends uvm_monitor;
  `uvm_component_utils(spi_monitor)
  virtual spi_bus_if.monitor_mp vif;
  uvm_analysis_port #(spi_transfer) ap;
  event observed_transfer;
  int unsigned observed_count;

  function new(string name, uvm_component parent); super.new(name, parent); endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    ap = new("ap", this);
    if (!uvm_config_db#(virtual spi_bus_if.monitor_mp)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "SPI monitor interface is not configured")
  endfunction

  task run_phase(uvm_phase phase);
    forever begin
      @(vif.monitor_cb);
      if (!vif.monitor_cb.cs_n) begin
        spi_transfer txn = spi_transfer::type_id::create("observed", this);
        txn.data = vif.monitor_cb.mosi;
        observed_count++;
        ap.write(txn);
        -> observed_transfer;
        `uvm_info("SPI_MON", $sformatf("Observed bus data 0x%02h", txn.data), UVM_LOW)
      end
    end
  endtask
endclass

class spi_agent extends uvm_agent;
  `uvm_component_utils(spi_agent)
  spi_monitor monitor;
  spi_sequencer sequencer;
  spi_driver driver;

  function new(string name, uvm_component parent); super.new(name, parent); endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    monitor = spi_monitor::type_id::create("monitor", this);
    if (get_is_active() == UVM_ACTIVE) begin
      sequencer = spi_sequencer::type_id::create("sequencer", this);
      driver = spi_driver::type_id::create("driver", this);
    end
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    if (get_is_active() == UVM_ACTIVE)
      driver.seq_item_port.connect(sequencer.seq_item_export);
  endfunction
endclass

class soc_env extends uvm_env;
  `uvm_component_utils(soc_env)
  spi_agent spi_agt;
  function new(string name, uvm_component parent); super.new(name, parent); endfunction
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    spi_agt = spi_agent::type_id::create("spi_agt", this);
  endfunction
endclass

class soc_test extends uvm_test;
  `uvm_component_utils(soc_test)
  soc_env env;

  function new(string name, uvm_component parent); super.new(name, parent); endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    uvm_config_db#(uvm_active_passive_enum)::set(
      this, "env.spi_agt", "is_active", UVM_PASSIVE
    );
    env = soc_env::type_id::create("env", this);
  endfunction

  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    @env.spi_agt.monitor.observed_transfer;
    if (env.spi_agt.monitor.observed_count == 0)
      `uvm_error("NO_TRAFFIC", "Passive VIP did not observe firmware traffic")
    phase.drop_objection(this);
  endtask
endclass

module tb_top;
  logic clk = 1'b0;
  always #5ns clk = ~clk;
  spi_bus_if spi_vif(clk);

  initial begin
    spi_vif.vip_drive_en = 1'b0;
    spi_vif.firmware_drive_en = 1'b0;
    spi_vif.firmware_cs_n = 1'b1;
    spi_vif.firmware_mosi = '0;
    uvm_config_db#(virtual spi_bus_if.vip_driver_mp)::set(null, "*", "vif", spi_vif);
    uvm_config_db#(virtual spi_bus_if.monitor_mp)::set(null, "*", "vif", spi_vif);
    run_test("soc_test");
  end

  // Firmware BFM owns the bus while the reusable VIP is passive.
  initial begin
    repeat (4) @(posedge clk);
    spi_vif.firmware_drive_en <= 1'b1;
    spi_vif.firmware_cs_n <= 1'b0;
    spi_vif.firmware_mosi <= 8'hA5;
    @(posedge clk);
    spi_vif.firmware_cs_n <= 1'b1;
    spi_vif.firmware_drive_en <= 1'b0;
  end
endmodule
