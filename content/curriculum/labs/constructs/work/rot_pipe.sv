// rot_pipe.sv: the DUT for lab constructs-1 (see README.md). Do not edit it,
// except to plant your own bug in step 6.
// A three-register pipeline that rotates each byte left by one bit. It is a
// sibling of pipe2 in F4C: Synchronizing with Clocking and Program Blocks, with
// a different function and one more register.
//
//   R1. While rst_n is 0 (asynchronous, active low), every register, out_vld
//       and out_data are 0.
//   R2. An item is accepted at a rising edge of clk where in_vld is 1. Its
//       result is in the output register two edges later: accepted at edge c,
//       out_vld is 1 and out_data holds the result from edge c+2 until edge c+3.
//   R3. The result is in_data rotated left by one bit: bit 7 moves to bit 0.
//   R4. out_vld is 0 after every edge that has no item to present.
//
// BUG plants a known bug so you can prove that your bench fails. Leave it at 0
// except in step 6. Real RTL has no such parameter.
module rot_pipe #(
  parameter int BUG = 0              // 1: shift instead of rotate; 2: one extra register
) (
  input  logic       clk,
  input  logic       rst_n,          // asynchronous, active low
  input  logic       in_vld,
  input  logic [7:0] in_data,
  output logic       out_vld,
  output logic [7:0] out_data
);
  timeunit 1ns; timeprecision 1ps;   // every design element declares one (1800-2023 3.14.2.3)

  logic       s1_vld, s2_vld, s3_vld;
  logic [7:0] s1_data, s2_data, s3_data;

  // Every register reads in_data and in_vld directly on the clock edge, with no
  // combinational logic in between, so a testbench race shows up cleanly.
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin                                 // R1
      s1_vld   <= 1'b0;  s1_data  <= '0;
      s2_vld   <= 1'b0;  s2_data  <= '0;
      s3_vld   <= 1'b0;  s3_data  <= '0;
      out_vld  <= 1'b0;  out_data <= '0;
    end else begin
      s1_vld  <= in_vld;                              // edge c: accept
      s1_data <= (BUG == 1) ? {in_data[6:0], 1'b0}    // mutant 1: bit 7 is lost
                            : {in_data[6:0], in_data[7]};  // R3
      s2_vld  <= s1_vld;  s2_data <= s1_data;         // edge c+1
      s3_vld  <= s2_vld;  s3_data <= s2_data;         // used only by mutant 2
      if (BUG == 2) begin                             // mutant 2: one edge late
        out_vld <= s3_vld;  out_data <= s3_data;
      end else begin                                  // edge c+2: present (R2)
        out_vld <= s2_vld;  out_data <= s2_data;
      end
    end
  end
endmodule
