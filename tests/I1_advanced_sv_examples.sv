// This file contains examples from the I1 Advanced SystemVerilog Features module.

// Interface-based testbench example
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

module alu (alu_if.DUT alu_port);
  always_comb begin
    case (alu_port.opcode)
      ADD: alu_port.y = alu_port.a + alu_port.b;
      SUB: alu_port.y = alu_port.a - alu_port.b;
      default: alu_port.y = 'x;
    endcase
  end
endmodule

module tb;
  logic clk = 0;
  always #5 clk = ~clk;

  alu_if alu_bus(clk);

  alu dut (.alu_port(alu_bus.DUT));

  initial begin
    alu_bus.reset = 1;
    alu_bus.a = 4;
    alu_bus.b = 2;
    alu_bus.opcode = ADD;
    #10;
    alu_bus.reset = 0;
    #10;
    $display("Result: %d", alu_bus.y);
    alu_bus.opcode = SUB;
    #10;
    $display("Result: %d", alu_bus.y);
    $finish;
  end
endmodule

// Functional coverage example
class AluTransaction;
  rand logic [3:0] a;
  rand logic [3:0] b;
  rand enum {ADD, SUB} opcode;

  covergroup AluCg;
    coverpoint opcode;
    coverpoint a {
      bins zero = {0};
      bins low = {[1:5]};
      bins high = {[6:15]};
    }
    coverpoint b {
      bins zero = {0};
      bins low = {[1:5]};
      bins high = {[6:15]};
    }
    cross a, b;
  endgroup

  function new();
    AluCg = new();
  endfunction

  function void sample_cg();
    AluCg.sample();
  endfunction
endclass

// SystemVerilog Assertions (SVA) example
module sva_example(input logic clk, input logic reset, input logic [3:0] a, input logic [3:0] b, input enum {ADD, SUB} opcode, output logic [4:0] y);
  property p_add;
    @(posedge clk)
    (opcode == ADD) |=> (y == a + b);
  endproperty

  a_add: assert property (p_add);
endmodule
