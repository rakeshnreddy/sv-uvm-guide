`include "uvm_macros.svh"
import uvm_pkg::*;

`include "src/dv/my_if.sv"
`include "src/dv/driver.sv"
`include "src/dv/env.sv"

class config_debug_test extends uvm_test;
  `uvm_component_utils(config_debug_test)

  my_env env;

  function new(string name = "config_debug_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // DELIBERATE STARTER BUG: driver requests "vif", but this sets "viiif".
    uvm_config_db#(virtual my_if.driver_mp)::set(
      this, "env.drv", "viiif", testbench.vif
    );
    env = my_env::type_id::create("env", this);
  endfunction

  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    repeat (8) @(posedge testbench.clk);
    phase.drop_objection(this);
  endtask
endclass

module testbench;
  logic clk = 0;
  always #5 clk = ~clk;

  my_if vif(clk);
  initial begin
    run_test("config_debug_test");
  end

  initial begin
    #1us;
    `uvm_fatal("TIMEOUT", "Config-debug test did not reach normal UVM completion")
  end
endmodule
