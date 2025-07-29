`include "uvm_macros.svh"
import uvm_pkg::*;

`include "interface.sv"
`include "sequence_item.sv"
`include "sequencer.sv"
`include "driver.sv"
`include "monitor.sv"
`include "agent.sv"
`include "virtual_sequencer.sv"
`include "base_sequence.sv"
`include "a_sequence.sv"
`include "b_sequence.sv"
`include "virtual_sequence.sv"
`include "environment.sv"
`include "test.sv"

module top;

  bit clk;
  always #5 clk = ~clk;

  alu_if vif(clk);

  initial begin
    uvm_config_db#(virtual alu_if)::set(null, "*", "vif", vif);
    run_test("virtual_sequence_test");
  end

endmodule
