// Starter: complete the protocol assertions below.
// Pin-level checks see symptoms; they cannot see a dependency inside the master.
// READY latency bounds are an optional integration contract, never an AXI rule.
module axi_deadlock_checker #(
  parameter int MAX_WAIT = 32,
  parameter bit ENABLE_SERVICE_BOUNDS = 1'b0
)(
  input logic ACLK,
  input logic ARESETn,
  input logic AWVALID, AWREADY,
  input logic [3:0] AWID,
  input logic [31:0] AWADDR,
  input logic [7:0] AWLEN,
  input logic WVALID, WREADY,
  input logic [31:0] WDATA,
  input logic [3:0] WSTRB,
  input logic WLAST,
  input logic BVALID, BREADY,
  input logic [3:0] BID,
  input logic [1:0] BRESP,
  input logic ARVALID, ARREADY,
  input logic [3:0] ARID,
  input logic [31:0] ARADDR,
  input logic [7:0] ARLEN,
  input logic RVALID, RREADY,
  input logic [3:0] RID,
  input logic [31:0] RDATA,
  input logic [1:0] RRESP,
  input logic RLAST
);

  // Required protocol rules (IHI0022E):
  // 1. A3.2.1: once a source asserts VALID, VALID and its payload stay stable
  //    until the handshake.
  // 2. A3.3.1 (AXI4): BVALID only after both the AW and the WLAST handshakes.
  // TODO: implement separate AW, W, AR, B, and R stability properties.
  // TODO: count AW, WLAST and B handshakes and check
  //       BVALID |-> aw_cnt > b_cnt && wlast_cnt > b_cnt
  //       (counters stay correct with several writes in flight; set/clear flags
  //       lose a handshake that lands on the same edge as a B handshake).
  // Example:
  // property p_wvalid_stable;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     WVALID && !WREADY |=> WVALID && $stable({WDATA, WSTRB, WLAST});
  // endproperty
  // assert property (p_wvalid_stable)
  //   else $error("[Protocol A3.2.1] W channel payload changed while stalled");

  // Optional integration contract. Gate bounded AW/W/AR READY checks here and
  // label their messages "[Integration contract]", not as AXI protocol rules.
  // Hint: start one attempt per stall with $rose(VALID && !READY), so a long
  // stall reports once instead of on every cycle.
  generate
    if (ENABLE_SERVICE_BOUNDS) begin : g_service_bounds
      // TODO: add AW, W and AR service-bound properties using MAX_WAIT.
    end
  endgenerate
endmodule
