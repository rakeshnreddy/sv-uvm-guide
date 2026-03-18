// testbench_buggy.sv — Formal harness with over-constrained assumption
// The bug: a_never_consecutive_push prevents the formal engine from
// exploring states where the FIFO fills past half capacity, masking
// a real overflow timing bug.

module fifo_formal_harness #(parameter DEPTH = 4) (
  input logic clk, rst_n
);

  // DUT signals (free variables for formal)
  logic push, pop;
  logic [$clog2(DEPTH):0] count;
  logic full, empty;

  // ----------------------------------------------------------
  // Simplified FIFO model (intentional bug: full updates late)
  // ----------------------------------------------------------
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      count <= 0;
      full  <= 0;
      empty <= 1;
    end else begin
      if (push && !pop && count < DEPTH)
        count <= count + 1;
      else if (pop && !push && count > 0)
        count <= count - 1;

      // BUG: full/empty update is registered — one cycle late
      full  <= (count == DEPTH);
      empty <= (count == 0);
    end
  end

  // ----------------------------------------------------------
  // Formal assumptions
  // ----------------------------------------------------------

  // Correct: don't push when full
  property a_legal_push;
    @(posedge clk) disable iff (!rst_n)
      !(push && full);
  endproperty
  assume property (a_legal_push);

  // Correct: don't pop when empty
  property a_legal_pop;
    @(posedge clk) disable iff (!rst_n)
      !(pop && empty);
  endproperty
  assume property (a_legal_pop);

  // OVER-CONSTRAINT: never allow two consecutive pushes
  // This prevents the engine from filling the FIFO quickly enough
  // to expose the one-cycle-late full flag bug
  property a_never_consecutive_push;
    @(posedge clk) disable iff (!rst_n)
      push |=> !push;
  endproperty
  assume property (a_never_consecutive_push);

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
  // Cover property
  // ----------------------------------------------------------
  property prop_fill_and_drain;
    @(posedge clk) disable iff (!rst_n)
      (count == 0) ##[1:20] (count == DEPTH) ##[1:20] (count == 0);
  endproperty
  cover property (prop_fill_and_drain);

endmodule
