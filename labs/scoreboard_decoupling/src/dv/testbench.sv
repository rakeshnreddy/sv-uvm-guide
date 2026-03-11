`include "uvm_macros.svh"
import uvm_pkg::*;

`include "src/dv/txn.sv"
`include "src/dv/monitor.sv"
`include "src/dv/scoreboard.sv"
`include "src/dv/env.sv"

module testbench;
  my_env env;
  initial begin
    env = my_env::type_id::create("env", null);
    run_test();
  end
  
  initial begin
    #100;
    $display("Test finished.");
    $finish;
  end
endmodule
