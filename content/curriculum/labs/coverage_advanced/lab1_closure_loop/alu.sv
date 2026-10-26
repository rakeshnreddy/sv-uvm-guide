// alu.sv: the design under test, a combinational 8-bit ALU.
// You do not need to change this file.
module alu
  import alu_pkg::*;
(
  input  op_t        op,
  input  logic [7:0] a,
  input  logic [7:0] b,
  output logic [7:0] y
);
  timeunit 1ns;      // same time unit and precision as alu_pkg and tb_top
  timeprecision 1ns; // (IEEE 1800-2023 §3.14.2.3)
  always_comb begin
    case (op)
      ADD:     y = a + b;
      SUB:     y = a - b;
      MUL:     y = a * b;   // low byte of the product
      DIV:     y = a / b;   // b == 0 gives X: the spec forbids it (ALU-5)
      AND:     y = a & b;
      OR:      y = a | b;
      default: y = a ^ b;   // XOR
    endcase
  end
endmodule
