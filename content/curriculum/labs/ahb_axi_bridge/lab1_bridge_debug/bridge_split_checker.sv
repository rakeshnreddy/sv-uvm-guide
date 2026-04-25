// bridge_split_checker.sv — Starter File
// Complete this checker to catch AHB-to-AXI bridge split bugs.
//
// The buggy bridge in testbench.sv emits an AXI burst that crosses a 4KB
// boundary. Your job is to prove that every translated AW burst is legal
// and that the emitted W beat count matches the original AHB request.

module bridge_split_checker #(
  parameter int MAX_AW_LATENCY = 16
)(
  input logic        ACLK,
  input logic        ARESETn,

  // Abstract AHB request plan from the testbench.
  input logic        plan_valid,
  input logic [31:0] plan_addr,
  input logic [7:0]  plan_beats,
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

  function automatic int beat_bytes(input logic [2:0] size);
    return 1 << size;
  endfunction

  function automatic int axi_burst_bytes(
    input logic [7:0] len,
    input logic [2:0] size
  );
    return (int'(len) + 1) * beat_bytes(size);
  endfunction

  function automatic bit crosses_4kb(
    input logic [31:0] addr,
    input logic [7:0]  len,
    input logic [2:0]  size
  );
    return (int'(addr[11:0]) + axi_burst_bytes(len, size)) > 4096;
  endfunction

  function automatic bit plan_crosses_4kb(
    input logic [31:0] addr,
    input logic [7:0]  beats,
    input logic [2:0]  size
  );
    return (int'(addr[11:0]) + (int'(beats) * beat_bytes(size))) > 4096;
  endfunction

  function automatic int correct_beats_to_boundary(
    input logic [31:0] addr,
    input logic [2:0]  size
  );
    return (4096 - int'(addr[11:0])) / beat_bytes(size);
  endfunction

  //==================================================================
  // TODO 1: No AXI 4KB crossing
  //==================================================================
  // Every accepted AW burst must stay inside one 4KB page.
  //
  // Hint:
  //   (AWVALID && AWREADY) |-> !crosses_4kb(AWADDR, AWLEN, AWSIZE)
  //==================================================================

  // property p_no_axi_4kb_cross;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     --- YOUR CODE HERE ---;
  // endproperty
  //
  // assert property (p_no_axi_4kb_cross)
  //   else $error("SVA FAIL: AXI burst crosses 4KB boundary: AWADDR=0x%08h AWLEN=%0d AWSIZE=%0d",
  //               AWADDR, AWLEN, AWSIZE);

  //==================================================================
  // TODO 2: First split length is exact
  //==================================================================
  // If the original AHB plan crosses 4KB, the first AXI AW must start at
  // plan_addr and contain exactly the number of beats that fit before the
  // boundary.
  //
  // Hint:
  //   plan_valid && plan_crosses_4kb(...) |->
  //     ##[1:MAX_AW_LATENCY]
  //       (AWVALID && AWREADY && AWADDR == plan_addr &&
  //        (AWLEN + 1) == correct_beats_to_boundary(plan_addr, plan_size))
  //==================================================================

  // property p_first_split_len;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     --- YOUR CODE HERE ---;
  // endproperty
  //
  // assert property (p_first_split_len)
  //   else $error("SVA FAIL: first AXI split burst has wrong length for AHB plan addr=0x%08h beats=%0d size=%0d",
  //               plan_addr, plan_beats, plan_size);

  //==================================================================
  // TODO 3: Transfer size preservation
  //==================================================================
  // The bridge must preserve the AHB beat size when it emits AXI bursts.
  //==================================================================

  // property p_aw_size_matches_plan;
  //   @(posedge ACLK) disable iff (!ARESETn)
  //     --- YOUR CODE HERE ---;
  // endproperty
  //
  // assert property (p_aw_size_matches_plan)
  //   else $error("SVA FAIL: AWSIZE does not match the active AHB plan");

  //==================================================================
  // TODO 4: Total W beat accounting
  //==================================================================
  // Implement a small procedural counter:
  // - Latch plan_beats when plan_valid is asserted.
  // - Count each WVALID && WREADY beat.
  // - When bridge_done pulses, assert that observed_w_beats == plan_beats.
  //==================================================================

  // int expected_w_beats;
  // int observed_w_beats;
  //
  // always_ff @(posedge ACLK or negedge ARESETn) begin
  //   if (!ARESETn) begin
  //     --- YOUR RESET CODE HERE ---
  //   end else begin
  //     --- YOUR COUNTING CODE HERE ---
  //   end
  // end

endmodule
