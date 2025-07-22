```systemverilog
module dma_ctrl #(
  parameter NUM_CHANNELS = 4
) (
  input  logic                  clk,
  input  logic                  rst_n,
  // Bus-functional interface for programming control registers
  input  logic [7:0]            addr,
  input  logic                  write,
  input  logic [31:0]           wdata,
  output logic [31:0]           rdata,
  // Memory-facing ports
  output logic [31:0]           mem_addr,
  output logic                  mem_read,
  input  logic [31:0]           mem_rdata,
  output logic                  mem_write,
  output logic [31:0]           mem_wdata
);

  // Dummy implementation for now
  assign rdata = 32'hdeadbeef;
  assign mem_addr = 32'h0;
  assign mem_read = 1'b0;
  assign mem_write = 1'b0;
  assign mem_wdata = 32'h0;

endmodule
```
