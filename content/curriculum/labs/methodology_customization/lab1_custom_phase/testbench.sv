`include "uvm_macros.svh"
import uvm_pkg::*;

// ──────────────────────────────────────────────────
// 1. Custom Phase Definition
// ──────────────────────────────────────────────────

class load_fw_phase extends uvm_task_phase;
  `uvm_object_utils(load_fw_phase)

  // TODO: Declare a static singleton handle
  // static load_fw_phase m_inst;

  function new(string name = "load_fw");
    super.new(name);
  endfunction

  // TODO: Implement the singleton get() method
  // The UVM schedule requires exactly one instance of each phase.
  // static function load_fw_phase get();
  //   ...
  // endfunction
endclass

// ──────────────────────────────────────────────────
// 2. SoC Environment
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

  // TODO: Implement load_fw_phase task
  // This task should:
  //   1. Raise an objection
  //   2. Print "Loading firmware image..."
  //   3. Wait 20ns to simulate firmware loading
  //   4. Print "Firmware loaded"
  //   5. Drop the objection

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
// 3. Base Test
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

    // TODO: Insert load_fw_phase into the common domain schedule
    // after reset_phase using:
    //   uvm_phase reset = uvm_reset_phase::get();
    //   uvm_domain::get_common_domain()
    //     .add(load_fw_phase::get(), .after_phase(reset));
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
