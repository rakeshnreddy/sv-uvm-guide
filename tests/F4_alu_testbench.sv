`timescale 1ns/1ps

module alu (
  input  logic [3:0] a, b,
  input  logic       opcode, // 0 for ADD, 1 for SUBTRACT
  output logic [4:0] result
);

  always_comb begin
    if (opcode == 0)
      result = a + b;
    else
      result = a - b;
  end

endmodule

module tb_alu;

  // Testbench signals
  logic clk;
  logic [3:0] a, b;
  logic       opcode;
  logic [4:0] result;

  // Instantiate the DUT
  alu dut (
    .a(a),
    .b(b),
    .opcode(opcode),
    .result(result)
  );

  // Clock generator
  initial begin
    clk = 0;
    forever #5 clk = ~clk; // 10ns period clock
  end

  // Task to drive one transaction
  task drive_transaction(input [3:0] i_a, i_b, input logic i_op);
    @(posedge clk); // Wait for a clock edge
    a = i_a;
    b = i_b;
    opcode = i_op;
    $display("DRV: Driving a=%0d, b=%0d, op=%s", i_a, i_b, (i_op ? "SUB" : "ADD"));
  endtask

  // Task to check the result
  task check_response(input [4:0] expected_result);
    @(posedge clk); // Wait for the result to be ready
    if (result == expected_result) begin
      $display("PASS: Result %0d == Expected %0d", result, expected_result);
    end else begin
      $error("FAIL: Result %0d != Expected %0d", result, expected_result);
    end
  endtask

  // Main test scenario
  initial begin
    $display("Starting ALU Testbench...");

    // Test 1: 5 + 3 = 8
    drive_transaction(5, 3, 0);
    check_response(8);

    // Test 2: 10 - 4 = 6
    drive_transaction(10, 4, 1);
    check_response(6);

    // Test 3: 2 - 5 = -3
    drive_transaction(2, 5, 1);
    check_response(5'b11101); // -3 in 5-bit 2's complement

    $display("ALU Testbench Finished.");
    $finish;
  end

endmodule
