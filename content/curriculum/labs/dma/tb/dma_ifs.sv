// Interfaces of lab dma-1: one per agent.
// Timing convention for the whole bench (the same one as simple-dut-1):
// drivers and the DUT change signals with nonblocking assignments just after a
// rising edge; monitors and drivers sample on the rising edge, so they see the
// values from before that edge's updates. No clocking blocks are needed.

// Register port. The DMA samples an access on the rising edge where cfg_valid is 1.
interface dma_cfg_if (input logic clk);
  logic        rst_n;
  logic        cfg_valid;
  logic        cfg_write;
  logic [7:0]  cfg_addr;
  logic [31:0] cfg_wdata;
  logic [31:0] cfg_rdata;
  logic        done_o;
endinterface

// Memory port. The DMA requests; the bench's memory responder grants and returns read data.
interface dma_mem_if (input logic clk);
  logic        rst_n;
  logic        mem_req;
  logic        mem_we;
  logic [31:0] mem_addr;
  logic [31:0] mem_wdata;
  logic        mem_gnt;
  logic        mem_rvalid;
  logic [31:0] mem_rdata;
endinterface
