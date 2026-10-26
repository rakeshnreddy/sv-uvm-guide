// testbench.sv - The Racy Implementation
`timescale 1ns/1ps

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
  logic [7:0] d;
  logic [7:0] q;

  // Clock generation
  always #5 clk = ~clk;

  // DUT Instance
  dut u_dut (.*);

  // Racy Driver
  // This block and the DUT's always_ff both wake on posedge clk and are ready in
  // the Active region together; IEEE 1800-2023 §4.7 lets the simulator run them
  // in either order.
  initial begin
    d = 0;                    // time 0: no clock edge yet, so nothing races here
    repeat (2) @(posedge clk);

    // RACE CONDITION:
    // We write 'd' with a BLOCKING assignment right at the clock edge.
    // If this block runs first, the DUT reads the NEW 8'hA5 at this edge;
    // if the DUT runs first, it reads the OLD 0. Both orders are legal.
    // (d <= 8'hA5 would not race: the update waits for the NBA region, so the
    // DUT always reads the old 0 here and captures 8'hA5 one edge later.)
    d = 8'hA5;

    @(posedge clk);
    // Reading q here is deterministic: the DUT writes q with <=, so this
    // Active-region read sees q from before this edge's NBA update.
    $display("Driven: A5, DUT Output: %h", q);
    
    if (q !== 8'hA5) $display("Mismatch! Possible Race Condition.");
    else $display("Match (Lucky!)");
    
    $finish;
  end
endmodule
