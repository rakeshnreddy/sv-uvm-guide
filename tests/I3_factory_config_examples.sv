// This file contains examples from the I3 UVM Factory and Configuration module.

// Factory override example
class my_driver extends uvm_driver;
  `uvm_component_utils(my_driver)

  function new(string name = "my_driver", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual task run_phase(uvm_phase phase);
    `uvm_info("RUN", "Running my_driver", UVM_LOW)
  endtask
endclass

class my_special_driver extends my_driver;
  `uvm_component_utils(my_special_driver)

  function new(string name = "my_special_driver", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual task run_phase(uvm_phase phase);
    `uvm_info("RUN", "Running my_special_driver", UVM_LOW)
  endtask
endclass

class my_env extends uvm_env;
  `uvm_component_utils(my_env)

  my_driver drv;

  function new(string name = "my_env", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    drv = my_driver::type_id::create("drv", this);
  endfunction
endclass

class test_override extends uvm_test;
  `uvm_component_utils(test_override)

  my_env env;

  function new(string name = "test_override", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    factory.set_type_override_by_type(my_driver::get_type(), my_special_driver::get_type());
    env = my_env::type_id::create("env", this);
  endfunction

  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    #10;
    phase.drop_objection(this);
  endtask
endclass

// uvm_config_db example
interface my_if;
  logic clk;
  logic data;
endinterface

class my_driver_config extends uvm_driver;
  `uvm_component_utils(my_driver_config)

  virtual my_if vif;
  int my_int;

  function new(string name = "my_driver_config", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual my_if)::get(this, "", "vif", vif))
      `uvm_fatal("VIF", "Failed to get virtual interface")
    if (!uvm_config_db#(int)::get(this, "", "my_int", my_int))
      `uvm_fatal("INT", "Failed to get my_int")
  endfunction

  task run_phase(uvm_phase phase);
    `uvm_info("RUN", $sformatf("my_int = %0d", my_int), UVM_LOW)
  endtask
endclass

class my_env_config extends uvm_env;
  `uvm_component_utils(my_env_config)

  my_driver_config drv;

  function new(string name = "my_env_config", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    drv = my_driver_config::type_id::create("drv", this);
  endfunction
endclass

class test_config extends uvm_test;
  `uvm_component_utils(test_config)

  my_env_config env;

  function new(string name = "test_config", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = my_env_config::type_id::create("env", this);
  endfunction

  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    #10;
    phase.drop_objection(this);
  endtask
endclass

module top;
  my_if vif();

  initial begin
    uvm_config_db#(virtual my_if)::set(null, "uvm_test_top.env.drv", "vif", vif);
    uvm_config_db#(int)::set(null, "uvm_test_top.env.drv", "my_int", 123);
    run_test("test_config");
  end
endmodule
