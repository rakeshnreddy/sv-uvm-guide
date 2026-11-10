// rr_arbiter.sv: the DUT for lab arbiter-1 (see README.md).
// A synchronous round-robin arbiter for N requesters. The grant is combinational
// from req and a registered pointer, so the winner of a cycle is decided by the
// req value present before that cycle's rising edge, and the pointer moves at it.
//
// Specification (README, rules R1 to R5):
//   R1. gnt is zero or one-hot, and gnt[i] is 1 only when req[i] is 1.
//   R2. When at least one req bit is 1, exactly one gnt bit is 1.
//   R3. The winner is the first requester found when searching from the index
//       after the last winner, upward, wrapping from N-1 to 0.
//   R4. On a rising edge of clk with a grant, the winner becomes the last winner.
//       With no grant, the last winner is unchanged.
//   R5. On a rising edge of clk with rst_n at 0 (synchronous, active-low reset),
//       the last winner becomes N-1, so requester 0 is searched first.
// A consequence of R3 and R4 (the fairness bound): a requester that holds req
// is granted within N cycles, after at most N-1 grants to others.
//
// BUG plants a known bug so you can prove that your environment fails. Leave it
// at 0 except in step 6. Real RTL has no such parameter.
module rr_arbiter #(
  parameter int N   = 4,
  parameter int BUG = 0              // 1 or 2 plants a known bug
) (
  input  logic         clk,
  input  logic         rst_n,        // synchronous, active low
  input  logic [N-1:0] req,
  output logic [N-1:0] gnt
);
  timeunit 1ns; timeprecision 1ps;   // every module needs one (1800-2023 3.14.2.3)

  localparam int IW = (N > 1) ? $clog2(N) : 1;

  logic [IW-1:0] last;               // index of the last winner (R4)

  // R1 to R3: search from last + 1, wrapping, and grant the first requester.
  always_comb begin
    gnt = '0;
    for (int k = 1; k <= N; k++) begin
      automatic int idx = (int'(last) + k) % N;
      if (req[idx]) begin
        gnt[idx] = 1'b1;
        break;
      end
    end
  end

  // R4 and R5.
  always_ff @(posedge clk) begin
    if (!rst_n) begin
      last <= IW'(N - 1);
    end else begin
      for (int i = 0; i < N; i++) begin
        // mutant 1: the pointer does not move when N-1 wins, so N-1 keeps winning
        // mutant 2: the pointer never moves, so the search always starts at 0
        if (gnt[i] && !(BUG == 1 && i == N - 1) && BUG != 2) last <= IW'(i);
      end
    end
  end
endmodule
