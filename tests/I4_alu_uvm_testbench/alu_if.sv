interface alu_if (input logic clk);
  logic reset;
  logic [3:0] a;
  logic [3:0] b;
  enum {ADD, SUB} opcode;
  logic [4:0] y;

  // Modport for the Testbench side
  modport Testbench (
    output a, b, opcode, reset,
    input  y,
    input  clk
  );

  // Modport for the DUT side
  modport DUT (
    input  a, b, opcode, reset, clk,
    output y
  );
endinterface
