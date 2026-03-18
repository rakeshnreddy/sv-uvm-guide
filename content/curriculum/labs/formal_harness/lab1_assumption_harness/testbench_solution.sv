// testbench_solution.sv — Corrected formal harness
// Fix 1: Removed the over-constraining a_never_consecutive_push
// Fix 2: Made full/empty combinational so they update immediately

module fifo_formal_harness_fixed #(parameter DEPTH = 4) (
  input logic clk, rst_n
);

  // DUT signals (free variables for formal)
  logic push, pop;
  logic [$clog2(DEPTH):0] count;
  logic full, empty;

  // ----------------------------------------------------------
  // Fixed FIFO model: full/empty are combinational
  // ----------------------------------------------------------
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      count <= 0;
    end else begin
      if (push && !pop && count < DEPTH)
        count <= count + 1;
      else if (pop && !push && count > 0)
        count <= count - 1;
    end
  end

  // FIX: full and empty are combinational — no one-cycle delay
  assign full  = (count == DEPTH);
  assign empty = (count == 0);

  // ----------------------------------------------------------
  // Formal assumptions (only what the real environment guarantees)
  // ----------------------------------------------------------

  // Legal push: environment won't push when full
  property a_legal_push;
    @(posedge clk) disable iff (!rst_n)
      !(push && full);
  endproperty
  assume property (a_legal_push);

  // Legal pop: environment won't pop when empty
  property a_legal_pop;
    @(posedge clk) disable iff (!rst_n)
      !(pop && empty);
  endproperty
  assume property (a_legal_pop);

  // NOTE: a_never_consecutive_push is intentionally REMOVED.
  // The real environment CAN push on consecutive cycles.
  // Over-constraining hid the bug.

  // ----------------------------------------------------------
  // Safety assertion
  // ----------------------------------------------------------
  property prop_full_correct;
    @(posedge clk) disable iff (!rst_n)
      (count == DEPTH) |-> full;
  endproperty
  assert property (prop_full_correct)
    else $error("FAIL: count == DEPTH but full is deasserted");

  // ----------------------------------------------------------
  // Cover property — now reachable without over-constraint
  // ----------------------------------------------------------
  property prop_fill_and_drain;
    @(posedge clk) disable iff (!rst_n)
      (count == 0) ##[1:20] (count == DEPTH) ##[1:20] (count == 0);
  endproperty
  cover property (prop_fill_and_drain);

endmodule
