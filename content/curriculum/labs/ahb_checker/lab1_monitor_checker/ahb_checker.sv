// ============================================================================
// AHB-Lite Protocol Checker — STARTER FILE
// ============================================================================
// TODO: Implement SVA properties that catch AHB protocol violations.
// Section numbers refer to Arm IHI0033B.b (AMBA 5 AHB, AHB5 and AHB-Lite).
//
// Protocol rules (a failure means a master or slave broke the spec):
//   1. p_addr_stable              a waited NONSEQ/SEQ holds HADDR      (3.6.2, 3.5.2)
//   2. p_ctrl_stable              ... and holds HTRANS and control     (3.6.1, 3.5.2)
//   3. p_busy_in_wait             what a waited BUSY may change into   (3.6.1)
//   4. p_error_two_cycle          ERROR first cycle -> second cycle    (5.1.3, Table 5-2)
//   5. p_error_needs_first_cycle  ERROR completion needs a first cycle (5.1.3, Table 5-2)
//   6. p_wait_states_okay         wait states use OKAY                 (5.1.2, 5.1.3, Table 5-2)
//
// Environment watchdog (a testbench budget, NOT a protocol rule):
//   7. p_hready_timeout           HREADY low for at most MAX_WAIT cycles
// ============================================================================

module ahb_checker (
  input logic        HCLK,
  input logic        HRESETn,
  input logic [31:0] HADDR,
  input logic [1:0]  HTRANS,
  input logic        HWRITE,
  input logic [2:0]  HSIZE,
  input logic [2:0]  HBURST,
  input logic        HREADY,
  input logic        HRESP
);

  parameter MAX_WAIT = 16;

  localparam logic [1:0] IDLE = 2'b00, BUSY = 2'b01, NONSEQ = 2'b10, SEQ = 2'b11;
  localparam logic [2:0] INCR = 3'b001;

  // $past() looks one edge back. past_ok is 0 at the first edge after reset,
  // so a property that uses $past() never looks at a cycle inside reset.
  logic past_ok;
  always_ff @(posedge HCLK or negedge HRESETn)
    if (!HRESETn) past_ok <= 1'b0;
    else          past_ok <= 1'b1;

  // ════════════════════════════════════════════════════════════
  // TODO 1: A waited NONSEQ/SEQ holds its address (3.6.2, 3.5.2)
  // ════════════════════════════════════════════════════════════
  // When HREADY is LOW and HTRANS is NONSEQ or SEQ, HADDR must be the same
  // at the next edge. Two legal exceptions must NOT fire:
  //   - a waited IDLE may change its address and become NONSEQ (3.6.1, 3.6.2).
  //     Start the check only on NONSEQ/SEQ, never on "HTRANS != IDLE" alone,
  //     because a waited BUSY has its own rules (TODO 3).
  //   - after the first ERROR cycle (HRESP high, HREADY low) a master that
  //     cancels drives IDLE and may change the address (3.5.2, 3.6.2).
  //
  // Hint: $past(HRESP) in the consequent is HRESP at the antecedent edge.
  //
  // property p_addr_stable;
  //   @(posedge HCLK) disable iff (!HRESETn)
  //     YOUR_ANTECEDENT |=> $stable(HADDR) || (YOUR_CANCEL_EXCEPTION);
  // endproperty
  // a_addr_stable: assert property (p_addr_stable)
  //   else $error("[AHB-CHK] Waited NONSEQ/SEQ changed HADDR without an ERROR to cancel it");
  // ════════════════════════════════════════════════════════════


  // ════════════════════════════════════════════════════════════
  // TODO 2: A waited NONSEQ/SEQ holds HTRANS and control (3.6.1, 3.5.2)
  // ════════════════════════════════════════════════════════════
  // Same antecedent and the same cancel exception, but check HTRANS,
  // HWRITE, HSIZE and HBURST.
  //
  // a_ctrl_stable: assert property (...)
  //   else $error("[AHB-CHK] Waited NONSEQ/SEQ changed HTRANS or control without an ERROR");
  // ════════════════════════════════════════════════════════════


  // ════════════════════════════════════════════════════════════
  // TODO 3: What a waited BUSY may change into (3.6.1, 3.5.2)
  // ════════════════════════════════════════════════════════════
  // When HREADY is LOW and HTRANS is BUSY, the next edge must show one of:
  //   - BUSY or SEQ at the same address (any burst: BUSY already carries the
  //     address of the next beat);
  //   - IDLE or NONSEQ, but only if the burst is an undefined-length INCR,
  //     which may end here;
  //   - IDLE after the first ERROR cycle (cancel).
  //
  // a_busy_in_wait: assert property (...)
  //   else $error("[AHB-CHK] Illegal change of a waited BUSY");
  // ════════════════════════════════════════════════════════════


  // ════════════════════════════════════════════════════════════
  // TODO 4: ERROR first cycle -> second cycle (5.1.3, Table 5-2)
  // ════════════════════════════════════════════════════════════
  // When HRESP is ERROR (1) AND HREADY is LOW (the first ERROR cycle),
  // the NEXT cycle must have HRESP=ERROR AND HREADY=HIGH.
  //
  // a_error_two_cycle: assert property (...)
  //   else $error("[AHB-CHK] ERROR first cycle not followed by the second");
  // ════════════════════════════════════════════════════════════


  // ════════════════════════════════════════════════════════════
  // TODO 5: An ERROR completion needs its first cycle (5.1.3, Table 5-2)
  // ════════════════════════════════════════════════════════════
  // TODO 4 cannot catch a slave that drives ERROR for ONE cycle with HREADY
  // high: its antecedent needs HREADY low, so it never even starts. Check
  // the other direction: whenever HRESP and HREADY are both high, the
  // previous cycle must have been the first ERROR cycle.
  //
  // Hint: (past_ok && HRESP && HREADY) |-> $past(HRESP && !HREADY)
  //
  // a_error_needs_first_cycle: assert property (...)
  //   else $error("[AHB-CHK] One-cycle ERROR: no first cycle with HREADY low");
  // ════════════════════════════════════════════════════════════


  // ════════════════════════════════════════════════════════════
  // TODO 6: Wait states use OKAY (5.1.2, 5.1.3, Table 5-2)
  // ════════════════════════════════════════════════════════════
  // HREADY low with HRESP high is the first ERROR cycle and nothing else,
  // so it must be the LAST wait state: the next cycle has HREADY high.
  // Every earlier wait state drives OKAY. (This overlaps with TODO 4, but
  // its message names the rule a slave breaks when it holds HRESP high
  // through several wait states.)
  //
  // a_wait_states_okay: assert property (...)
  //   else $error("[AHB-CHK] HRESP high in a wait state that is not the first ERROR cycle");
  // ════════════════════════════════════════════════════════════


  // ════════════════════════════════════════════════════════════
  // TODO 7: HREADY timeout (environment watchdog, NOT protocol)
  // ════════════════════════════════════════════════════════════
  // The spec only recommends that a slave inserts at most 16 wait states,
  // and names exceptions such as a serial boot ROM (note in 5.1.2). A slave
  // that waits longer is still legal, so report a breach of this budget as
  // a $warning and label it as policy.
  //
  // Hint: $fell(HREADY) |-> ##[1:MAX_WAIT] HREADY
  //
  // a_hready_timeout: assert property (...)
  //   else $warning("[AHB-WDOG] HREADY low for more than %0d cycles (testbench budget)", MAX_WAIT);
  // ════════════════════════════════════════════════════════════

endmodule
