// solution.sv - The Robust Implementation

interface dut_if (input logic clk);
  logic [7:0] d;
  logic [7:0] q;

  // Clocking block defines timing discipline
  clocking cb @(posedge clk);
    default input #1step output #1ns;
    output d;
    input  q;
  endclocking
endinterface

module dut (
  input  logic clk,
  input  logic [7:0] d,
  output logic [7:0] q
);
  always_ff @(posedge clk) begin
    q <= d;
  end
endmodule

module tb;
  logic clk = 0;
  always #5 clk = ~clk;

  // Interface Instance
  dut_if vif(clk);

  // DUT Instance
  dut u_dut (
    .clk(clk),
    .d(vif.d),
    .q(vif.q)
  );

  // Robust Driver
  initial begin
    // Initialize via clocking block
    vif.cb.d <= 0;
    
    // Wait for 2 cycles
    repeat (2) @(vif.cb);
    
    // Drive via clocking block
    // The value is driven 1ns AFTER the edge (Output Skew)
    // The DUT samples the stable value from before the edge (or the hold time is met)
    vif.cb.d <= 8'hA5;
    
    @(vif.cb);
    // Sample via clocking block (Input Skew #1step - Preponed)
    $display("Driven: A5, DUT Output: %h", vif.cb.q);
    
    // Note: Since we drive at T, the DUT captures at T, and output updates at T+1 (pipeline)
    // We need to wait one more cycle to see the effect on q if it's a register
    @(vif.cb);
    $display("Next Cycle Output: %h", vif.cb.q);
    
    if (vif.cb.q === 8'hA5) $display("Success! No Race Condition.");
    
    $finish;
  end
endmodule
