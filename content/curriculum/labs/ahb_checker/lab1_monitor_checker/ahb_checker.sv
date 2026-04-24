// ============================================================================
// AHB-Lite Protocol Checker — STARTER FILE
// ============================================================================
// TODO: Implement SVA properties that catch common AHB protocol violations.
//
// You need to write 4 assertions:
//   1. Address stability during wait states
//   2. Control signal stability during wait states
//   3. Two-cycle ERROR response protocol
//   4. HREADY timeout (max 16 cycles)
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

  // ════════════════════════════════════════════════════════════
  // TODO 1: Address stability during wait states
  // ════════════════════════════════════════════════════════════
  // When HREADY is LOW and HTRANS is not IDLE (2'b00),
  // HADDR must remain stable on the next clock edge.
  //
  // Hint: Use $stable(HADDR) in the consequent.
  //
  // property p_addr_stable;
  //   @(posedge HCLK) disable iff (!HRESETn)
  //     YOUR_ANTECEDENT |=> YOUR_CONSEQUENT;
  // endproperty
  // assert property (p_addr_stable)
  //   else $error("[AHB-CHK] HADDR changed during wait state");
  // ════════════════════════════════════════════════════════════


  // ════════════════════════════════════════════════════════════
  // TODO 2: Control signal stability during wait states
  // ════════════════════════════════════════════════════════════
  // Same condition as above, but check HWRITE, HSIZE, and HBURST.
  //
  // assert property (...)
  //   else $error("[AHB-CHK] Control signals changed during wait state");
  // ════════════════════════════════════════════════════════════


  // ════════════════════════════════════════════════════════════
  // TODO 3: Two-cycle ERROR response
  // ════════════════════════════════════════════════════════════
  // When HRESP is ERROR (1) AND HREADY is LOW,
  // the NEXT cycle must have HRESP=ERROR AND HREADY=HIGH.
  //
  // This is the two-cycle ERROR protocol from the spec.
  //
  // assert property (...)
  //   else $error("[AHB-CHK] ERROR response violated two-cycle protocol");
  // ════════════════════════════════════════════════════════════


  // ════════════════════════════════════════════════════════════
  // TODO 4: HREADY timeout
  // ════════════════════════════════════════════════════════════
  // When HREADY falls, it must rise again within MAX_WAIT cycles.
  //
  // Hint: Use $fell(HREADY) |-> ##[1:MAX_WAIT] HREADY
  //
  // assert property (...)
  //   else $error("[AHB-CHK] HREADY low for > %0d cycles", MAX_WAIT);
  // ════════════════════════════════════════════════════════════

endmodule
