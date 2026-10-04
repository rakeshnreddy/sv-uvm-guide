`include "uvm_macros.svh"
import uvm_pkg::*;

typedef class soc_env;

// ──────────────────────────────────────────────────
// 1. Custom Phase Definition
// ──────────────────────────────────────────────────

// A phase is a singleton: every get() returns the same instance, which is
// the node add() inserts into the schedule.
class load_fw_phase_c extends uvm_task_phase;
  local static load_fw_phase_c m_inst;

  function new(string name = "load_fw");
    super.new(name);
  endfunction

  static function load_fw_phase_c get();
    if (m_inst == null)
      m_inst = new("load_fw");
    return m_inst;
  endfunction

  // UVM forks this once per component in the phase's domain. The inherited
  // version does nothing, so without this override no component code runs.
  virtual task exec_task(uvm_component comp, uvm_phase phase);
    soc_env env;
    if ($cast(env, comp))
      env.load_fw_phase(phase);
  endtask
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

  // Called by load_fw_phase_c::exec_task
  task load_fw_phase(uvm_phase phase);
    phase.raise_objection(this);
    if (!reset_done)
      `uvm_error("ORDER", "Firmware phase ran before reset completed")
    `uvm_info("ORDER", "load_fw", UVM_LOW)
    #20ns; // Simulate firmware load latency
    firmware_loaded = 1'b1;
    phase.drop_objection(this);
  endtask

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

  static bit phase_registered;
  soc_env env;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  // reset_phase lives in the uvm run-time schedule, not in the common
  // domain, so add() is called on that schedule. With only after_phase,
  // load_fw is spliced in series: reset -> load_fw -> post_reset.
  // (get_common_domain().add(...) would stop with PH_BAD_ADD: from the
  // common domain, add() cannot find reset.)
  static function void register_load_fw_phase();
    if (!phase_registered) begin
      uvm_domain::get_uvm_schedule().add(
        load_fw_phase_c::get(),
        .after_phase(uvm_reset_phase::get())
      );
      phase_registered = 1'b1;
    end
  endfunction

  // build_phase runs before any run-time phase starts, so the schedule can
  // still be edited here.
  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    register_load_fw_phase();
    env = soc_env::type_id::create("env", this);
  endfunction
endclass

// ──────────────────────────────────────────────────
// 4. Top Module
// ──────────────────────────────────────────────────

module tb_top;
  initial run_test("base_test");
endmodule
