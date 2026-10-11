// hs_slice.sv: the design under test for lab assertions-1.
//
// A one-word valid/ready register slice. It takes a word from the source on
// the upstream side and offers it to the sink on the downstream side one clock
// later. A word moves across a valid/ready port at a rising clock edge where
// valid and ready are both 1 (a "transfer").
//
// This file contains ONE deliberate protocol bug. Do not hunt for it by
// reading the code first: write the checks in tb/hs_slice_sva.sv and let them
// tell you where it is. You fix it in Step 5 of the README.

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
      if (in_ready) out_valid <= in_valid;   // fill, refill or drain the slice
      if (in_valid) out_data  <= in_data;    // capture the payload
    end
  end

endmodule : hs_slice
