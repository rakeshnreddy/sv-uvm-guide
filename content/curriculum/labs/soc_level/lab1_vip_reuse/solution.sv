`include "uvm_macros.svh"
import uvm_pkg::*;

// ──────────────────────────────────────────────────
// Block-Level VIP (COMPLETE)
// ──────────────────────────────────────────────────

class spi_agent extends uvm_agent;
  `uvm_component_utils(spi_agent)

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    
    if (!uvm_config_db#(uvm_active_passive_enum)::get(this, "", "is_active", is_active)) begin
      is_active = UVM_ACTIVE;
    end

    if (is_active == UVM_ACTIVE) begin
      `uvm_info("SPI_AGT", "Creating driver and sequencer for ACTIVE mode", UVM_LOW)
    end else begin
      `uvm_info("SPI_AGT", "Operating in PASSIVE mode (monitors only)", UVM_LOW)
    end
  endfunction
endclass

// ──────────────────────────────────────────────────
// SOC Environment & Test (COMPLETE)
// ──────────────────────────────────────────────────

class soc_env extends uvm_env;
  `uvm_component_utils(soc_env)
  spi_agent spi_agt;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    spi_agt = spi_agent::type_id::create("spi_agt", this);
  endfunction
  
  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    #10ns;
    `uvm_info("FIRMWARE", "Processor driving WRITE to SPI_CTRL = 0x1", UVM_LOW)
    #5ns;
    `uvm_info("SPI_MON", "Observed APB WRITE to SPI_CTRL = 0x1", UVM_LOW)
    if (spi_agt.is_active == UVM_ACTIVE) begin
       `uvm_fatal("BUS_COLLISION", "UVM Driver and SoC Processor are both driving the bus!")
    end
    phase.drop_objection(this);
  endtask
endclass

class soc_test extends uvm_test;
  `uvm_component_utils(soc_test)
  soc_env env;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    
    // FIX: Set the SPI agent to passive mode so the firmware can drive the bus
    uvm_config_db#(uvm_active_passive_enum)::set(this, "env.spi_agt", "is_active", UVM_PASSIVE);
    
    env = soc_env::type_id::create("env", this);
  endfunction
endclass

// ──────────────────────────────────────────────────
// Top Module
// ──────────────────────────────────────────────────
module tb_top;
  initial begin
    run_test("soc_test");
  end
endmodule
