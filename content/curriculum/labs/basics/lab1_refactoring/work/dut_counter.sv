`timescale 1ns/1ps

// DUT for lab basics-1: an 8-bit accumulator.
// On every rising clock edge where enable is 1, count adds data.
// The sum is 8 bits wide, so it wraps modulo 256.
// The active-low reset rst_n clears count at once.
module dut_counter (
  input  logic       clk,
  input  logic       rst_n,
  input  logic       enable,
  input  logic [7:0] data,
  output logic [7:0] count
);
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      count <= '0;
    end else if (enable) begin
      count <= count + data;
    end
  end
endmodule
