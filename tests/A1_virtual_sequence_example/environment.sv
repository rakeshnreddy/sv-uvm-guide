`ifndef ENVIRONMENT_SV
`define ENVIRONMENT_SV

class environment extends uvm_env;
  `uvm_component_utils(environment)

  agent m_agent_a;
  agent m_agent_b;
  virtual_sequencer m_virtual_sequencer;

  function new(string name = "environment", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    m_agent_a = agent::type_id::create("m_agent_a", this);
    m_agent_b = agent::type_id::create("m_agent_b", this);
    m_virtual_sequencer = virtual_sequencer::type_id::create("m_virtual_sequencer", this);
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    m_virtual_sequencer.m_sequencer_a = m_agent_a.m_sequencer;
    m_virtual_sequencer.m_sequencer_b = m_agent_b.m_sequencer;
  endfunction

endclass

`endif // ENVIRONMENT_SV
