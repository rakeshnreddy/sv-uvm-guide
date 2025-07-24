// Solution Testbench for the and_gate DUT
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

  // Stimulus generation code
  initial begin
    $display("Starting simulation...");

    // Test case 1: a=0, b=0
    tb_a = 0; tb_b = 0; #10;

    // Test case 2: a=0, b=1
    tb_a = 0; tb_b = 1; #10;

    // Test case 3: a=1, b=0
    tb_a = 1; tb_b = 0; #10;

    // Test case 4: a=1, b=1
    tb_a = 1; tb_b = 1; #10;

    $display("Simulation finished.");
  end

  // Self-checking logic
  always @(tb_y) begin
    logic expected_y;
    expected_y = tb_a & tb_b; // Calculate the expected value

    if (tb_y === expected_y) begin
      $display("PASSED: a=%b, b=%b -> y=%b", tb_a, tb_b, tb_y);
    end else begin
      $error("FAILED: a=%b, b=%b -> y=%b, expected=%b", tb_a, tb_b, tb_y, expected_y);
    end
  end

endmodule
