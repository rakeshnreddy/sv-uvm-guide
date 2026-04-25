// solution.sv — Complete AXI Deadlock Checker Implementation
// All 5 assertions are implemented and will fire when the buggy slave
// creates an AWREADY → WVALID channel-dependency deadlock.

module axi_deadlock_checker #(
  parameter int MAX_WAIT = 32
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
  // cycles. If it never arrives, the slave has an illegal dependency.
  //==================================================================
  property p_aw_no_deadlock;
    @(posedge ACLK) disable iff (!ARESETn)
      AWVALID |-> ##[1:MAX_WAIT] AWREADY;
  endproperty

  assert property (p_aw_no_deadlock)
    else $error("SVA FAIL: p_aw_no_deadlock — AWVALID has been high for %0d cycles without AWREADY", MAX_WAIT);


  //==================================================================
  // Assertion 2: No W Channel Deadlock
  //==================================================================
  // When WVALID is asserted, WREADY must be asserted within MAX_WAIT
  // cycles. This catches stalls on the write data channel.
  //==================================================================
  property p_w_no_deadlock;
    @(posedge ACLK) disable iff (!ARESETn)
      WVALID |-> ##[1:MAX_WAIT] WREADY;
  endproperty

  assert property (p_w_no_deadlock)
    else $error("SVA FAIL: p_w_no_deadlock — WVALID has been high for %0d cycles without WREADY", MAX_WAIT);


  //==================================================================
  // Assertion 3: No AR Channel Deadlock
  //==================================================================
  // When ARVALID is asserted, ARREADY must be asserted within MAX_WAIT
  // cycles. Catches the cascading stall where a stuck write FSM
  // prevents the slave from accepting read addresses.
  //==================================================================
  property p_ar_no_deadlock;
    @(posedge ACLK) disable iff (!ARESETn)
      ARVALID |-> ##[1:MAX_WAIT] ARREADY;
  endproperty

  assert property (p_ar_no_deadlock)
    else $error("SVA FAIL: p_ar_no_deadlock — ARVALID has been high for %0d cycles without ARREADY", MAX_WAIT);


  //==================================================================
  // Assertion 4: VALID Stability
  //==================================================================
  // Once AWVALID is asserted, it must NOT be deasserted until AWREADY
  // is also asserted. Dropping VALID without a handshake is illegal.
  //==================================================================
  property p_valid_stability;
    @(posedge ACLK) disable iff (!ARESETn)
      (AWVALID && !AWREADY) |=> AWVALID;
  endproperty

  assert property (p_valid_stability)
    else $error("SVA FAIL: p_valid_stability — AWVALID dropped without AWREADY handshake");


  //==================================================================
  // Assertion 5: No Cross-Channel Stall
  //==================================================================
  // AWREADY must not be conditioned on WVALID. This assertion checks
  // that the slave can accept an address even without write data.
  //==================================================================
  property p_no_cross_channel_stall;
    @(posedge ACLK) disable iff (!ARESETn)
      (AWVALID && !WVALID) |-> ##[1:MAX_WAIT] AWREADY;
  endproperty

  assert property (p_no_cross_channel_stall)
    else $error("SVA FAIL: p_no_cross_channel_stall — AWREADY appears to depend on WVALID (illegal dependency)");


  //==================================================================
  // Additional Stability Assertions (bonus — for a robust VIP)
  //==================================================================

  // ARVALID stability
  property p_arvalid_stability;
    @(posedge ACLK) disable iff (!ARESETn)
      (ARVALID && !ARREADY) |=> ARVALID;
  endproperty
  assert property (p_arvalid_stability)
    else $error("SVA FAIL: ARVALID dropped without ARREADY handshake");

  // WVALID stability
  property p_wvalid_stability;
    @(posedge ACLK) disable iff (!ARESETn)
      (WVALID && !WREADY) |=> WVALID;
  endproperty
  assert property (p_wvalid_stability)
    else $error("SVA FAIL: WVALID dropped without WREADY handshake");

  // BVALID stability
  property p_bvalid_stability;
    @(posedge ACLK) disable iff (!ARESETn)
      (BVALID && !BREADY) |=> BVALID;
  endproperty
  assert property (p_bvalid_stability)
    else $error("SVA FAIL: BVALID dropped without BREADY handshake");

  // RVALID stability
  property p_rvalid_stability;
    @(posedge ACLK) disable iff (!ARESETn)
      (RVALID && !RREADY) |=> RVALID;
  endproperty
  assert property (p_rvalid_stability)
    else $error("SVA FAIL: RVALID dropped without RREADY handshake");


  //==================================================================
  // Cover Properties — verify positive scenarios
  //==================================================================
  cover property (@(posedge ACLK) disable iff (!ARESETn)
    AWVALID && AWREADY)
    $info("COVER: Successful AW handshake observed");

  cover property (@(posedge ACLK) disable iff (!ARESETn)
    ARVALID && ARREADY)
    $info("COVER: Successful AR handshake observed");

  cover property (@(posedge ACLK) disable iff (!ARESETn)
    WVALID && WREADY && WLAST)
    $info("COVER: Successful W last-beat handshake observed");

  cover property (@(posedge ACLK) disable iff (!ARESETn)
    BVALID && BREADY)
    $info("COVER: Successful B response handshake observed");

  cover property (@(posedge ACLK) disable iff (!ARESETn)
    RVALID && RREADY && RLAST)
    $info("COVER: Successful R last-beat handshake observed");

endmodule
