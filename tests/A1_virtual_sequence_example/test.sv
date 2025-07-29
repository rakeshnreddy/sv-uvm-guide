`ifndef TEST_SV
`define TEST_SV

class base_test extends uvm_test;
  `uvm_component_utils(base_test)

  environment m_env;

  function new(string name = "base_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    m_env = environment::type_id::create("m_env", this);
  endfunction

endclass

class virtual_sequence_test extends base_test;
  `uvm_component_utils(virtual_sequence_test)

  function new(string name = "virtual_sequence_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    uvm_config_db#(uvm_object_wrapper)::set(this,
      "m_env.m_virtual_sequencer.main_phase",
      "default_sequence",
      alu_virtual_sequence::type_id::get());
  endfunction

endclass

`endif // TEST_SV
