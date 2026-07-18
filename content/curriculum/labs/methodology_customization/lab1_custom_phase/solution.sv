`include "uvm_macros.svh"
import uvm_pkg::*;

typedef class soc_env;

class load_fw_phase extends uvm_task_phase;
  `uvm_object_utils(load_fw_phase)

  local static load_fw_phase m_inst;

  function new(string name = "load_fw");
    super.new(name);
  endfunction

  static function load_fw_phase get();
    if (m_inst == null)
      m_inst = new("load_fw");
    return m_inst;
  endfunction

  virtual task exec_task(uvm_component comp, uvm_phase phase);
    soc_env env;
    if ($cast(env, comp))
      env.execute_load_fw(phase);
  endtask
endclass

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
    #50ns;
    reset_done = 1'b1;
    phase.drop_objection(this);
  endtask

  task execute_load_fw(uvm_phase phase);
    phase.raise_objection(this);
    if (!reset_done)
      `uvm_error("ORDER", "Firmware phase ran before reset completed")
    `uvm_info("ORDER", "load_fw", UVM_LOW)
    #20ns;
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

  function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    if (!(reset_done && firmware_loaded && configure_done))
      `uvm_error("ORDER", "Expected reset -> load_fw -> configure milestones were not observed")
  endfunction
endclass

class base_test extends uvm_test;
  `uvm_component_utils(base_test)

  static bit phase_registered;
  soc_env env;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  static function void register_load_fw_phase();
    if (!phase_registered) begin
      uvm_domain::get_common_domain().add(
        load_fw_phase::get(),
        .after_phase(uvm_reset_phase::get()),
        .before_phase(uvm_configure_phase::get())
      );
      phase_registered = 1'b1;
    end
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    register_load_fw_phase();
    env = soc_env::type_id::create("env", this);
  endfunction
endclass

module tb_top;
  initial run_test("base_test");
endmodule
