// compile
// testbench_buggy.sv: the formal harness you start from (lab formal-harness, E-INT-1)
//
// Three parts, as in the lesson:
//   1. fifo        - the DUT: the control block of a 4-entry FIFO
//   2. fifo_props  - the shared property library (simulation and formal)
//   3. the bind    - attaches fifo_props to every fifo without editing it
//
// Formal setup (commands are tool-dependent): read this file, top = fifo,
// clock = clk, reset = rst_n (active low), prove all assertions, check all covers.
// Edges are counted from 0, the first rising edge after reset is released.

module fifo #(
  parameter int DEPTH = 4
) (
  input  logic                   clk, rst_n, push, pop,
  output logic [$clog2(DEPTH):0] count,
  output logic                   full, empty
);
  // The interface contract forbids push while full and pop while empty,
  // so the counter is deliberately unguarded.
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) count <= '0;
    else        count <= count + push - pop;

  // full is a register (for timing)
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) full <= 1'b0;
    else        full <= (count == DEPTH);

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

  // Interface contract (FIFO spec): the environment never pushes while full
  // and never pops while empty.
  a_no_push_when_full: assume property (!(push && full));
  a_no_pop_when_empty: assume property (!(pop && empty));

  // Added last week: "the proof was slow; the producer never fills the FIFO anyway".
  a_never_fill:        assume property (!(push && count == DEPTH - 1));

  // Obligations on the DUT's outputs.
  p_count_in_range:    assert property (count <= DEPTH);
  p_full_is_correct:   assert property ((count == DEPTH) |-> full);

  // Sanity covers.
  c_reach_depth:       cover  property (count == DEPTH);
  c_push_pop:          cover  property (push && pop);
endmodule

// One bind: DEPTH and every port resolve in fifo's scope (IEEE 1800-2023 §23.11).
bind fifo fifo_props #(.DEPTH(DEPTH)) u_fifo_props (.*);
