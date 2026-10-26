// bridge_split_checker.sv — Starter File
// Complete this checker to catch AHB-to-AXI bridge split bugs.
//
// The buggy bridge in testbench.sv sends a 300-transfer AHB INCR as one AXI
// burst. AWLEN wraps to 43, but 300 W transfers follow. Your job is to prove
// that every AXI burst carries exactly AWLEN+1 transfers, that long requests
// are split at the AXI4 256-transfer limit, that each AXI burst starts where
// the previous one ended, and that the AHB stimulus itself is legal.
//
// Compile this file together with testbench.sv (top module tb_top).
//
// Each check is tagged:
//   [AHB protocol] / [AXI protocol]  a rule from Arm IHI0033B.b / IHI0022E
//   [Bridge design]                  a choice this bridge made; another legal
//                                    bridge could choose differently

// Same time unit as testbench.sv: IEEE 1800-2023 3.14.2.3 makes it an error
// when some design elements have a time unit and others do not.
`timescale 1ns/1ps

module bridge_split_checker #(
  parameter int MAX_AW_LATENCY = 16
)(
  input logic        ACLK,
  input logic        ARESETn,

  // Abstract AHB request plan from the testbench (one incrementing burst).
  input logic        plan_valid,
  input logic [31:0] plan_addr,
  input logic [10:0] plan_beats,
  input logic [2:0]  plan_size,

  // AXI write address channel emitted by the bridge.
  input logic        AWVALID,
  input logic        AWREADY,
  input logic [31:0] AWADDR,
  input logic [7:0]  AWLEN,
  input logic [2:0]  AWSIZE,
  input logic [1:0]  AWBURST,

  // AXI write data channel emitted by the bridge.
  input logic        WVALID,
  input logic        WREADY,
  input logic        WLAST,

  input logic        bridge_done
);

  // AXI4 INCR bursts carry 1 to 256 transfers (IHI0022E A3.4.1).
  localparam int AXI4_MAX_INCR_BEATS = 256;

  int unsigned failures;          // incremented by every failing check
  int unsigned w_bursts_checked;  // incremented by TODO 2 once per compared burst
  logic [2:0]  active_plan_size;  // HSIZE of the request being translated

  function automatic int beat_bytes(input logic [2:0] size);
    return 1 << size;
  endfunction

  // [AHB protocol] IHI0033B.b 3.5: an incrementing burst must not cross a
  // 1KB boundary. AHB transfers are aligned, so start + bytes is exact.
  function automatic bit plan_crosses_1kb(
    input logic [31:0] addr,
    input logic [10:0] beats,
    input logic [2:0]  size
  );
    return (int'(addr[9:0]) + (int'(beats) * beat_bytes(size))) > 1024;
  endfunction

  // [AXI protocol] IHI0022E A3.4.1: a burst must not cross a 4KB boundary.
  // Only INCR can: a legal WRAP stays inside its wrap region. This bridge
  // only issues aligned INCR bursts, so start + bytes is exact.
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

  //==================================================================
  // Worked example: [AXI protocol] no AXI INCR burst crosses 4KB
  //==================================================================
  // A safety net. With legal AHB input it can never fire: the request stays
  // inside one 1KB region, so every AXI burst made from it stays inside one
  // 4KB page.
  property p_no_axi_4kb_cross;
    @(posedge ACLK) disable iff (!ARESETn)
      (AWVALID && AWREADY && AWBURST == 2'b01) |-> !axi_crosses_4kb(AWADDR, AWLEN, AWSIZE);
  endproperty

  a_no_axi_4kb_cross: assert property (p_no_axi_4kb_cross)
    else begin
      failures++;
      $error("AXI burst crosses 4KB: AWADDR=0x%08h AWLEN=%0d AWSIZE=%0d", AWADDR, AWLEN, AWSIZE);
    end

  //==================================================================
  // Worked example: [Bridge design] AWSIZE equals the AHB HSIZE
  //==================================================================
  // Both buses are 32 bits wide here. A downsizing bridge would issue a
  // smaller AWSIZE and more transfers (IHI0022E A4.3.1).
  property p_aw_size_matches_plan;
    @(posedge ACLK) disable iff (!ARESETn)
      (AWVALID && AWREADY) |-> (AWSIZE == active_plan_size);
  endproperty

  a_aw_size_matches_plan: assert property (p_aw_size_matches_plan)
    else begin
      failures++;
      $error("AWSIZE=%0d does not match the AHB HSIZE=%0d", AWSIZE, active_plan_size);
    end

  //==================================================================
  // TODO 1: [AHB protocol] the AHB stimulus is legal
  //==================================================================
  // An AHB request that crosses 1KB is illegal stimulus (IHI0033B.b 3.5).
  // Flag it on the AHB side; do not expect the bridge to "fix" it.
  // Run with +define+ILLEGAL_AHB_INPUT to see this check fire.
  //
  // Hint:
  //   plan_valid |-> !plan_crosses_1kb(plan_addr, plan_beats, plan_size)
  //==================================================================

  // property p_ahb_input_no_1kb_cross;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     --- YOUR CODE HERE ---;
  // endproperty
  //
  // a_ahb_input_no_1kb_cross: assert property (p_ahb_input_no_1kb_cross)
  //   else begin
  //     failures++;
  //     $error("ILLEGAL AHB STIMULUS: INCR at 0x%08h crosses a 1KB boundary", plan_addr);
  //   end

  //==================================================================
  // TODO 2: [AXI protocol] each burst carries AWLEN+1 transfers
  //==================================================================
  // A burst has AxLEN+1 transfers (IHI0022E A3.4.1), and the master asserts
  // WLAST while it drives the final write transfer (IHI0022E A3.2.2).
  //
  // Write data can reach the interface before, with or after its address
  // (IHI0022E A3.3), and this bridge does send W without waiting for AW. So
  // do not latch AWLEN at the AW handshake and compare on the fly: keep two
  // queues, in order.
  // - On each AW handshake, push AWLEN+1 onto aw_len_q.
  // - Count W handshakes in w_count. On a W handshake with WLAST, push
  //   w_count onto w_len_q and restart the count.
  // - On a W handshake without WLAST, if aw_len_q already holds the AW of
  //   the W burst in progress (aw_len_q.size() > w_len_q.size()) and w_count
  //   has reached aw_len_q[w_len_q.size()], WLAST is missing: flag it.
  //   (Finished W bursts still waiting in w_len_q pair with the entries
  //   before it, so aw_len_q[0] is not always the burst in progress.)
  // - Whenever both queues hold an entry, pop one from each and compare.
  //   Increment w_bursts_checked for every comparison, and failures (with an
  //   $error) for every mismatch.
  //
  // Use "always", not "always_ff": the assertion action blocks above also
  // write "failures".
  //==================================================================

  // int unsigned aw_len_q[$];  // AWLEN+1 of each announced burst, in order
  // int unsigned w_len_q[$];   // W transfers of each finished W burst, in order
  // int unsigned w_count;      // W transfers so far in the current W burst
  //
  // always @(posedge ACLK or negedge ARESETn) begin
  //   if (!ARESETn) begin
  //     --- YOUR RESET CODE HERE ---
  //   end else begin
  //     --- YOUR CHECKING CODE HERE ---
  //   end
  // end

  //==================================================================
  // TODO 3: [Bridge design] long requests start with a full AXI burst
  //==================================================================
  // This bridge splits greedily: a request longer than 256 transfers starts
  // with a 256-transfer AXI burst (AWLEN == 255) at the request address.
  // The 256 limit is protocol (IHI0022E A3.4.1); the greedy split is this
  // bridge's choice. Another bridge could send 300 as 150 + 150.
  //
  // Hint:
  //   (plan_valid && plan_beats > AXI4_MAX_INCR_BEATS) |->
  //     ##[1:MAX_AW_LATENCY]
  //       (AWVALID && AWREADY && AWADDR == plan_addr && AWLEN == 8'd255)
  //==================================================================

  // property p_first_split_len;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     --- YOUR CODE HERE ---;
  // endproperty
  //
  // a_first_split_len: assert property (p_first_split_len)
  //   else begin
  //     failures++;
  //     $error("First AXI burst for a %0d-transfer request is not a full 256-transfer burst", plan_beats);
  //   end

  //==================================================================
  // TODO 4: [Bridge design] no request loses or gains a transfer
  //==================================================================
  // - Latch plan_beats when plan_valid is asserted.
  // - Count each WVALID && WREADY transfer.
  // - When bridge_done pulses, check that the count equals plan_beats.
  //
  // Question: does this check catch the bug in the buggy bridge? Why not?
  //==================================================================

  // int expected_w_beats;
  // int observed_w_beats;
  //
  // always @(posedge ACLK or negedge ARESETn) begin
  //   if (!ARESETn) begin
  //     --- YOUR RESET CODE HERE ---
  //   end else begin
  //     --- YOUR COUNTING CODE HERE ---
  //   end
  // end

  //==================================================================
  // TODO 5: [Bridge design] each AXI burst starts where the last one ended
  //==================================================================
  // - When plan_valid is asserted, set next_aw_addr to plan_addr.
  // - On each AW handshake, check AWADDR == next_aw_addr, then advance
  //   next_aw_addr by (AWLEN+1) << AWSIZE bytes.
  //
  // The long_incr_halfwords request (300 halfwords at 0x0400) must give a
  // second burst at 0x0600. A bridge that advances its address by the number
  // of transfers instead of the number of bytes sends it to 0x0500; only this
  // check sees that.
  //==================================================================

  // logic [31:0] next_aw_addr;
  //
  // always @(posedge ACLK or negedge ARESETn) begin
  //   if (!ARESETn) begin
  //     --- YOUR RESET CODE HERE ---
  //   end else begin
  //     --- YOUR CHECKING CODE HERE ---
  //   end
  // end

  final begin
    if (failures != 0)
      $display("LAB FAIL: %0d checker failure(s)", failures);
    else if (w_bursts_checked == 0)
      $display("LAB INCOMPLETE: TODO 2 compared no AXI burst, so nothing was checked");
    else
      $display("LAB PASS: %0d AXI bursts carried AWLEN+1 transfers and no request lost a transfer",
               w_bursts_checked);
  end

endmodule
