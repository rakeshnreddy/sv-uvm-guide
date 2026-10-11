class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  my_agent agt;

  function new(string name = "my_env", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    agt = my_agent::type_id::create("agt", this);
  endfunction
endclass
