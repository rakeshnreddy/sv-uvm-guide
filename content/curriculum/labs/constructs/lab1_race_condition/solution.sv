// solution.sv - The Robust Implementation
`timescale 1ns/1ps // 1 ns unit: the 10 ns clock period is longer than the 1 ns skew

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
    
    // Drive via clocking block at this clocking event (edge k, t=15).
    // d changes in the Re-NBA region 1 ns after this edge (output skew;
    // IEEE 1800-2023 §14.16), so the DUT has already read the old d at this
    // edge, in any process order.
    vif.cb.d <= 8'hA5;
    
    @(vif.cb);
    // Edge k+1 (t=25): the DUT captures A5 here; q updates in the NBA region.
    // vif.cb.q is the #1step (Preponed) sample, the value q had just before
    // this edge, so it still shows 00.
    $display("Driven: A5, DUT Output: %h", vif.cb.q);

    // Edge k+2 (t=35): the first vif.cb.q sample taken after the DUT captured A5.
    @(vif.cb);
    $display("Next Cycle Output: %h", vif.cb.q);
    
    if (vif.cb.q === 8'hA5) $display("Success! No Race Condition.");
    
    $finish;
  end
endmodule
