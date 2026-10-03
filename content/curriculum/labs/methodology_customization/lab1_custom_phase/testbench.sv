`include "uvm_macros.svh"
import uvm_pkg::*;

typedef class soc_env;

// ──────────────────────────────────────────────────
// 1. Custom Phase Definition
// ──────────────────────────────────────────────────

class load_fw_phase_c extends uvm_task_phase;
  // TODO 1a: Declare a static singleton handle
  // local static load_fw_phase_c m_inst;

  function new(string name = "load_fw");
    super.new(name);
  endfunction

  // TODO 1b: Implement the singleton get() method.
  // The schedule holds exactly one node per phase, so every get() must
  // return the same instance.
  // static function load_fw_phase_c get();
  //   ...
  // endfunction

  // TODO 2a: Override exec_task. UVM forks it once per component in the
  // phase's domain; the inherited version does nothing, so without this
  // override your environment code is never called.
  // virtual task exec_task(uvm_component comp, uvm_phase phase);
  //   soc_env env;
  //   if ($cast(env, comp)) env.load_fw_phase(phase);
  // endtask
endclass

// ──────────────────────────────────────────────────
// 2. SoC Environment
// ──────────────────────────────────────────────────

class soc_env extends uvm_env;
  `uvm_component_utils(soc_env)

  bit reset_done;
  bit firmware_loaded;
  bit configure_done;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  task reset_phase(uvm_phase phase);
    phase.raise_objection(this);
    `uvm_info("ORDER", "reset", UVM_LOW)
    #50ns; // Simulate reset duration
    reset_done = 1'b1;
    phase.drop_objection(this);
  endtask

  // TODO 2b: Implement the task that exec_task calls:
  //   task load_fw_phase(uvm_phase phase);
  // It should:
  //   1. Raise an objection
  //   2. Report `uvm_error("ORDER", ...) if reset_done is not set
  //   3. Print `uvm_info("ORDER", "load_fw", UVM_LOW)
  //   4. Wait 20ns to simulate firmware loading, then set firmware_loaded
  //   5. Drop the objection

  task configure_phase(uvm_phase phase);
    phase.raise_objection(this);
    if (!firmware_loaded)
      `uvm_error("ORDER", "Configure phase ran before firmware loading")
    `uvm_info("ORDER", "configure", UVM_LOW)
    #10ns;
    configure_done = 1'b1;
    phase.drop_objection(this);
  endtask

  task main_phase(uvm_phase phase);
    `uvm_info("ORDER", "main", UVM_LOW)
  endtask

  function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    if (!(reset_done && firmware_loaded && configure_done))
      `uvm_error("ORDER", "Expected reset -> load_fw -> configure milestones were not observed")
  endfunction
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

    // TODO 3: Insert load_fw_phase_c after reset_phase. reset lives in the
    // uvm run-time schedule, so call add() on that schedule:
    //   uvm_domain::get_uvm_schedule()
    //     .add(load_fw_phase_c::get(), .after_phase(uvm_reset_phase::get()));
    // (Calling add() on uvm_domain::get_common_domain() instead stops the
    // test with UVM_FATAL [PH_BAD_ADD]: reset cannot be found from there.)
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
