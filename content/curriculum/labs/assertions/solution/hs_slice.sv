// hs_slice.sv (solution): the design under test with its protocol bug fixed.
//
// The bug: the payload register loaded in_data whenever in_valid was 1, even
// at an edge where the slice could not take a new word (out_valid = 1 and
// out_ready = 0). While the sink stalled, the source was already offering its
// next word, so out_data changed under a held out_valid: the word the sink was
// waiting for was overwritten (lost) and the next word reached the sink twice.
//
// The fix: load the payload only on an upstream transfer, the same condition
// that moves out_valid.

module hs_slice #(
  parameter int W = 8                    // payload width in bits
) (
  input  logic         clk,
  input  logic         rst_n,            // asynchronous reset, active low

  // Upstream side: the source offers in_data with in_valid;
  // the slice takes it at an edge where in_ready is 1.
  input  logic         in_valid,
  output logic         in_ready,
  input  logic [W-1:0] in_data,

  // Downstream side: the slice offers out_data with out_valid;
  // the sink takes it at an edge where out_ready is 1.
  output logic         out_valid,
  input  logic         out_ready,
  output logic [W-1:0] out_data
);
  timeunit 1ns;
  timeprecision 1ps;

  // The slice can take a new word when it is empty, or when the word it
  // holds leaves at this edge.
  assign in_ready = !out_valid || out_ready;

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      out_valid <= 1'b0;
      out_data  <= '0;
    end else begin
      if (in_ready)             out_valid <= in_valid;  // fill, refill or drain the slice
      if (in_valid && in_ready) out_data  <= in_data;   // FIX: capture only on a transfer
    end
  end

endmodule : hs_slice
