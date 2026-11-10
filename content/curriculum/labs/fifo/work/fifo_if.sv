// fifo_if.sv: the signals between the bench and sync_fifo, for lab fifo-1.
// The class-based bench reaches these signals through a virtual interface
// (1800-2023 25.9): a class cannot hold a port, but it can hold a handle to an
// interface instance.
interface fifo_if #(parameter int W = 8) (input logic clk);
  timeunit 1ns; timeprecision 1ps;

  logic         rst_n;
  logic         wr_en;
  logic [W-1:0] wr_data;
  logic         rd_en;
  logic [W-1:0] rd_data;
  logic         full;
  logic         empty;
endinterface
