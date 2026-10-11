// config-debug lab: the solution. Compile this file only, with tb_top as the top module.
`include "uvm_macros.svh"
import uvm_pkg::*;

`include "src/dv/my_if.sv"
`include "solution/driver.sv"
`include "solution/monitor.sv"
`include "src/dv/agent.sv"
`include "src/dv/env.sv"

class config_debug_test extends uvm_test;
  `uvm_component_utils(config_debug_test)

  localparam int unsigned NUM_PKTS = 6;   // what this test asks for
  my_env env;

  function new(string name = "config_debug_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // FIX 3: "env.agt.*" does not reach the agent itself; name it exactly.
    uvm_config_db#(int unsigned)::set(this, "env.agt", "num_pkts", NUM_PKTS);
    env = my_env::type_id::create("env", this);
  endfunction

  function void end_of_elaboration_phase(uvm_phase phase);
    check_config_usage();   // uvm-core: lists settings that were written but never read
  endfunction

  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    wait (env.agt.drv.done);
    phase.drop_objection(this);
  endtask

  function void check_phase(uvm_phase phase);
    if (env.agt.mon.n_seen == NUM_PKTS)
      `uvm_info("CHK", $sformatf("PASS: monitor saw %0d transfers", env.agt.mon.n_seen), UVM_LOW)
    else
      `uvm_error("CHK", $sformatf("expected %0d transfers, monitor saw %0d",
                                  NUM_PKTS, env.agt.mon.n_seen))
  endfunction
endclass

module tb_top;
  timeunit 1ns; timeprecision 1ps;

  logic clk = 1'b0;
  always #5 clk = ~clk;

  my_if my_if0 (.clk(clk));

  initial begin
    uvm_config_db#(virtual my_if)::set(null, "uvm_test_top.env.agt.*", "vif", my_if0);
    // FIX 4: the num_pkts "default" that was set here had precedence 1000 and beat
    // the test's build_phase setting (999). Defaults belong in the agent's own code.
    run_test("config_debug_test");
  end
endmodule
