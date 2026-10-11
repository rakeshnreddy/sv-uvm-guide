// hs_slice_sva.sv (solution): protocol checks for hs_slice.
//
// tb_top instantiates this module next to the design and connects it to the
// same eight signals, so every check here sees exactly what the design sees.
//
// Rule  Name                  Kind               Who must obey it, or what it shows
// R0    a_in_ready_known      deferred immediate the design (combinational output)
// R1    a_out_valid_hold      concurrent assert  the design, as the downstream source
// R2    a_out_data_stable     concurrent assert  the design, as the downstream source
// R3    m_sink_ready_bounded  concurrent assume  the environment (the sink in tb_top)
// R4    a_accept_to_out       concurrent assert  the design (one-cycle latency)
// C1    c_transfer            cover              downstream transfers happened
// C2    c_stall_then_ready    cover              a stall happened and ended in a transfer
//
// Every concurrent check is clocked on the rising edge of clk and is disabled
// while rst_n is low. The disable condition uses current values, not sampled
// ones, so asserting reset cancels attempts that are still running
// (IEEE 1800-2023 16.12).

module hs_slice_sva #(
  parameter int W         = 8,  // payload width in bits
  parameter int MAX_STALL = 4   // sink's promise: out_ready is 1 within this many edges
) (
  input logic         clk,
  input logic         rst_n,
  input logic         in_valid,
  input logic         in_ready,
  input logic [W-1:0] in_data,
  input logic         out_valid,
  input logic         out_ready,
  input logic [W-1:0] out_data
);
  timeunit 1ns;
  timeprecision 1ps;

  int unsigned n_fail             = 0;   // failures of R1 to R4 (tb_top reads it)
  int unsigned n_transfer         = 0;   // matches of C1
  int unsigned n_stall_then_ready = 0;   // matches of C2

  // R0 (given): out of reset, in_ready is never X or Z.
  // A static deferred assertion behaves as if it were inside an always_comb
  // (16.4.3). "final" reports only the value that is left at the end of the
  // time step, so a combinational glitch cannot cause a false failure (16.4).
  // Its action block must be a single subroutine call (16.4), so it does not
  // count into n_fail.
  a_in_ready_known: assert final (!rst_n || !$isunknown(in_ready))
    else $error("[%0d ns] [SVA] a_in_ready_known: in_ready is X or Z", $time);

  // R1: once out_valid is high, it stays high until the sink takes the word.
  // "If the port is stalled at this edge, out_valid is still 1 at the NEXT
  // edge", so the implication is |=> (non-overlapping).
  a_out_valid_hold: assert property (@(posedge clk) disable iff (!rst_n)
      (out_valid && !out_ready) |=> out_valid)
    else begin
      n_fail++;
      $error("[%0d ns] [SVA] a_out_valid_hold: out_valid dropped before the sink took the word", $time);
    end

  // R2: while the port is stalled, the payload must not change.
  // $stable compares this edge's sampled value with the previous edge's
  // (16.9.3). With |-> it would compare the stalled edge with the edge before
  // it, and fail on a correct design whenever a new word has just arrived.
  // The action block runs in the Reactive region, after the design has moved
  // on, so it prints $past and $sampled values: the two values the check compared.
  a_out_data_stable: assert property (@(posedge clk) disable iff (!rst_n)
      (out_valid && !out_ready) |=> $stable(out_data))
    else begin
      n_fail++;
      $error("[%0d ns] [SVA] a_out_data_stable: out_data changed from %h to %h while out_valid was high and out_ready low",
             $time, $past(out_data), $sampled(out_data));
    end

  // R3: the sink is the testbench, not the design, so its rule is an
  // assumption. In simulation an assumption is checked and reported like an
  // assertion (16.14.2); a formal tool would use it to constrain out_ready.
  m_sink_ready_bounded: assume property (@(posedge clk) disable iff (!rst_n)
      (out_valid && !out_ready) |-> ##[1:MAX_STALL] out_ready)
    else begin
      n_fail++;
      $error("[%0d ns] [SVA] m_sink_ready_bounded: out_ready stayed low for %0d edges after a stalled edge",
             $time, MAX_STALL);
    end

  // R4 (given): a word the slice takes appears on the output at the next edge.
  a_accept_to_out: assert property (@(posedge clk) disable iff (!rst_n)
      (in_valid && in_ready) |=> (out_valid && out_data == $past(in_data)))
    else begin
      n_fail++;
      $error("[%0d ns] [SVA] a_accept_to_out: expected out_data %h one edge after the transfer, saw out_valid=%b out_data=%h",
             $time, $past(in_data), $sampled(out_valid), $sampled(out_data));
    end

  // C1: a downstream transfer. Cover sequences (scenarios), not implications:
  // an implication "succeeds" vacuously on every idle edge.
  c_transfer: cover property (@(posedge clk) disable iff (!rst_n)
      out_valid && out_ready)
    n_transfer++;

  // C2: a stalled edge followed by the transfer that ends the stall. A
  // nonzero count proves R1 and R2 had real (nonvacuous) attempts to judge.
  c_stall_then_ready: cover property (@(posedge clk) disable iff (!rst_n)
      (out_valid && !out_ready) ##1 (out_valid && out_ready))
    n_stall_then_ready++;

  final
    $display("[SVA] summary: %0d check failure(s); c_stall_then_ready hit %0d time(s); c_transfer hit %0d time(s)",
             n_fail, n_stall_then_ready, n_transfer);

endmodule : hs_slice_sva
