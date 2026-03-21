// testbench.sv - The Racy Implementation

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
  // Both this block and the DUT's always_ff trigger in the Active region
  initial begin
    d <= 0;
    repeat (2) @(posedge clk);
    
    // RACE CONDITION:
    // We drive 'd' right at the clock edge.
    // The DUT might sample the OLD 0 or the NEW 8'hA5 depending on simulator scheduling.
    d <= 8'hA5;
    
    @(posedge clk);
    $display("Driven: A5, DUT Output: %h", q);
    
    if (q !== 8'hA5) $display("Mismatch! Possible Race Condition.");
    else $display("Match (Lucky!)");
    
    $finish;
  end
endmodule
