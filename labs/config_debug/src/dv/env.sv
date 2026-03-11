class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  my_driver drv;

  function new(string name="my_env", uvm_component parent=null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    drv = my_driver::type_id::create("drv", this);
  endfunction
endclass
