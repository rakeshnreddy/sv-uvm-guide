// pipe_if.sv: reference solution for lab constructs-1 (see README.md).
// The interface between tb_top and rot_pipe, with one clocking block per role.
interface pipe_if (input logic clk);
  timeunit 1ns; timeprecision 1ps;

  logic       rst_n = 1'b0;          // in reset from time 0; never a cb output
  logic       in_vld;
  logic [7:0] in_data;
  logic       out_vld;
  logic [7:0] out_data;

  // ------------------------------------------------ step 2: clocking blocks
  // Driver view. Inputs are sampled in the Preponed region (#1step); drives
  // change their signals in the Re-NBA region of the edge's own time slot (#0),
  // after the DUT's flops have read them (1800-2023 14.13, 14.16).
  default clocking cb @(posedge clk);
    default input #1step output #0;
    output in_vld, in_data;
    input  out_vld, out_data;
  endclocking

  // Monitor view: inputs only, so code that uses it cannot drive the DUT.
  // rst_n is sampled here; it is driven directly, between edges (step 5).
  clocking mon_cb @(posedge clk);
    input rst_n, in_vld, in_data, out_vld, out_data;
  endclocking

  // ## counts cycles of the default clocking, cb, so it is legal only in this
  // interface (14.11, 14.12). tb_top calls the task instead of writing ##.
  task automatic wait_cycles(input int n);
    repeat (n) ##1;                  // n clocking block events of cb
  endtask
endinterface
