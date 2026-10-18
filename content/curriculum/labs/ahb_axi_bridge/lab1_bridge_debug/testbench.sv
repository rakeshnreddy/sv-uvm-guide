// testbench.sv — AHB-to-AXI Bridge Debug Lab
// Directed test for the burst-split logic of an AHB-to-AXI bridge.
//
// Compile it together with the checker, with tb_top as the top module:
//   <simulator> bridge_split_checker.sv testbench.sv
// (use solution.sv in place of bridge_split_checker.sv to run the reference
// checker).
//
// Premise (Arm IHI0033B.b 3.5 and Arm IHI0022E A3.4.1):
//   A legal AHB incrementing burst never crosses a 1KB boundary. Every 4KB
//   boundary is also a 1KB boundary, so a legal AHB burst never crosses 4KB
//   either: an AHB-to-AXI bridge never needs a 4KB split. It does need to
//   split an undefined-length AHB INCR that is longer than 256 transfers,
//   because an AXI4 INCR burst carries at most 256 transfers and AWLEN is
//   only 8 bits. A byte-wide INCR can be up to 1024 transfers long and still
//   stay inside one 1KB region. (Width conversion is the other reason to
//   reshape a burst; this lab uses a 32-bit bus on both sides.)
//
// Abstraction: a real AHB INCR carries no length (IHI0033B.b Table 3-3), so a
// real bridge learns it only when the burst ends. This lab hands the bridge
// the length up front (req_beats), as a bridge that buffers the whole write
// would know it.
//
// The DUT intentionally contains a split bug:
//   choose_buggy_burst_beats() has no 256-transfer cap. A 300-transfer INCR
//   goes out as one AXI burst, AWLEN wraps to 43 (44 transfers), and the
//   bridge still sends 300 W transfers with WLAST only on the last one.
//
// Defines:
//   +define+ILLEGAL_AHB_INPUT     add an AHB INCR8 that crosses 1KB. That is
//                                 illegal AHB stimulus, so the AHB-side input
//                                 check must fire. The bridge is not at fault.
//   +define+AXI_SLAVE_WAITS_FOR_W make the AXI slave raise AWREADY only after
//                                 it has seen WVALID, and stall WREADY at
//                                 random. Both are legal (IHI0022E A3.3.1). A
//                                 bridge whose WVALID waited for AWREADY would
//                                 deadlock here; this one does not.

`timescale 1ns/1ps

module tb_top;

  bit ACLK;
  logic ARESETn;

  always #5 ACLK = ~ACLK;

  // Abstract AHB request interface used by this lab: one incrementing write
  // burst per request. req_ready plays the role of the bridge's HREADYOUT.
  logic        req_valid;
  logic        req_ready;
  logic [31:0] req_addr;
  logic [10:0] req_beats;   // up to 1024 byte transfers fit in one 1KB region
  logic [2:0]  req_size;
  logic        req_write;

  // Plan sideband for the checker.
  logic        plan_valid;
  logic [31:0] plan_addr;
  logic [10:0] plan_beats;
  logic [2:0]  plan_size;

  // AXI write address/data interface emitted by the bridge.
  logic        AWVALID;
  logic        AWREADY;
  logic [31:0] AWADDR;
  logic [7:0]  AWLEN;
  logic [2:0]  AWSIZE;
  logic [1:0]  AWBURST;

  logic        WVALID;
  logic        WREADY;
  logic [31:0] WDATA;
  logic [3:0]  WSTRB;
  logic        WLAST;

  logic        bridge_done;

`ifdef AXI_SLAVE_WAITS_FOR_W
  // A legal AXI slave that waits for WVALID before it raises AWREADY, and
  // accepts W on about three cycles in four (IHI0022E A3.3.1). Both READYs are
  // registered: an AXI interface has no combinatorial path from its inputs to
  // its outputs (IHI0022E A3.1.1).
  logic aw_gate;
  logic wready_q;

  always_ff @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn)                aw_gate <= 1'b0;
    else if (AWVALID && AWREADY) aw_gate <= 1'b0;   // wait again for the next AW
    else if (WVALID)             aw_gate <= 1'b1;
  end

  always_ff @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn) wready_q <= 1'b0;
    else          wready_q <= ($urandom_range(3) != 0);
  end

  assign AWREADY = aw_gate;
  assign WREADY  = wready_q;
