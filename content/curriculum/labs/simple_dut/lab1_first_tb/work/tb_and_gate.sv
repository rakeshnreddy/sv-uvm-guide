// Skeleton Testbench for the and_gate DUT
module tb_and_gate;

  // Declare signals to connect to the DUT
  logic tb_a;
  logic tb_b;
  logic tb_y;

  // Instantiate the DUT, mapping its ports to our testbench signals
  and_gate dut (
    .a(tb_a),
    .b(tb_b),
    .y(tb_y)
  );

  //
  // Your stimulus generation code will go here
  //
  // initial begin
  //   ...
  // end
  //

  //
  // Your self-checking logic will go here
  //
  // always @(tb_y) begin
  //   ...
  // end
  //

endmodule
