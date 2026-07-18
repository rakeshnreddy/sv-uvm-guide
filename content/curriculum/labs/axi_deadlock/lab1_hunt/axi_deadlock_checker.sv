// Starter: complete the protocol assertions below.
// Pin-level checks can detect symptoms, but cannot prove an internal signal dependency.
// READY latency bounds are optional environment policy, never a generic AXI requirement.
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

  // Required protocol rules:
  // 1. Once a source asserts VALID, VALID and its payload stay stable until handshake.
  // 2. BVALID follows completed AW and final-W handshakes.
  // TODO: implement AW, W, AR, B, and R stability properties.
  // Example:
  // property p_wvalid_stable;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     WVALID && !WREADY |=> WVALID && $stable({WDATA, WSTRB, WLAST});
  // endproperty
  // assert property (p_wvalid_stable)
  //   else $error("W channel payload changed while stalled");

  // Optional integration/QoS policy. Gate any bounded READY watchdog here.
  // This must not be labeled as a base AXI protocol assertion.
  generate
    if (ENABLE_SERVICE_BOUNDS) begin : g_service_bounds
      // TODO: add *_service_bound properties for locally configured latency limits.
    end
  endgenerate
endmodule
