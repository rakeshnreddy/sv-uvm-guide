// Reference solution: a protocol-correct AXI channel checker.
// Compile it instead of axi_deadlock_checker.sv (same module name and ports).
// [Protocol] checks are IHI0022E rules. The service bounds are an optional
// [Integration contract]: AXI itself permits unbounded backpressure.
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

  // Handshake counters. Sampled at an edge, they hold the handshakes of earlier
  // edges, which is what "BVALID after the AW and WLAST handshakes" needs.
  // Counters (not set/clear flags) stay correct with several writes in flight
  // and when an AW or WLAST handshake lands on the same edge as a B handshake.
  int unsigned aw_cnt, wlast_cnt, b_cnt;

  always_ff @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn) begin
      aw_cnt    <= 0;
      wlast_cnt <= 0;
      b_cnt     <= 0;
    end else begin
      if (AWVALID && AWREADY)        aw_cnt    <= aw_cnt + 1;
      if (WVALID && WREADY && WLAST) wlast_cnt <= wlast_cnt + 1;
      if (BVALID && BREADY)          b_cnt     <= b_cnt + 1;
    end
  end

  // [Protocol A3.2.1] VALID stays HIGH and the information stays stable while
  // the destination stalls.
  property p_awvalid_stable;
    @(posedge ACLK) disable iff (!ARESETn)
      AWVALID && !AWREADY |=> AWVALID && $stable({AWID, AWADDR, AWLEN});
  endproperty
  assert property (p_awvalid_stable)
    else $error("[Protocol A3.2.1] AW VALID or payload changed while stalled");

  property p_wvalid_stable;
    @(posedge ACLK) disable iff (!ARESETn)
      WVALID && !WREADY |=> WVALID && $stable({WDATA, WSTRB, WLAST});
  endproperty
  assert property (p_wvalid_stable)
    else $error("[Protocol A3.2.1] W VALID or payload changed while stalled");

  property p_arvalid_stable;
    @(posedge ACLK) disable iff (!ARESETn)
      ARVALID && !ARREADY |=> ARVALID && $stable({ARID, ARADDR, ARLEN});
  endproperty
  assert property (p_arvalid_stable)
    else $error("[Protocol A3.2.1] AR VALID or payload changed while stalled");

  property p_bvalid_stable;
    @(posedge ACLK) disable iff (!ARESETn)
      BVALID && !BREADY |=> BVALID && $stable({BID, BRESP});
  endproperty
  assert property (p_bvalid_stable)
    else $error("[Protocol A3.2.1] B VALID or payload changed while stalled");

  property p_rvalid_stable;
    @(posedge ACLK) disable iff (!ARESETn)
      RVALID && !RREADY |=> RVALID && $stable({RID, RDATA, RRESP, RLAST});
  endproperty
  assert property (p_rvalid_stable)
    else $error("[Protocol A3.2.1] R VALID or payload changed while stalled");

  // [Protocol A3.3.1, AXI4 write response dependency]
  property p_bvalid_after_write_completion;
    @(posedge ACLK) disable iff (!ARESETn)
      BVALID |-> aw_cnt > b_cnt && wlast_cnt > b_cnt;
  endproperty
  assert property (p_bvalid_after_write_completion)
    else $error("[Protocol A3.3.1] BVALID before its AW and WLAST handshakes");

  // [Integration contract] Each stall must end within MAX_WAIT edges. AXI does
  // not require this. $rose(VALID && !READY) is true only on the first stalled
  // edge, so one long stall reports once instead of on every later cycle.
  generate
    if (ENABLE_SERVICE_BOUNDS) begin : g_service_bounds
      property p_service_bound(valid, ready);
        @(posedge ACLK) disable iff (!ARESETn)
          $rose(valid && !ready) |-> ##[1:MAX_WAIT] ready;
      endproperty

      assert property (p_service_bound(AWVALID, AWREADY))
        else $error("[Integration contract] AW stalled more than %0d edges", MAX_WAIT);
      assert property (p_service_bound(WVALID, WREADY))
        else $error("[Integration contract] W stalled more than %0d edges", MAX_WAIT);
      assert property (p_service_bound(ARVALID, ARREADY))
        else $error("[Integration contract] AR stalled more than %0d edges", MAX_WAIT);
    end
  endgenerate

  cover property (@(posedge ACLK) disable iff (!ARESETn) AWVALID && AWREADY);
  cover property (@(posedge ACLK) disable iff (!ARESETn) WVALID && WREADY && WLAST);
  cover property (@(posedge ACLK) disable iff (!ARESETn) BVALID && BREADY);
  cover property (@(posedge ACLK) disable iff (!ARESETn) ARVALID && ARREADY);
  cover property (@(posedge ACLK) disable iff (!ARESETn) RVALID && RREADY && RLAST);
endmodule
