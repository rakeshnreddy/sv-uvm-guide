// sync_fifo.sv: the DUT for lab fifo-1 (see README.md).
// A synchronous first-in, first-out buffer with DEPTH entries of W bits.
//
// On every rising edge of clk, using the values the signals had just before it:
//   F1. If rst_n is 0, the FIFO becomes empty and rd_data becomes 0.
//   F2. A write is accepted when wr_en is 1 and full is 0: wr_data is stored
//       behind the entries already held.
//   F3. A read is accepted when rd_en is 1 and empty is 0: the oldest entry
//       leaves the FIFO and rd_data takes its value. rd_data is registered, so
//       the value is there one cycle after rd_en. Otherwise rd_data holds.
//   F4. wr_en while full is ignored, even if a read is accepted on the same
//       edge. rd_en while empty is ignored, even if a write is accepted on the
//       same edge. A write and a read can both be accepted on one edge.
//   F5. full is 1 exactly when DEPTH entries are held, empty is 1 exactly when
//       none are. Both change only on a rising edge.
//
// BUG plants a known bug so you can prove that your bench fails (step 8).
// Leave it at 0 otherwise. Real RTL has no such parameter.
module sync_fifo #(
  parameter int W     = 8,
  parameter int DEPTH = 4,            // a power of 2
  parameter int BUG   = 0             // 1 or 2 plants a known bug
) (
  input  logic         clk,
  input  logic         rst_n,         // synchronous, active low
  input  logic         wr_en,
  input  logic [W-1:0] wr_data,
  input  logic         rd_en,
  output logic [W-1:0] rd_data,
  output logic         full,
  output logic         empty
);
  timeunit 1ns; timeprecision 1ps;    // declared explicitly, so the precedence rules of 1800-2023 3.14.2.3 never apply

  localparam int AW = $clog2(DEPTH);

  logic [W-1:0]  mem [DEPTH];
  logic [AW-1:0] wr_ptr, rd_ptr;      // wrap naturally because DEPTH is a power of 2
  logic [AW:0]   count;               // 0 to DEPTH entries held
  logic          do_wr, do_rd;

  assign full  = (count == (AW+1)'(DEPTH));  // F5
  assign empty = (count == '0);

  // F2, F4; mutant 1 ignores full, so a write while full is stored anyway
  assign do_wr = wr_en && (!full || BUG == 1);
  assign do_rd = rd_en && !empty;     // F3, F4

  always_ff @(posedge clk) begin
    if (!rst_n) begin                 // F1
      wr_ptr  <= '0;
      rd_ptr  <= '0;
      count   <= '0;
      rd_data <= '0;
    end else begin
      if (do_wr) begin
        mem[wr_ptr] <= wr_data;
        wr_ptr      <= wr_ptr + 1'b1;
      end
      if (do_rd) begin
        rd_data <= mem[rd_ptr];
        rd_ptr  <= rd_ptr + 1'b1;
      end
      // count: +1 for a write alone, -1 for a read alone, unchanged for both.
      // Mutant 2 forgets the "both" case: a write and a read on one edge add 1.
      if (BUG == 2) begin
        if (do_wr)      count <= count + 1'b1;
        else if (do_rd) count <= count - 1'b1;
      end else begin
        case ({do_wr, do_rd})
          2'b10:   count <= count + 1'b1;
          2'b01:   count <= count - 1'b1;
          default: ;                  // none, or both: the count holds
        endcase
      end
    end
  end
endmodule
