// A simple bus interface for the RAL example
interface bus_if(input clk);
  logic        req;
  logic        gnt;
  logic [31:0] addr;
  logic [31:0] wdata;
  logic [31:0] rdata;
  logic        rw; // 0 for read, 1 for write

  modport tb (
    output req,
    input  gnt,
    output addr,
    output wdata,
    input  rdata,
    output rw
  );

  modport dut (
    input  req,
    output gnt,
    input  addr,
    input  wdata,
    output rdata,
    input  rw
  );
endinterface
