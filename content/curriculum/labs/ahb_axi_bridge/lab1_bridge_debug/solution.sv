// solution.sv — AHB-to-AXI Bridge Debug Lab Reference Solution
//
// This file contains:
// 1. A completed bridge_split_checker. It defines the same module name as the
//    starter, so compile it in place of bridge_split_checker.sv (copy it over
//    the starter, or point the `include in testbench.sv at this file).
// 2. The corrected split helper for the bridge DUT.
//
// Tags: [AHB protocol] Arm IHI0033B.b, [AXI protocol] Arm IHI0022E,
//       [Bridge design] a choice this bridge made.

module bridge_split_checker #(
  parameter int MAX_AW_LATENCY = 16
)(
  input logic        ACLK,
  input logic        ARESETn,

  input logic        plan_valid,
  input logic [31:0] plan_addr,
  input logic [10:0] plan_beats,
  input logic [2:0]  plan_size,

  input logic        AWVALID,
  input logic        AWREADY,
  input logic [31:0] AWADDR,
  input logic [7:0]  AWLEN,
  input logic [2:0]  AWSIZE,
  input logic [1:0]  AWBURST,

  input logic        WVALID,
  input logic        WREADY,
  input logic        WLAST,

  input logic        bridge_done
);

  // AXI4 INCR bursts carry 1 to 256 transfers (IHI0022E A3.4.1).
  localparam int AXI4_MAX_INCR_BEATS = 256;

  int unsigned failures;
  logic [2:0]  active_plan_size;
  logic [8:0]  aw_transfers;      // AWLEN + 1 of the burst being written
  int          w_in_burst;        // W transfers seen so far in that burst
  int          expected_w_beats;  // transfers in the AHB request
  int          observed_w_beats;  // W transfers sent for it

  function automatic int beat_bytes(input logic [2:0] size);
    return 1 << size;
  endfunction

  function automatic bit plan_crosses_1kb(
    input logic [31:0] addr,
    input logic [10:0] beats,
    input logic [2:0]  size
  );
    return (int'(addr[9:0]) + (int'(beats) * beat_bytes(size))) > 1024;
  endfunction

  function automatic bit axi_crosses_4kb(
    input logic [31:0] addr,
    input logic [7:0]  len,
    input logic [2:0]  size
  );
    return (int'(addr[11:0]) + ((int'(len) + 1) * beat_bytes(size))) > 4096;
  endfunction

  always_ff @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn)        active_plan_size <= '0;
    else if (plan_valid) active_plan_size <= plan_size;
  end

  // [AXI protocol, A3.4.1] Safety net: no AXI INCR burst crosses 4KB. It
  // cannot fire on legal AHB input, which stays inside one 1KB region.
  property p_no_axi_4kb_cross;
    @(posedge ACLK) disable iff (!ARESETn)
      (AWVALID && AWREADY && AWBURST == 2'b01) |-> !axi_crosses_4kb(AWADDR, AWLEN, AWSIZE);
  endproperty

  a_no_axi_4kb_cross: assert property (p_no_axi_4kb_cross)
    else begin
      failures++;
      $error("AXI burst crosses 4KB: AWADDR=0x%08h AWLEN=%0d AWSIZE=%0d", AWADDR, AWLEN, AWSIZE);
    end

  // [Bridge design] Same bus width on both sides, so AWSIZE equals HSIZE.
  property p_aw_size_matches_plan;
    @(posedge ACLK) disable iff (!ARESETn)
      (AWVALID && AWREADY) |-> (AWSIZE == active_plan_size);
  endproperty

  a_aw_size_matches_plan: assert property (p_aw_size_matches_plan)
    else begin
      failures++;
      $error("AWSIZE=%0d does not match the AHB HSIZE=%0d", AWSIZE, active_plan_size);
    end

  // [Bridge design] An AHB INCR request becomes AXI INCR bursts.
  property p_aw_incr_only;
    @(posedge ACLK) disable iff (!ARESETn)
      (AWVALID && AWREADY) |-> (AWBURST == 2'b01);
  endproperty

  a_aw_incr_only: assert property (p_aw_incr_only)
    else begin
      failures++;
      $error("The bridge should emit AXI INCR bursts for an AHB INCR request");
    end

  // TODO 1 [AHB protocol, IHI0033B.b 3.5] The AHB stimulus is legal.
  property p_ahb_input_no_1kb_cross;
    @(posedge ACLK) disable iff (!ARESETn)
      plan_valid |-> !plan_crosses_1kb(plan_addr, plan_beats, plan_size);
  endproperty

  a_ahb_input_no_1kb_cross: assert property (p_ahb_input_no_1kb_cross)
    else begin
      failures++;
      $error("ILLEGAL AHB STIMULUS: INCR at 0x%08h with %0d x %0d bytes crosses a 1KB boundary (IHI0033B.b 3.5). Fix the stimulus, not the bridge.",
             plan_addr, plan_beats, beat_bytes(plan_size));
    end

  // TODO 3 [Bridge design, using the A3.4.1 limit] A request longer than 256
  // transfers starts with a full 256-transfer AXI burst at the request address.
  property p_first_split_len;
    @(posedge ACLK) disable iff (!ARESETn)
      (plan_valid && plan_beats > AXI4_MAX_INCR_BEATS)
        |-> ##[1:MAX_AW_LATENCY]
          (AWVALID && AWREADY && AWADDR == plan_addr && AWLEN == 8'd255);
  endproperty

  a_first_split_len: assert property (p_first_split_len)
    else begin
      failures++;
      $error("First AXI burst for a %0d-transfer request at 0x%08h is not a full 256-transfer burst",
             plan_beats, plan_addr);
    end

  // TODO 2 [AXI protocol, A3.4.1 and A3.2.2] Each burst carries AWLEN+1
  // transfers and WLAST marks the last one.
  // TODO 4 [Bridge design] Total W transfers per request = AHB transfers.
  always @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn) begin
      aw_transfers     <= '0;
      w_in_burst       <= 0;
      expected_w_beats <= 0;
      observed_w_beats <= 0;
    end else begin
      if (AWVALID && AWREADY) begin
        aw_transfers <= 9'(AWLEN) + 9'd1;
        w_in_burst   <= 0;
      end

      if (WVALID && WREADY) begin
        if (WLAST && (w_in_burst + 1 != aw_transfers)) begin
          failures++;
          $error("AXI W: WLAST on transfer %0d, but AW announced %0d transfers (AWLEN=%0d)",
                 w_in_burst + 1, aw_transfers, aw_transfers - 1);
        end
        if (!WLAST && (w_in_burst + 1 == aw_transfers)) begin
          failures++;
          $error("AXI W: transfer %0d is the last of a %0d-transfer burst, but WLAST is low",
                 w_in_burst + 1, aw_transfers);
        end
        w_in_burst <= WLAST ? 0 : w_in_burst + 1;
      end

      if (plan_valid) begin
        expected_w_beats <= plan_beats;
        observed_w_beats <= 0;
      end else if (WVALID && WREADY) begin
        observed_w_beats <= observed_w_beats + 1;
      end

      if (bridge_done && (observed_w_beats != expected_w_beats)) begin
        failures++;
        $error("Total AXI W transfers (%0d) do not match the AHB request (%0d)",
               observed_w_beats, expected_w_beats);
      end
    end
  end

  final begin
    if (failures == 0)
      $display("LAB PASS: every AXI burst carried AWLEN+1 transfers and no request lost a transfer");
    else
      $display("LAB FAIL: %0d checker failure(s)", failures);
  end

endmodule

// Corrected split helper. Replace choose_buggy_burst_beats() in the bridge
// with this body (same argument), then leave the rest of the bridge FSM
// unchanged.
//
// An AXI4 INCR burst carries at most 256 transfers (IHI0022E A3.4.1). No 4KB
// term is needed: a legal AHB incrementing burst never crosses 1KB
// (IHI0033B.b 3.5), so it never crosses 4KB either.
function automatic int choose_fixed_burst_beats(input int remaining);
  return (remaining > 256) ? 256 : remaining;
endfunction
