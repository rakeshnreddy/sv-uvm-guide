// =============================================================
// Lab: Multi-agent environment with virtual sequences (M5)
// File: work/key_stream.sv  (the DUT; read the README's specification,
//                            not this RTL, when you write the predictor)
//
// key_stream: a keyed byte-stream transformer with two interfaces.
//   Configuration port: one write per cycle (cfg_we, cfg_addr, cfg_wdata).
//     addr 0  CTRL  bit 0 = EN (accept data), bit 1 = MODE (0 XOR, 1 ADD)
//     addr 1  KEY   8-bit key
//   Data in:  din_valid, din.   Data out: dout_valid, dout.
//
// Rules (all on the rising edge of clk, rst_n synchronous and active low):
//   R1  A configuration write updates its register at the edge where
//       cfg_we is 1. A data byte accepted at the same edge still uses the
//       old register values.
//   R2  A byte is accepted at an edge where din_valid is 1 and EN is 1.
//       A byte sent while EN is 0 is dropped silently.
//   R3  One edge after a byte is accepted, dout_valid is 1 and
//       dout = MODE ? (din + KEY) mod 256 : (din ^ KEY).
//   R4  While EN is 1 the configuration is locked: a KEY write is ignored,
//       and a CTRL write changes EN only (MODE keeps its value).
//       To change KEY or MODE, write CTRL with EN = 0 first.
//
// Lab-only: +BUG=<n> on the simulator command line plants a known bug at
// run time, so you need not rebuild between runs (step 7 of the README).
//   +BUG=1  MODE is ignored: every byte is XORed.
//   +BUG=2  EN takes effect one edge late, so the byte sent on the first
//           edge after EN rises is dropped.
// =============================================================
module key_stream (
  input  logic       clk,
  input  logic       rst_n,
  input  logic       cfg_we,
  input  logic [1:0] cfg_addr,
  input  logic [7:0] cfg_wdata,
  input  logic       din_valid,
  input  logic [7:0] din,
  output logic       dout_valid,
  output logic [7:0] dout
);
  timeunit 1ns;
  timeprecision 1ps;

  localparam logic [1:0] ADDR_CTRL = 2'd0;
  localparam logic [1:0] ADDR_KEY  = 2'd1;

  logic       en;
  logic       mode;
  logic [7:0] key;
  logic       en_late;    // used only by +BUG=2

  int bug = 0;
  initial begin
    if (!$value$plusargs("BUG=%d", bug)) bug = 0;
  end

  logic accept;
  assign accept = din_valid && ((bug == 2) ? (en && en_late) : en);

  always_ff @(posedge clk) begin
    if (!rst_n) begin
      en         <= 1'b0;
      mode       <= 1'b0;
      key        <= 8'h00;
      en_late    <= 1'b0;
      dout_valid <= 1'b0;
      dout       <= 8'h00;
    end else begin
      en_late <= en;

      // R1, R4: register writes; the data path below reads the old values.
      if (cfg_we) begin
        unique case (cfg_addr)
          ADDR_CTRL: begin
            en <= cfg_wdata[0];
            if (!en) mode <= cfg_wdata[1];
          end
          ADDR_KEY: begin
            if (!en) key <= cfg_wdata;
          end
          default: ;
        endcase
      end

      // R2, R3: one result per accepted byte, one edge later.
      dout_valid <= accept;
      if (accept) begin
        if (mode && bug != 1) dout <= din + key;
        else                  dout <= din ^ key;
      end
    end
  end
endmodule
