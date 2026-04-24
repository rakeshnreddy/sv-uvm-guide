// ============================================================================
// AHB-Lite Monitor — STARTER FILE
// ============================================================================
// TODO: Complete this module to reconstruct AHB transactions from the
//       pipelined bus signals.
//
// The monitor is PASSIVE — it does not drive any signals.
// It observes HADDR, HTRANS, HWRITE, HSIZE, HBURST during the address phase
// and HWDATA/HRDATA, HREADY, HRESP during the data phase.
//
// Because AHB is pipelined, the address phase of transfer N overlaps with
// the data phase of transfer N-1.  You must BUFFER the address phase and
// pair it with the data phase that completes later.
// ============================================================================

module ahb_monitor (
  ahb_if.monitor bus,
  input logic    HCLK,
  input logic    HRESETn
);

  // Pipeline buffer for the pending transaction
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

      // ════════════════════════════════════════════════════════
      // TODO 1: DATA PHASE SAMPLING
      // ════════════════════════════════════════════════════════
      // When there is a pending transaction AND HREADY is high,
      // the data phase is complete.  You should:
      //   1. Read HWDATA (if write) or HRDATA (if read)
      //   2. Read HRESP
      //   3. Display the completed transaction using $display
      //   4. Clear pending_valid
      //
      // When there is a pending transaction AND HREADY is LOW,
      // the slave is inserting a wait state. Increment pending_waits.
      //
      // YOUR CODE HERE:
      //
      // ════════════════════════════════════════════════════════


      // ════════════════════════════════════════════════════════
      // TODO 2: ADDRESS PHASE CAPTURE
      // ════════════════════════════════════════════════════════
      // When HTRANS is NONSEQ (2'b10) or SEQ (2'b11) AND HREADY
      // is high, the bus is presenting a new address phase.
      // Buffer: HADDR, HWRITE, HSIZE, HBURST, HTRANS
      // Set pending_valid = 1 and reset pending_waits = 0
      //
      // IMPORTANT: Only capture when HREADY is HIGH!
      // During a wait state, the address is held stable but has
      // NOT been accepted yet.
      //
      // YOUR CODE HERE:
      //
      // ════════════════════════════════════════════════════════

    end
  end

endmodule
