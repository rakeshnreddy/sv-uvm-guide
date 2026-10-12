// sat_adder_reg.sv: the DUT for lab simple-dut-1 (see README.md).
// A registered 8-bit adder whose result saturates: a sum that does not fit in
// 8 bits is reported as 255. It is F2E's adder_reg with one rule changed (R3).
//
// On every rising edge of clk:
//   R1. If rst_n is 0, out_valid becomes 0 and sum becomes 0.
//   R2. Otherwise out_valid becomes the value of in_valid.
//   R3. If in_valid is 1, sum becomes a + b when that fits in W bits,
//       and the largest W-bit value (255 for W = 8) when it does not.
//   R4. If in_valid is 0, sum keeps its value.
//
// BUG plants a known bug so you can prove that your bench fails. Leave it at 0
// except in step 7. Real RTL has no such parameter.
module sat_adder_reg #(
  parameter int W   = 8,
  parameter int BUG = 0              // 1 or 2 plants a known bug
) (
  input  logic         clk,
  input  logic         rst_n,        // synchronous, active low
  input  logic         in_valid,
  input  logic [W-1:0] a,
  input  logic [W-1:0] b,
  output logic         out_valid,
  output logic [W-1:0] sum           // a + b, saturated at the largest W-bit value
);
  timeunit 1ns; timeprecision 1ps;   // every module needs one (1800-2023 3.14.2.3)

  logic [W:0]   total;               // a + b with its carry
  logic [W-1:0] next_sum;

  always_comb begin
    total = a + b;                   // evaluated at W+1 bits, the width of total
    if (total[W]) next_sum = '1;     // R3: too big for W bits, so saturate
    else          next_sum = total[W-1:0];
    if (BUG == 1) next_sum = a + b;  // mutant 1: evaluated at W bits, so it wraps
  end

  always_ff @(posedge clk) begin
    if (!rst_n) begin                // R1
      out_valid <= 1'b0;
      sum       <= '0;
    end else begin
      out_valid <= (BUG == 2) ? 1'b1 : in_valid;  // R2; mutant 2: a result every cycle
      if (in_valid) sum <= next_sum;               // R3; otherwise sum holds (R4)
    end
  end
endmodule
