// ============================================================================
// AHB-Lite Monitor & Checker — SOLUTION
// ============================================================================
// This file contains the completed monitor and checker implementations.
// ============================================================================

// ─────────────────────────────────────────────────────────────
// SOLUTION: AHB Monitor
// ─────────────────────────────────────────────────────────────
module ahb_monitor_solution (
  ahb_if.monitor bus,
  input logic    HCLK,
  input logic    HRESETn
);

  logic [31:0] pending_addr;
  logic        pending_write;
  logic [2:0]  pending_size;
  logic [2:0]  pending_burst;
  logic [1:0]  pending_trans;
  logic        pending_valid;
  int unsigned pending_waits;

  always_ff @(posedge HCLK or negedge HRESETn) begin
    if (!HRESETn) begin
      pending_valid <= 1'b0;
      pending_waits <= 0;
    end else begin

      // ── Data phase sampling ──
      if (pending_valid && bus.HREADY) begin
        // Data phase complete — sample data and report
        if (pending_write)
          $display("[MON] %s addr=0x%08h data=0x%08h size=%0d waits=%0d resp=%s",
            "WR", pending_addr, bus.HWDATA, pending_size, pending_waits,
            bus.HRESP ? "ERROR" : "OKAY");
        else
          $display("[MON] %s addr=0x%08h data=0x%08h size=%0d waits=%0d resp=%s",
            "RD", pending_addr, bus.HRDATA, pending_size, pending_waits,
            bus.HRESP ? "ERROR" : "OKAY");
        pending_valid <= 1'b0;
      end else if (pending_valid && !bus.HREADY) begin
        // Wait state — increment counter
        pending_waits <= pending_waits + 1;
      end

      // ── Address phase capture (only when HREADY is high) ──
      if (bus.HTRANS inside {2'b10, 2'b11} && bus.HREADY) begin
        pending_addr  <= bus.HADDR;
        pending_write <= bus.HWRITE;
        pending_size  <= bus.HSIZE;
        pending_burst <= bus.HBURST;
        pending_trans <= bus.HTRANS;
        pending_valid <= 1'b1;
        pending_waits <= 0;
      end

    end
  end

endmodule


// ─────────────────────────────────────────────────────────────
// SOLUTION: AHB Protocol Checker
// ─────────────────────────────────────────────────────────────
module ahb_checker_solution (
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

  // 1. Address stability during wait states
  property p_addr_stable;
    @(posedge HCLK) disable iff (!HRESETn)
      (!HREADY && HTRANS != 2'b00) |=> $stable(HADDR);
  endproperty
  a_addr_stable: assert property (p_addr_stable)
    else $error("[AHB-CHK] HADDR changed during wait state at time %0t", $time);

  // 2. Control signal stability during wait states
  property p_ctrl_stable;
    @(posedge HCLK) disable iff (!HRESETn)
      (!HREADY && HTRANS != 2'b00) |=>
        $stable(HWRITE) && $stable(HSIZE) && $stable(HBURST);
  endproperty
  a_ctrl_stable: assert property (p_ctrl_stable)
    else $error("[AHB-CHK] Control signals changed during wait state at time %0t", $time);

  // 3. Two-cycle ERROR response protocol
  property p_error_two_cycle;
    @(posedge HCLK) disable iff (!HRESETn)
      (HRESP && !HREADY) |=> (HRESP && HREADY);
  endproperty
  a_error_two_cycle: assert property (p_error_two_cycle)
    else $error("[AHB-CHK] ERROR response violated two-cycle protocol at time %0t", $time);

  // 4. HREADY timeout
  property p_hready_timeout;
    @(posedge HCLK) disable iff (!HRESETn)
      $fell(HREADY) |-> ##[1:MAX_WAIT] HREADY;
  endproperty
  a_hready_timeout: assert property (p_hready_timeout)
    else $error("[AHB-CHK] HREADY low for > %0d cycles at time %0t", MAX_WAIT, $time);

endmodule
