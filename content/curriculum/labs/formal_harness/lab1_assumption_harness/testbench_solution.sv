// compile
// testbench_solution.sv: the harness after steps 2-5 of lab formal-harness (E-INT-1)
//
// Changes from testbench_buggy.sv:
//   - a_never_fill is removed: the FIFO spec never promised it (step 2).
//   - full is registered from the NEXT count, so it is 1 at the very edge
//     where count reaches DEPTH (step 5).
//
// Why not "assign full = (count == DEPTH);"? It also fixes the bug, but then
// p_full_is_correct restates the RTL's own equation and proves trivially.
// With a registered flag computed from count_next, the assertion checks a
// different implementation of the requirement, so the proof means something.
//
// Expected formal results (contract only): p_count_in_range proven,
// p_full_is_correct proven (not vacuous), c_reach_depth covered at edge 4,
// c_push_pop covered at edge 1.

module fifo #(
  parameter int DEPTH = 4
) (
  input  logic                   clk, rst_n, push, pop,
  output logic [$clog2(DEPTH):0] count,
  output logic                   full, empty
);
  logic [$clog2(DEPTH):0] count_next;

  // The interface contract forbids push while full and pop while empty,
  // so the counter is deliberately unguarded.
  assign count_next = count + push - pop;

  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) begin
      count <= '0;
      full  <= 1'b0;
    end else begin
      count <= count_next;
      full  <= (count_next == DEPTH);  // FIX: computed from the next count
    end

  assign empty = (count == 0);
endmodule

module fifo_props #(
  parameter int DEPTH = 4
) (
  input logic                   clk, rst_n, push, pop, full, empty,
  input logic [$clog2(DEPTH):0] count
);
  default clocking @(posedge clk); endclocking
  default disable iff (!rst_n);

  // Interface contract (FIFO spec), and nothing more.
  a_no_push_when_full: assume property (!(push && full));
  a_no_pop_when_empty: assume property (!(pop && empty));

  // Obligations on the DUT's outputs.
  p_count_in_range:    assert property (count <= DEPTH);
  p_full_is_correct:   assert property ((count == DEPTH) |-> full);

  // Sanity covers: both must be reached before any proof counts.
  c_reach_depth:       cover  property (count == DEPTH);
  c_push_pop:          cover  property (push && pop);
endmodule

bind fifo fifo_props #(.DEPTH(DEPTH)) u_fifo_props (.*);
