// solution.sv — AHB-to-AXI Bridge Debug Lab Reference Solution
//
// This file contains:
// 1. A completed bridge_split_checker implementation.
// 2. The corrected split helper functions for the bridge DUT.

module bridge_split_checker #(
  parameter int MAX_AW_LATENCY = 16
)(
  input logic        ACLK,
  input logic        ARESETn,

  input logic        plan_valid,
  input logic [31:0] plan_addr,
  input logic [7:0]  plan_beats,
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

  logic [31:0] active_plan_addr;
  logic [7:0]  active_plan_beats;
  logic [2:0]  active_plan_size;
  int expected_w_beats;
  int observed_w_beats;

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

  property p_no_axi_4kb_cross;
    @(posedge ACLK) disable iff (!ARESETn)
      (AWVALID && AWREADY) |-> !crosses_4kb(AWADDR, AWLEN, AWSIZE);
  endproperty

  assert property (p_no_axi_4kb_cross)
    else $error("SVA FAIL: AXI burst crosses 4KB boundary: AWADDR=0x%08h AWLEN=%0d AWSIZE=%0d",
                AWADDR, AWLEN, AWSIZE);

  property p_first_split_len;
    @(posedge ACLK) disable iff (!ARESETn)
      (plan_valid && plan_crosses_4kb(plan_addr, plan_beats, plan_size))
        |-> ##[1:MAX_AW_LATENCY]
          (AWVALID && AWREADY &&
           AWADDR == plan_addr &&
           AWSIZE == plan_size &&
           AWLEN + 1 == correct_beats_to_boundary(plan_addr, plan_size));
  endproperty

  assert property (p_first_split_len)
    else $error("SVA FAIL: first AXI split burst has wrong length for AHB plan addr=0x%08h beats=%0d size=%0d",
                plan_addr, plan_beats, plan_size);

  property p_aw_size_matches_plan;
    @(posedge ACLK) disable iff (!ARESETn)
      (AWVALID && AWREADY) |-> (AWSIZE == active_plan_size);
  endproperty

  assert property (p_aw_size_matches_plan)
    else $error("SVA FAIL: AWSIZE does not match the active AHB plan");

  property p_aw_incr_only;
    @(posedge ACLK) disable iff (!ARESETn)
      (AWVALID && AWREADY) |-> (AWBURST == 2'b01);
  endproperty

  assert property (p_aw_incr_only)
    else $error("SVA FAIL: bridge should emit AXI INCR bursts for this lab");

  always_ff @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn) begin
      active_plan_addr <= '0;
      active_plan_beats <= '0;
      active_plan_size <= '0;
      expected_w_beats <= 0;
      observed_w_beats <= 0;
    end else begin
      if (plan_valid) begin
        active_plan_addr <= plan_addr;
        active_plan_beats <= plan_beats;
        active_plan_size <= plan_size;
        expected_w_beats <= plan_beats;
        observed_w_beats <= 0;
      end

      if (WVALID && WREADY) begin
        observed_w_beats <= observed_w_beats + 1;
      end

      if (bridge_done) begin
        assert (observed_w_beats == expected_w_beats)
          else $error("SVA FAIL: total AXI W beats (%0d) did not match AHB plan beats (%0d)",
                      observed_w_beats, expected_w_beats);

        $display("LAB PASS: bridge split plan completed without 4KB violations");
      end
    end
  end

endmodule

// Corrected split helpers. Replace the buggy bridge helper functions with
// these versions, then leave the rest of the bridge FSM unchanged.

function automatic int fixed_beat_bytes(input logic [2:0] size);
  return 1 << size;
endfunction

function automatic int beats_to_4kb_boundary_fixed(
  input logic [31:0] addr,
  input logic [2:0]  size
);
  int bytes_to_boundary;
  bytes_to_boundary = 4096 - int'(addr[11:0]);
  return bytes_to_boundary / fixed_beat_bytes(size);
endfunction

function automatic int choose_fixed_burst_beats(
  input logic [31:0] addr,
  input int          remaining,
  input logic [2:0]  size
);
  int chosen;
  int to_boundary;

  chosen = remaining;
  to_boundary = beats_to_4kb_boundary_fixed(addr, size);

  if (chosen > 16) begin
    chosen = 16;
  end
  if (chosen > to_boundary) begin
    chosen = to_boundary;
  end
  if (chosen < 1) begin
    chosen = 1;
  end

  return chosen;
endfunction
