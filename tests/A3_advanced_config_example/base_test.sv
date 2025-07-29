`ifndef BASE_TEST_SV
`define BASE_TEST_SV

class base_test extends uvm_test;
  `uvm_component_utils(base_test)

  alu_env m_env;
  alu_agent_config m_agent_config;

  function new(string name = "base_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);

    m_agent_config = alu_agent_config::type_id::create("m_agent_config");

    if (!uvm_config_db#(virtual alu_if)::get(this, "", "vif", m_agent_config.vif))
      `uvm_fatal("NOVIF", "Could not get virtual interface")

    uvm_config_db#(alu_agent_config)::set(this, "m_env.m_agent", "config", m_agent_config);

    m_env = alu_env::type_id::create("m_env", this);
  endfunction

  function void end_of_elaboration_phase(uvm_phase phase);
    super.end_of_elaboration_phase(phase);
    uvm_factory::get().print();
  endfunction

endclass

class error_test extends base_test;
  `uvm_component_utils(error_test)

  function new(string name = "error_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    alu_driver::type_id::set_inst_override(error_injecting_driver::get_type(),
                                           "m_env.m_agent.m_driver");
  endfunction
endclass

class passive_test extends base_test;
  `uvm_component_utils(passive_test)

  function new(string name = "passive_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    m_agent_config.is_active = UVM_PASSIVE;
  endfunction
endclass


`endif // BASE_TEST_SV
