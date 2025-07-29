`include "uvm_macros.svh"
import uvm_pkg::*;

`include "alu_if.sv"
`include "alu_transaction.sv"
`include "alu_driver.sv"
`include "error_injecting_driver.sv"
`include "alu_monitor.sv"
`include "alu_agent.sv"
`include "alu_env.sv"
`include "base_test.sv"

module tb_top;
  bit clk;
  always #5 clk = ~clk;

  alu_if vif(clk);

  initial begin
    uvm_config_db#(virtual alu_if)::set(null, "*", "vif", vif);
    run_test("base_test");
  end

endmodule
