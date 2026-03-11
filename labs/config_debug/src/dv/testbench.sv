`include "uvm_macros.svh"
import uvm_pkg::*;

`include "src/dv/my_if.sv"
`include "src/dv/driver.sv"
`include "src/dv/env.sv"

module testbench;
  logic clk = 0;
  always #5 clk = ~clk;

  my_if vif(clk);
  my_env env;
  
  initial begin
    // DELIBERATE BUG: Typo in the string literal "viiif" instead of "vif"
    uvm_config_db#(virtual my_if)::set(null, "*", "viiif", vif);
    
    env = my_env::type_id::create("env", null);
    run_test();
  end
  
  initial begin
    #50;
    $display("Test finished.");
    $finish;
  end
endmodule
