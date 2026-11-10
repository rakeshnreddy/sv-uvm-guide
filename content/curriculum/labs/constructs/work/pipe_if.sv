// pipe_if.sv: the starter interface for lab constructs-1 (see README.md).
// It bundles the signals between tb_top and rot_pipe. It compiles as it is;
// each TODO step N comment marks code you write in step N.
interface pipe_if (input logic clk);
  timeunit 1ns; timeprecision 1ps;

  logic       rst_n = 1'b0;          // in reset from time 0
  logic       in_vld;
  logic [7:0] in_data;
  logic       out_vld;
  logic [7:0] out_data;

  // TODO step 2: the driver's clocking block. Declare it as the default
  // clocking, named cb, on the rising edge of clk. Write the skews out:
  // inputs sampled #1step, outputs driven #0. The driver drives in_vld and
  // in_data (outputs of cb) and may read out_vld and out_data (inputs of cb).
  // Leave rst_n out of cb.

  // TODO step 2: the monitor's clocking block, named mon_cb, on the same edge,
  // with inputs only: rst_n, in_vld, in_data, out_vld and out_data.

  // TODO step 2: task automatic wait_cycles(input int n) that waits n clocking
  // block events of cb with a cycle delay (##). It is legal only here, where
  // cb is the default clocking.
endinterface
