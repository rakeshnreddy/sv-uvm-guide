`include "uvm_macros.svh"
import uvm_pkg::*;

interface config_if(input logic clk);
  logic [7:0] data;
  logic valid;
  clocking driver_cb @(posedge clk);
    output data, valid;
  endclocking
  modport driver_mp(clocking driver_cb);
endinterface

class config_driver extends uvm_component;
  `uvm_component_utils(config_driver)
  virtual config_if.driver_mp vif;

  function new(string name = "config_driver", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual config_if.driver_mp)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "driver virtual interface is not configured")
  endfunction

  task run_phase(uvm_phase phase);
    vif.driver_cb.valid <= 1'b0;
    repeat (4) begin
      @(vif.driver_cb);
      vif.driver_cb.valid <= 1'b1;
      vif.driver_cb.data <= $urandom;
    end
    @(vif.driver_cb);
    vif.driver_cb.valid <= 1'b0;
  endtask
endclass

class config_env extends uvm_env;
  `uvm_component_utils(config_env)
  config_driver drv;

  function new(string name = "config_env", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    drv = config_driver::type_id::create("drv", this);
  endfunction
endclass

class config_fixed_test extends uvm_test;
  `uvm_component_utils(config_fixed_test)
  config_env env;

  function new(string name = "config_fixed_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    uvm_config_db#(virtual config_if.driver_mp)::set(
      this, "env.drv", "vif", config_debug_solution_top.vif
    );
    env = config_env::type_id::create("env", this);
  endfunction

  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    repeat (8) @(posedge config_debug_solution_top.clk);
    phase.drop_objection(this);
  endtask
endclass

module config_debug_solution_top;
  logic clk = 1'b0;
  always #5ns clk = ~clk;
  config_if vif(clk);

  initial run_test("config_fixed_test");
  initial begin
    #1us;
    `uvm_fatal("TIMEOUT", "Corrected config-debug solution did not complete")
  end
endmodule
