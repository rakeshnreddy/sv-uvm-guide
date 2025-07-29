class base_test extends uvm_test;
  `uvm_component_utils(base_test)

  alu_env m_env;

  function new(string name = "base_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    m_env = alu_env::type_id::create("m_env", this);
  endfunction

  task run_phase(uvm_phase phase);
    alu_base_sequence seq;
    phase.raise_objection(this);
    seq = alu_base_sequence::type_id::create("seq");
    seq.start(m_env.m_agent.m_sequencer);
    phase.drop_objection(this);
  endtask
endclass