`else
  // The default AXI slave never stalls.
  assign AWREADY = 1'b1;
  assign WREADY  = 1'b1;
`endif

  buggy_ahb_axi_bridge u_bridge (
    .ACLK        (ACLK),
    .ARESETn     (ARESETn),
    .req_valid   (req_valid),
    .req_ready   (req_ready),
    .req_addr    (req_addr),
    .req_beats   (req_beats),
    .req_size    (req_size),
    .req_write   (req_write),
    .AWVALID     (AWVALID),
    .AWREADY     (AWREADY),
    .AWADDR      (AWADDR),
    .AWLEN       (AWLEN),
    .AWSIZE      (AWSIZE),
    .AWBURST     (AWBURST),
    .WVALID      (WVALID),
    .WREADY      (WREADY),
    .WDATA       (WDATA),
    .WSTRB       (WSTRB),
    .WLAST       (WLAST),
    .bridge_done (bridge_done)
  );

  bridge_split_checker u_checker (
    .ACLK        (ACLK),
    .ARESETn     (ARESETn),
    .plan_valid  (plan_valid),
    .plan_addr   (plan_addr),
    .plan_beats  (plan_beats),
    .plan_size   (plan_size),
    .AWVALID     (AWVALID),
    .AWREADY     (AWREADY),
    .AWADDR      (AWADDR),
    .AWLEN       (AWLEN),
    .AWSIZE      (AWSIZE),
    .AWBURST     (AWBURST),
    .WVALID      (WVALID),
    .WREADY      (WREADY),
    .WLAST       (WLAST),
    .bridge_done (bridge_done)
  );

  initial begin
    ARESETn = 0;
    req_valid = 0;
    req_addr = '0;
    req_beats = '0;
    req_size = '0;
    req_write = 1;
    plan_valid = 0;
    plan_addr = '0;
    plan_beats = '0;
    plan_size = '0;

    repeat (5) @(posedge ACLK);
    ARESETn <= 1;   // released on a clock edge, as AXI requires (IHI0022E A3.1.2)
    $display("# Time %4t: RESET deasserted", $time);
  end

  task automatic issue_ahb_write(
    input string       name,
    input logic [31:0] addr,
    input logic [10:0] beats,
    input logic [2:0]  size
  );
    int bytes_per_beat;
    bytes_per_beat = 1 << size;

    $display("\n# AHB request %s addr=0x%08h transfers=%0d size=%0d bytes last_byte=0x%08h",
             name, addr, beats, bytes_per_beat, addr + beats * bytes_per_beat - 1);

    @(posedge ACLK);
    plan_valid <= 1;
    plan_addr  <= addr;
    plan_beats <= beats;
    plan_size  <= size;

    req_valid <= 1;
    req_addr  <= addr;
    req_beats <= beats;
    req_size  <= size;
    req_write <= 1;

    wait (req_ready === 1'b1);
    @(posedge ACLK);
    req_valid  <= 0;
    plan_valid <= 0;

    wait (bridge_done === 1'b1);
    @(posedge ACLK);
  endtask

  initial begin
    wait (ARESETn === 1'b1);
    repeat (2) @(posedge ACLK);

    // All four are legal AHB incrementing bursts: none crosses 1KB.
    issue_ahb_write("safe_incr4",          32'h0000_2000, 11'd4,   3'd2);  // one AXI burst of 4
    issue_ahb_write("ends_at_1kb",         32'h0000_03C0, 11'd16,  3'd2);  // one burst, last byte 0x03FF
    issue_ahb_write("long_incr_bytes",     32'h0000_0400, 11'd300, 3'd0);  // 256 at 0x0400, 44 at 0x0500
    issue_ahb_write("long_incr_halfwords", 32'h0000_0400, 11'd300, 3'd1);  // 256 at 0x0400, 44 at 0x0600

`ifdef ILLEGAL_AHB_INPUT
    // Negative test: an AHB INCR8 of words at 0x03F0 ends at 0x040F, across
    // the 1KB boundary at 0x0400. No legal AHB master issues it.
    issue_ahb_write("illegal_ahb_1kb",     32'h0000_03F0, 11'd8,   3'd2);
`endif

    repeat (10) @(posedge ACLK);
    $display("\nLAB NOTE: with a complete checker and the buggy bridge, the long requests fail above.");
    $finish;
  end

  // Watchdog: a handshake deadlock must fail the run, not hang it.
  initial begin
    repeat (20000) @(posedge ACLK);
    $display("WATCHDOG: no progress after 20000 cycles; the AXI handshakes are stuck");
    u_checker.failures++;
    $finish;
  end

  // Log each AW handshake, and each burst's WLAST.
  int w_seen;  // W transfers seen so far in the current W burst

  always_ff @(posedge ACLK) begin
    if (ARESETn && AWVALID && AWREADY) begin
      $display("# Time %4t: AXI AW addr=0x%08h AWLEN=%0d (%0d transfers) AWSIZE=%0d last_byte=0x%08h",
               $time,
               AWADDR,
               AWLEN,
               AWLEN + 1,
               AWSIZE,
               AWADDR + (((AWLEN + 1) << AWSIZE) - 1));
    end

    if (ARESETn && WVALID && WREADY) begin
      if (WLAST) begin
        $display("# Time %4t: AXI W  WLAST on transfer %0d of this burst", $time, w_seen + 1);
        w_seen <= 0;
      end else begin
        w_seen <= w_seen + 1;
      end
    end
  end

endmodule

module buggy_ahb_axi_bridge (
  input  logic        ACLK,
  input  logic        ARESETn,

  input  logic        req_valid,
  output logic        req_ready,
  input  logic [31:0] req_addr,
  input  logic [10:0] req_beats,
  input  logic [2:0]  req_size,
  input  logic        req_write,

  output logic        AWVALID,
  input  logic        AWREADY,
  output logic [31:0] AWADDR,
  output logic [7:0]  AWLEN,
  output logic [2:0]  AWSIZE,
  output logic [1:0]  AWBURST,

  output logic        WVALID,
  input  logic        WREADY,
  output logic [31:0] WDATA,
  output logic [3:0]  WSTRB,
  output logic        WLAST,

  output logic        bridge_done
);

  // AXI4 INCR bursts carry 1 to 256 transfers (IHI0022E A3.4.1).
  localparam int AXI4_MAX_INCR_BEATS = 256;

  logic        busy;           // a request is being translated
  logic [2:0]  size_q;         // its transfer size (HSIZE)

  // AW side: announces each AXI burst.
  logic [31:0] aw_addr;        // start address of the next AXI burst
  logic [10:0] aw_remaining;   // transfers not yet announced on AW
  int          aw_beats;       // transfers in the next AXI burst

  // W side: works out the same split by itself, so that WVALID never waits
  // for AWREADY. "A master must not wait for AWREADY to be asserted before
  // driving WVALID" (IHI0022E A3.3.1): a slave may wait for WVALID first.
  logic [31:0] w_addr;         // address of the W transfer on the bus
  logic [10:0] w_remaining;    // transfers not yet sent on W
  logic [10:0] w_burst_beats;  // length of the W burst in progress (from its first transfer)
  logic [10:0] beat_index;     // transfer number within that burst
  int          w_beats_new;    // length of a W burst that starts now
  logic [10:0] w_len;          // length of the current W burst

  logic        aw_fire, w_fire;
  logic [10:0] aw_left_next, w_left_next;

  assign req_ready = !busy;

  // Byte lanes of an aligned transfer of 2**size bytes on a 32-bit bus
  // (IHI0022E A3.4.3). AHB transfers are always aligned (IHI0033B.b 3.5).
  function automatic logic [3:0] lane_strobe(
    input logic [31:0] addr,
    input logic [2:0]  size
  );
    logic [3:0] mask;
    case (size)
      3'd0:    mask = 4'b0001;
      3'd1:    mask = 4'b0011;
      default: mask = 4'b1111;
    endcase
    return mask << addr[1:0];
  endfunction

  // How many transfers the next AXI burst carries. Both channels use it.
  // No 4KB term is needed: a legal AHB incrementing burst stays inside one
  // 1KB region (IHI0033B.b 3.5), so it stays inside one 4KB page as well.
  function automatic int choose_buggy_burst_beats(input int remaining);
    // BUG: no AXI4 256-transfer cap. AWLEN is only 8 bits, so a longer
    // undefined-length INCR wraps AWLEN, and the W transfers no longer match
    // the burst the AW channel announced.
    return remaining;
  endfunction

  always_comb begin
    aw_beats     = choose_buggy_burst_beats(int'(aw_remaining));
    w_beats_new  = choose_buggy_burst_beats(int'(w_remaining));
    w_len        = (beat_index == 11'd0) ? 11'(w_beats_new) : w_burst_beats;
    aw_fire      = AWVALID && AWREADY;
    w_fire       = WVALID && WREADY;
    aw_left_next = aw_fire ? aw_remaining - 11'(aw_beats) : aw_remaining;
    w_left_next  = w_fire  ? w_remaining - 11'd1          : w_remaining;
  end

  // AW channel: outputs come from registers only. AWVALID does not wait for
  // WREADY, and nothing on an output depends combinatorially on an input
  // (IHI0022E A3.1.1).
  assign AWVALID = busy && (aw_remaining != 11'd0);
  assign AWADDR  = aw_addr;
  assign AWLEN   = 8'(aw_beats - 1);     // AxLEN = transfers - 1
  assign AWSIZE  = size_q;
  assign AWBURST = 2'b01;                // INCR

  // W channel: transfer beat_index of the current burst, at w_addr.
  assign WVALID = busy && (w_remaining != 11'd0);
  assign WDATA  = {21'h0, beat_index};
  assign WSTRB  = lane_strobe(w_addr, size_q);
  assign WLAST  = WVALID && (beat_index == w_len - 11'd1);

  always_ff @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn) begin
      busy          <= 1'b0;
      size_q        <= '0;
      aw_addr       <= '0;
      aw_remaining  <= '0;
      w_addr        <= '0;
      w_remaining   <= '0;
      w_burst_beats <= '0;
      beat_index    <= '0;
      bridge_done   <= 1'b0;
    end else begin
      bridge_done <= 1'b0;

      if (!busy) begin
        if (req_valid && req_write) begin
          busy         <= 1'b1;
          size_q       <= req_size;
          aw_addr      <= req_addr;
          aw_remaining <= req_beats;
          w_addr       <= req_addr;
          w_remaining  <= req_beats;
          beat_index   <= '0;
        end
      end else begin
        if (aw_fire) begin
          aw_addr      <= aw_addr + (32'(aw_beats) << size_q);
          aw_remaining <= aw_left_next;
        end

        if (w_fire) begin
          if (beat_index == 11'd0) w_burst_beats <= 11'(w_beats_new);
          w_addr      <= w_addr + (32'd1 << size_q);
          w_remaining <= w_left_next;
          beat_index  <= WLAST ? 11'd0 : beat_index + 11'd1;
        end

        // The request is done when both channels have sent everything.
        if (aw_left_next == 11'd0 && w_left_next == 11'd0) begin
          busy        <= 1'b0;
          bridge_done <= 1'b1;
        end
      end
    end
  end

endmodule
