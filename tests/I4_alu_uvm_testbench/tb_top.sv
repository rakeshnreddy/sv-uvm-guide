`include "uvm_macros.svh"
import uvm_pkg::*;

`include "alu_if.sv"
`include "alu_transaction.sv"
`include "alu_driver.sv"
`include "alu_monitor.sv"
`include "alu_agent.sv"
`include "alu_env.sv"
`include "base_test.sv"
`include "alu_base_sequence.sv"

module tb_top;
  logic clk = 0;
  always #5 clk = ~clk;

  alu_if vif(clk);
  alu dut(
    .a(vif.a),
    .b(vif.b),
    .op(vif.op),
    .result(vif.result),
    .start(vif.start),
    .done(vif.done)
  );

  initial begin
    uvm_config_db#(virtual alu_if)::set(null, "*", "vif", vif);
    run_test("base_test");
  end
endmodule
