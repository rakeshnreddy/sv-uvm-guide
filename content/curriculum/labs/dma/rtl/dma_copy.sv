// dma_copy: a one-channel memory-to-memory copy engine (the design under test of lab dma-1).
// The README's "Specification" section is the contract; rule numbers (R1..R7, M1..M3)
// refer to it. Do not read this file to decide what the bench should expect.
//
// Planted bugs, chosen at run time so one build covers every run:
//   +DMA_BUG=1  the transfer ends one word early when LEN is 2 or more (breaks R5)
//   +DMA_BUG=2  a DST write while BUSY is accepted and redirects the rest of the copy (breaks R3)
// With no plusarg (or +DMA_BUG=0) the design meets the specification.
module dma_copy (
  input  logic        clk,
  input  logic        rst_n,
  // Register port: one access per cycle in which cfg_valid is 1, no wait states
  input  logic        cfg_valid,
  input  logic        cfg_write,
  input  logic [7:0]  cfg_addr,
  input  logic [31:0] cfg_wdata,
  output logic [31:0] cfg_rdata,
  // Memory port (the DMA is the requester)
  output logic        mem_req,
  output logic        mem_we,
  output logic [31:0] mem_addr,
  output logic [31:0] mem_wdata,
  input  logic        mem_gnt,
  input  logic        mem_rvalid,
  input  logic [31:0] mem_rdata,
  // One-cycle pulse when a transfer ends
  output logic        done_o
);
  localparam logic [7:0] A_SRC = 8'h00, A_DST = 8'h04, A_LEN = 8'h08,
                         A_CTRL = 8'h0C, A_STATUS = 8'h10;

  typedef enum logic [2:0] {S_IDLE, S_RD, S_RWAIT, S_WR, S_FINISH} state_e;

  int unsigned bug;
  initial begin
    if (!$value$plusargs("DMA_BUG=%d", bug)) bug = 0;
    if (bug != 0) $display("dma_copy: planted bug %0d is active", bug);
  end

  state_e      state;
  logic [29:0] src_q, dst_q;      // word addresses: bits [1:0] of SRC and DST are not stored (R1)
  logic [7:0]  len_q;             // LEN[7:0] (R1)
  logic        busy_q, done_q;
  logic [7:0]  idx;               // words copied so far
  logic [31:0] data_q;            // word read, waiting to be written

  logic wr_access, start;
  assign wr_access = cfg_valid && cfg_write;
  assign start     = wr_access && cfg_addr == A_CTRL && cfg_wdata[0] && !busy_q;

  // Number of words this transfer copies. BUG 1 stops one word short.
  logic [7:0] last_len;
  assign last_len = (bug == 1 && len_q > 8'd1) ? len_q - 8'd1 : len_q;

  // Register reads are combinational from cfg_addr (R2).
  always_comb begin
    cfg_rdata = '0;
    if (cfg_valid && !cfg_write) begin
      unique case (cfg_addr)
        A_SRC:    cfg_rdata = {src_q, 2'b00};
        A_DST:    cfg_rdata = {dst_q, 2'b00};
        A_LEN:    cfg_rdata = {24'h0, len_q};
        A_STATUS: cfg_rdata = {30'h0, done_q, busy_q};
        default:  cfg_rdata = '0;   // CTRL and unmapped addresses read 0
      endcase
    end
  end

  // Memory port outputs follow the state.
  always_comb begin
    mem_req   = (state == S_RD) || (state == S_WR);
    mem_we    = (state == S_WR);
    mem_addr  = (state == S_WR) ? {dst_q + 30'(idx), 2'b00} : {src_q + 30'(idx), 2'b00};
    mem_wdata = (state == S_WR) ? data_q : '0;
  end

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      state  <= S_IDLE;
      src_q  <= '0;
      dst_q  <= '0;
      len_q  <= '0;
      busy_q <= 1'b0;
      done_q <= 1'b0;
      idx    <= '0;
      data_q <= '0;
      done_o <= 1'b0;
    end else begin
      done_o <= 1'b0;

      // Register writes. R3: SRC, DST and LEN ignore writes while BUSY.
      if (wr_access) begin
        unique case (cfg_addr)
          A_SRC: if (!busy_q) src_q <= cfg_wdata[31:2];
          A_DST: if (!busy_q || bug == 2) dst_q <= cfg_wdata[31:2];
          A_LEN: if (!busy_q) len_q <= cfg_wdata[7:0];
          default: ;
        endcase
      end

      unique case (state)
        S_IDLE:
          if (start) begin                       // R4
            busy_q <= 1'b1;
            done_q <= 1'b0;
            idx    <= '0;
            state  <= (len_q == 8'd0) ? S_FINISH : S_RD;
          end
        S_RD:
          if (mem_gnt) state <= S_RWAIT;         // M1
        S_RWAIT:
          if (mem_rvalid) begin                  // M2
            data_q <= mem_rdata;
            state  <= S_WR;
          end
        S_WR:
          if (mem_gnt) begin
            idx   <= idx + 8'd1;
            state <= (idx + 8'd1 >= last_len) ? S_FINISH : S_RD;
          end
        S_FINISH: begin                          // R5, R6
          busy_q <= 1'b0;
          done_q <= 1'b1;
          done_o <= 1'b1;
          state  <= S_IDLE;
        end
        default: state <= S_IDLE;
      endcase
    end
  end
endmodule
