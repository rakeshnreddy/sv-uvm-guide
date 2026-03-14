`include "uvm_macros.svh"
import uvm_pkg::*;

// ──────────────────────────────────────────────────
// 1. Custom Phase Definition (COMPLETE)
// ──────────────────────────────────────────────────

class load_fw_phase extends uvm_task_phase;
  `uvm_object_utils(load_fw_phase)

  static load_fw_phase m_inst;

  function new(string name = "load_fw");
    super.new(name);
  endfunction

  static function load_fw_phase get();
    if (m_inst == null) m_inst = new("load_fw");
    return m_inst;
  endfunction
endclass

// ──────────────────────────────────────────────────
// 2. SoC Environment (COMPLETE)
// ──────────────────────────────────────────────────

class soc_env extends uvm_env;
  `uvm_component_utils(soc_env)

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    `uvm_info("PHASE", "Entering build_phase", UVM_LOW)
  endfunction

  task reset_phase(uvm_phase phase);
    phase.raise_objection(this);
    `uvm_info("PHASE", $sformatf("Entering reset_phase @ %0t", $time), UVM_LOW)
    #50ns; // Simulate reset duration
    phase.drop_objection(this);
  endtask

  // Custom phase implementation
  task load_fw_phase(uvm_phase phase);
    phase.raise_objection(this);
    `uvm_info("PHASE", $sformatf("Entering load_fw_phase @ %0t", $time), UVM_LOW)
    `uvm_info("FW", $sformatf("Loading firmware image... @ %0t", $time), UVM_LOW)
    #20ns; // Simulate firmware loading latency
    `uvm_info("FW", $sformatf("Firmware loaded @ %0t", $time), UVM_LOW)
    phase.drop_objection(this);
  endtask

  task configure_phase(uvm_phase phase);
    phase.raise_objection(this);
    `uvm_info("PHASE", $sformatf("Entering configure_phase @ %0t", $time), UVM_LOW)
    #10ns;
    phase.drop_objection(this);
  endtask

  task main_phase(uvm_phase phase);
    phase.raise_objection(this);
    `uvm_info("PHASE", $sformatf("Entering main_phase @ %0t", $time), UVM_LOW)
    #100ns; // Main stimulus
    phase.drop_objection(this);
  endtask
endclass

// ──────────────────────────────────────────────────
// 3. Base Test (COMPLETE)
// ──────────────────────────────────────────────────

class base_test extends uvm_test;
  `uvm_component_utils(base_test)
  soc_env env;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = soc_env::type_id::create("env", this);

    // Insert custom phase after reset_phase
    uvm_phase reset = uvm_reset_phase::get();
    uvm_domain::get_common_domain()
      .add(load_fw_phase::get(), .after_phase(reset));
  endfunction
endclass

// ──────────────────────────────────────────────────
// 4. Top Module
// ──────────────────────────────────────────────────

module tb_top;
  initial begin
    run_test("base_test");
  end
endmodule
