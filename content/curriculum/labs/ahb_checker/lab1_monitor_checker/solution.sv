// ============================================================================
// AHB-Lite Monitor & Checker — SOLUTION
// ============================================================================

// Pull in the lab-owned interface, transaction, DUT/BFM, and starter module
// declarations so this reference is a compileable smoke-test translation unit.
`include "testbench.sv"
`include "ahb_monitor.sv"
`include "ahb_checker.sv"
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
// Section numbers refer to Arm IHI0033B.b (AMBA 5 AHB). Protocol properties
// report $error; the HREADY watchdog is a testbench budget and reports
// $warning.
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

  localparam logic [1:0] IDLE = 2'b00, BUSY = 2'b01, NONSEQ = 2'b10, SEQ = 2'b11;
  localparam logic [2:0] INCR = 3'b001;

  // 0 at the first edge after reset, so $past() never looks inside reset.
  logic past_ok;
  always_ff @(posedge HCLK or negedge HRESETn)
    if (!HRESETn) past_ok <= 1'b0;
    else          past_ok <= 1'b1;

  // ── Protocol: wait states ──────────────────────────────────

  // 1. [3.6.2, 3.5.2] A waited NONSEQ/SEQ holds its address. A waited IDLE
  //    may change address and become NONSEQ, so IDLE never starts the check.
  //    A master that cancels after the first ERROR cycle drives IDLE and may
  //    change the address.
  property p_addr_stable;
    @(posedge HCLK) disable iff (!HRESETn)
      (!HREADY && HTRANS inside {NONSEQ, SEQ}) |=>
        $stable(HADDR) || ($past(HRESP) && HTRANS == IDLE);
  endproperty
  a_addr_stable: assert property (p_addr_stable)
    else $error("[AHB-CHK] Waited NONSEQ/SEQ changed HADDR without an ERROR to cancel it at time %0t", $time);

  // 2. [3.6.1, 3.5.2] ... and holds HTRANS and control, with the same
  //    cancel exception.
  property p_ctrl_stable;
    @(posedge HCLK) disable iff (!HRESETn)
      (!HREADY && HTRANS inside {NONSEQ, SEQ}) |=>
          ($stable(HTRANS) && $stable({HWRITE, HSIZE, HBURST}))
       || ($past(HRESP) && HTRANS == IDLE);
  endproperty
  a_ctrl_stable: assert property (p_ctrl_stable)
    else $error("[AHB-CHK] Waited NONSEQ/SEQ changed HTRANS or control without an ERROR at time %0t", $time);

  // 3. [3.6.1, 3.5.2] A waited BUSY may stay BUSY or become SEQ at the same
  //    address; in an undefined-length INCR it may also end the burst with
  //    IDLE or NONSEQ; after the first ERROR cycle it may cancel to IDLE.
  property p_busy_in_wait;
    @(posedge HCLK) disable iff (!HRESETn)
      (!HREADY && HTRANS == BUSY) |=>
          (HTRANS inside {BUSY, SEQ} && $stable(HADDR))
       || ($past(HBURST) == INCR && HTRANS inside {IDLE, NONSEQ})
       || ($past(HRESP) && HTRANS == IDLE);
  endproperty
  a_busy_in_wait: assert property (p_busy_in_wait)
    else $error("[AHB-CHK] Illegal change of a waited BUSY at time %0t", $time);

  // ── Protocol: responses ────────────────────────────────────

  // 4. [5.1.3, Table 5-2] ERROR first cycle -> second cycle.
  property p_error_two_cycle;
    @(posedge HCLK) disable iff (!HRESETn)
      (HRESP && !HREADY) |=> (HRESP && HREADY);
  endproperty
  a_error_two_cycle: assert property (p_error_two_cycle)
    else $error("[AHB-CHK] ERROR first cycle not followed by the second at time %0t", $time);

  // 5. [5.1.3, Table 5-2] An ERROR completion needs its first cycle. This is
  //    the property that catches a one-cycle ERROR (Bug B): property 4 never
  //    starts on it, because its antecedent needs HREADY low.
  property p_error_needs_first_cycle;
    @(posedge HCLK) disable iff (!HRESETn)
      (past_ok && HRESP && HREADY) |-> $past(HRESP && !HREADY);
  endproperty
  a_error_needs_first_cycle: assert property (p_error_needs_first_cycle)
    else $error("[AHB-CHK] One-cycle ERROR: no first cycle with HREADY low at time %0t", $time);

  // 6. [5.1.2, 5.1.3, Table 5-2] Wait states use OKAY. HREADY low with HRESP
  //    high is the first ERROR cycle, so it must be the last wait state.
  //    Overlaps with property 4, but names the rule a slave breaks when it
  //    holds HRESP high through several wait states.
  property p_wait_states_okay;
    @(posedge HCLK) disable iff (!HRESETn)
      (!HREADY && HRESP) |=> HREADY;
  endproperty
  a_wait_states_okay: assert property (p_wait_states_okay)
    else $error("[AHB-CHK] HRESP high in a wait state that is not the first ERROR cycle at time %0t", $time);

  // ── Environment watchdog (policy, NOT protocol) ────────────

  // 7. The spec only recommends at most 16 wait states and names exceptions
  //    such as a serial boot ROM (note in 5.1.2). MAX_WAIT is this
  //    testbench's latency budget, so a breach is a warning.
  property p_hready_timeout;
    @(posedge HCLK) disable iff (!HRESETn)
      $fell(HREADY) |-> ##[1:MAX_WAIT] HREADY;
  endproperty
  a_hready_timeout: assert property (p_hready_timeout)
    else $warning("[AHB-WDOG] HREADY low for more than %0d cycles at time %0t (testbench budget, not a protocol rule)", MAX_WAIT, $time);

endmodule
