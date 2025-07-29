class alu_env extends uvm_env;
  `uvm_component_utils(alu_env)

  alu_agent agent;

  function new(string name = "alu_env", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    agent = alu_agent::type_id::create("agent", this);
  endfunction
endclass
