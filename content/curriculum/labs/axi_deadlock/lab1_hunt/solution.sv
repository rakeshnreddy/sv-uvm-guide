// Complete protocol-correct AXI channel checker.
// READY service bounds are optional environment policy, not base AXI rules.
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

  logic aw_complete;
  logic final_w_complete;

  always_ff @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn) begin
      aw_complete      <= 1'b0;
      final_w_complete <= 1'b0;
    end else begin
      if (AWVALID && AWREADY) aw_complete <= 1'b1;
      if (WVALID && WREADY && WLAST) final_w_complete <= 1'b1;
      if (BVALID && BREADY) begin
        aw_complete      <= 1'b0;
        final_w_complete <= 1'b0;
      end
    end
  end

  property p_awvalid_stable;
    @(posedge ACLK) disable iff (!ARESETn)
      AWVALID && !AWREADY |=> AWVALID && $stable({AWID, AWADDR, AWLEN});
  endproperty
  assert property (p_awvalid_stable)
    else $error("AW VALID or payload changed while stalled");

  property p_wvalid_stable;
    @(posedge ACLK) disable iff (!ARESETn)
      WVALID && !WREADY |=> WVALID && $stable({WDATA, WSTRB, WLAST});
  endproperty
  assert property (p_wvalid_stable)
    else $error("W channel payload changed while stalled");

  property p_arvalid_stable;
    @(posedge ACLK) disable iff (!ARESETn)
      ARVALID && !ARREADY |=> ARVALID && $stable({ARID, ARADDR, ARLEN});
  endproperty
  assert property (p_arvalid_stable)
    else $error("AR VALID or payload changed while stalled");

  property p_bvalid_stable;
    @(posedge ACLK) disable iff (!ARESETn)
      BVALID && !BREADY |=> BVALID && $stable({BID, BRESP});
  endproperty
  assert property (p_bvalid_stable)
    else $error("B VALID or payload changed while stalled");

  property p_rvalid_stable;
    @(posedge ACLK) disable iff (!ARESETn)
      RVALID && !RREADY |=> RVALID && $stable({RID, RDATA, RRESP, RLAST});
  endproperty
  assert property (p_rvalid_stable)
    else $error("R VALID or payload changed while stalled");

  property p_bvalid_after_write_completion;
    @(posedge ACLK) disable iff (!ARESETn)
      BVALID |-> aw_complete && final_w_complete;
  endproperty
  assert property (p_bvalid_after_write_completion)
    else $error("BVALID asserted before AW and final-W handshakes completed");

  // These bounded checks are an optional integration/QoS contract. AXI itself
  // permits unbounded backpressure and does not require READY within MAX_WAIT.
  generate
    if (ENABLE_SERVICE_BOUNDS) begin : g_service_bounds
      property p_aw_service_bound;
        @(posedge ACLK) disable iff (!ARESETn)
          AWVALID |-> ##[0:MAX_WAIT] AWREADY;
      endproperty
      assert property (p_aw_service_bound)
        else $error("AW channel exceeded configured service bound");

      property p_w_service_bound;
        @(posedge ACLK) disable iff (!ARESETn)
          WVALID |-> ##[0:MAX_WAIT] WREADY;
      endproperty
      assert property (p_w_service_bound)
        else $error("W channel exceeded configured service bound");

      property p_ar_service_bound;
        @(posedge ACLK) disable iff (!ARESETn)
          ARVALID |-> ##[0:MAX_WAIT] ARREADY;
      endproperty
      assert property (p_ar_service_bound)
        else $error("AR channel exceeded configured service bound");
    end
  endgenerate

  cover property (@(posedge ACLK) disable iff (!ARESETn) AWVALID && AWREADY);
  cover property (@(posedge ACLK) disable iff (!ARESETn) WVALID && WREADY && WLAST);
  cover property (@(posedge ACLK) disable iff (!ARESETn) BVALID && BREADY);
  cover property (@(posedge ACLK) disable iff (!ARESETn) ARVALID && ARREADY);
  cover property (@(posedge ACLK) disable iff (!ARESETn) RVALID && RREADY && RLAST);
endmodule
