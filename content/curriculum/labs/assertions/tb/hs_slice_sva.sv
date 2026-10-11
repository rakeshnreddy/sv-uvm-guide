// hs_slice_sva.sv (starter): protocol checks for hs_slice. You edit this file.
//
// tb_top instantiates this module next to the design and connects it to the
// same eight signals, so every check here sees exactly what the design sees.
//
// Rule  Name                  Kind                        Status
// R0    a_in_ready_known      deferred immediate assert   given (an example)
// R1    a_out_valid_hold      concurrent assert           TODO 1
// R2    a_out_data_stable     concurrent assert           TODO 2
// R3    m_sink_ready_bounded  concurrent assume           TODO 3
// R4    a_accept_to_out       concurrent assert           given (copy its shape)
// C1    c_transfer            cover                       TODO 4
// C2    c_stall_then_ready    cover                       TODO 4
//
// Conventions for every concurrent check you add:
// - clock it with @(posedge clk) and disable it with disable iff (!rst_n);
// - in its fail action, increment n_fail and call $error with a message that
//   starts with "[%0d ns] [SVA] <name>:" and passes $time;
// - in a cover's pass statement, increment its counter (n_transfer or
//   n_stall_then_ready), so the summary line shows how often it matched.
//
// The file compiles and runs as it is: the TODO blocks are comments.

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
  // (IEEE 1800-2023 16.4.3). "final" reports only the value that is left at
  // the end of the time step, so a combinational glitch cannot cause a false
  // failure (16.4). Its action block must be a single subroutine call (16.4),
  // so it does not count into n_fail.
  a_in_ready_known: assert final (!rst_n || !$isunknown(in_ready))
    else $error("[%0d ns] [SVA] a_in_ready_known: in_ready is X or Z", $time);

  // R4 (given): a word the slice takes appears on the output at the next edge.
  // Read it as: "at every rising edge out of reset, IF in_valid and in_ready
  // are both 1, THEN at the NEXT edge out_valid is 1 and out_data equals the
  // in_data sampled at this edge". $past gives the previous edge's sampled
  // value (16.9.3).
  a_accept_to_out: assert property (@(posedge clk) disable iff (!rst_n)
      (in_valid && in_ready) |=> (out_valid && out_data == $past(in_data)))
    else begin
      n_fail++;
      $error("[%0d ns] [SVA] a_accept_to_out: expected out_data %h one edge after the transfer, saw out_valid=%b out_data=%h",
             $time, $past(in_data), $sampled(out_valid), $sampled(out_data));
    end

  // TODO 1 (R1): once out_valid is high, it stays high until the sink takes
  // the word. Trigger: the port is stalled (out_valid high, out_ready low).
  // Obligation: out_valid is still high at the next edge.
  //
  // a_out_valid_hold: assert property (@(posedge clk) disable iff (!rst_n)
  //     /* trigger */ /* |-> or |=> ? */ /* obligation */)
  //   else begin
  //     n_fail++;
  //     $error("[%0d ns] [SVA] a_out_valid_hold: out_valid dropped before the sink took the word", $time);
  //   end

  // TODO 2 (R2): while the port is stalled, out_data must not change.
  // Use $stable. Predict before you run: would |-> or |=> be correct here?
  // In the message, print the two values the check compared: $past(out_data)
  // and $sampled(out_data). Plain out_data would print the value in the
  // Reactive region, after the design has already moved on (16.9.3).
  //
  // a_out_data_stable: assert property (...)
  //   else begin
  //     n_fail++;
  //     $error("[%0d ns] [SVA] a_out_data_stable: out_data changed from %h to %h while out_valid was high and out_ready low",
  //            $time, /* the earlier value */, /* the value at the failing edge */);
  //   end

  // TODO 3 (R3): the sink promises that after a stalled edge, out_ready is 1
  // at one of the next MAX_STALL edges. The sink is the testbench, not the
  // design, so write this rule with assume property, not assert property.
  //
  // m_sink_ready_bounded: assume property (...)
  //   else begin
  //     n_fail++;
  //     $error("[%0d ns] [SVA] m_sink_ready_bounded: out_ready stayed low for %0d edges after a stalled edge",
  //            $time, MAX_STALL);
  //   end

  // TODO 4 (C1, C2): two covers that prove the scenarios happened.
  // C1 c_transfer: a downstream transfer (out_valid and out_ready both 1).
  // C2 c_stall_then_ready: a stalled edge followed, one edge later, by a transfer.
  // Cover a sequence, not an implication. Pass statement: n_transfer++; or
  // n_stall_then_ready++;
  //
  // c_transfer: cover property (...)
  //   n_transfer++;

  final
    $display("[SVA] summary: %0d check failure(s); c_stall_then_ready hit %0d time(s); c_transfer hit %0d time(s)",
             n_fail, n_stall_then_ready, n_transfer);

endmodule : hs_slice_sva
