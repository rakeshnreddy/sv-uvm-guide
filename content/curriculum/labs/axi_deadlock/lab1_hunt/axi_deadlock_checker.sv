// axi_deadlock_checker.sv — Starter File
// Complete the SVA protocol assertions to detect AXI channel-dependency deadlocks.
//
// The assertions in this module should catch ILLEGAL channel dependencies
// that violate the AXI specification's handshake rules (A3.3 / A3.4).
// When the buggy slave creates a deadlock, these assertions should fire
// with clear diagnostic messages.

module axi_deadlock_checker #(
  parameter int MAX_WAIT = 32  // Maximum cycles to wait for a handshake
)(
  input logic ACLK,
  input logic ARESETn,

  // AW Channel
  input logic AWVALID,
  input logic AWREADY,

  // W Channel
  input logic WVALID,
  input logic WREADY,

  // B Channel
  input logic BVALID,
  input logic BREADY,

  // AR Channel
  input logic ARVALID,
  input logic ARREADY,

  // R Channel
  input logic RVALID,
  input logic RREADY
);

  //==================================================================
  // Assertion 1: No AW Channel Deadlock
  //==================================================================
  // When AWVALID is asserted, AWREADY must be asserted within MAX_WAIT
  // cycles. If it never arrives, the slave has an illegal dependency
  // (likely waiting for WVALID before accepting the address).
  //
  // Hint: Use a bounded liveness check:
  //   AWVALID |-> ##[1:MAX_WAIT] AWREADY
  //==================================================================

  // TODO: Complete this assertion
  // property p_aw_no_deadlock;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     --- YOUR CODE HERE ---;
  // endproperty
  //
  // assert property (p_aw_no_deadlock)
  //   else $error("SVA FAIL: p_aw_no_deadlock — AWVALID has been high for %0d cycles without AWREADY", MAX_WAIT);


  //==================================================================
  // Assertion 2: No W Channel Deadlock
  //==================================================================
  // When WVALID is asserted, WREADY must be asserted within MAX_WAIT
  // cycles. This catches stalls on the write data channel.
  //==================================================================

  // TODO: Complete this assertion
  // property p_w_no_deadlock;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     --- YOUR CODE HERE ---;
  // endproperty
  //
  // assert property (p_w_no_deadlock)
  //   else $error("SVA FAIL: p_w_no_deadlock — WVALID has been high for %0d cycles without WREADY", MAX_WAIT);


  //==================================================================
  // Assertion 3: No AR Channel Deadlock
  //==================================================================
  // When ARVALID is asserted, ARREADY must be asserted within MAX_WAIT
  // cycles. This catches the cascading effect where a stuck write FSM
  // prevents the slave from accepting read addresses.
  //==================================================================

  // TODO: Complete this assertion
  // property p_ar_no_deadlock;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     --- YOUR CODE HERE ---;
  // endproperty
  //
  // assert property (p_ar_no_deadlock)
  //   else $error("SVA FAIL: p_ar_no_deadlock — ARVALID has been high for %0d cycles without ARREADY", MAX_WAIT);


  //==================================================================
  // Assertion 4: VALID Stability
  //==================================================================
  // Once AWVALID is asserted, it must NOT be deasserted until AWREADY
  // is also asserted (a handshake occurs). Dropping VALID without a
  // handshake is an AXI protocol violation.
  //
  // Hint: The pattern is:
  //   (AWVALID && !AWREADY) |=> AWVALID
  // This says: if VALID is high and READY is low, then on the NEXT
  // cycle, VALID must still be high.
  //==================================================================

  // TODO: Complete this assertion
  // property p_valid_stability;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     --- YOUR CODE HERE ---;
  // endproperty
  //
  // assert property (p_valid_stability)
  //   else $error("SVA FAIL: p_valid_stability — AWVALID dropped without AWREADY handshake");


  //==================================================================
  // Assertion 5: No Cross-Channel Stall (AWREADY independence from W)
  //==================================================================
  // This is the most specific assertion. It checks that AWREADY is
  // NOT conditioned on WVALID by verifying that the slave CAN accept
  // an address when no write data is present.
  //
  // Approach: Assert that when AWVALID is high AND WVALID is low,
  // AWREADY must still eventually go high within MAX_WAIT cycles.
  // If it never does, the slave has an illegal AWREADY → WVALID dep.
  //
  // Hint:
  //   (AWVALID && !WVALID) |-> ##[1:MAX_WAIT] AWREADY
  //==================================================================

  // TODO: Complete this assertion
  // property p_no_cross_channel_stall;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     --- YOUR CODE HERE ---;
  // endproperty
  //
  // assert property (p_no_cross_channel_stall)
  //   else $error("SVA FAIL: p_no_cross_channel_stall — AWREADY appears to depend on WVALID (illegal dependency)");


  //==================================================================
  // Optional Cover Properties (for debug visibility)
  //==================================================================
  // These covers help verify that your assertions are not vacuously
  // true. They should fire if the design is working correctly.
  //==================================================================

  // Cover: A successful AW handshake occurs
  // cover property (@(posedge ACLK) disable iff (!ARESETn)
  //   AWVALID && AWREADY);

  // Cover: A successful AR handshake occurs
  // cover property (@(posedge ACLK) disable iff (!ARESETn)
  //   ARVALID && ARREADY);

endmodule
