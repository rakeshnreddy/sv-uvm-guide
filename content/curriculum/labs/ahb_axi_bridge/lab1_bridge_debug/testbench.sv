// testbench.sv — AHB-to-AXI Bridge Debug Lab
// Self-contained directed test for the bridge's AXI burst-split logic.
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
// The DUT intentionally contains a split bug:
//   choose_buggy_burst_beats() has no 256-transfer cap. A 300-transfer INCR
//   goes out as one AXI burst, AWLEN wraps to 43 (44 transfers), and the
//   bridge still sends 300 W transfers with WLAST only on the last one.
//
// Negative test: compile with +define+ILLEGAL_AHB_INPUT to add an AHB INCR8
// that crosses 1KB. That is illegal AHB stimulus, so the AHB-side input
// check must fire. The bridge is not at fault.

`timescale 1ns/1ps

`include "bridge_split_checker.sv"

module top;

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

  // The AXI slave never stalls in this lab.
  assign AWREADY = 1'b1;
  assign WREADY  = 1'b1;

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
    ARESETn = 1;
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

    $display("\n# AHB request %-18s addr=0x%08h transfers=%0d size=%0d bytes last_byte=0x%08h",
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

    // All three are legal AHB incrementing bursts: none crosses 1KB.
    issue_ahb_write("safe_incr4",      32'h0000_2000, 11'd4,   3'd2);  // one AXI burst of 4
    issue_ahb_write("ends_at_1kb",     32'h0000_03C0, 11'd16,  3'd2);  // one AXI burst, last byte 0x03FF
    issue_ahb_write("long_incr_bytes", 32'h0000_0400, 11'd300, 3'd0);  // 256 at 0x0400, then 44 at 0x0500

`ifdef ILLEGAL_AHB_INPUT
    // Negative test: an AHB INCR8 of words at 0x03F0 ends at 0x040F, across
    // the 1KB boundary at 0x0400. No legal AHB master issues it.
    issue_ahb_write("illegal_ahb_1kb", 32'h0000_03F0, 11'd8,   3'd2);
`endif

    repeat (10) @(posedge ACLK);
    $display("\nLAB NOTE: If your checker is complete, long_incr_bytes fails before this line with the buggy bridge.");
    $finish;
  end

  // Log each AW handshake, and each burst's WLAST.
  int w_seen;  // W transfers seen in the current AXI burst

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

  typedef enum logic [1:0] {
    IDLE     = 2'd0,
    ISSUE_AW = 2'd1,
    SEND_W   = 2'd2
  } state_t;

  state_t state;

  logic [31:0] current_addr;     // start address of the next AXI burst
  logic [10:0] remaining_beats;  // AHB transfers not yet sent on AXI
  logic [10:0] burst_beats;      // transfers in the AXI burst being sent
  logic [10:0] beat_index;       // W transfer now on the bus
  logic [2:0]  size_q;
  int          next_beats;       // transfers in the next AXI burst

  assign req_ready = (state == IDLE);

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

  // How many transfers the next AXI burst carries.
  // No 4KB term is needed: a legal AHB incrementing burst stays inside one
  // 1KB region (IHI0033B.b 3.5), so it stays inside one 4KB page as well.
  function automatic int choose_buggy_burst_beats(input int remaining);
    // BUG: no AXI4 256-transfer cap. AWLEN is only 8 bits, so a longer
    // undefined-length INCR wraps AWLEN, and the W transfers no longer match
    // the burst the AW channel announced.
    return remaining;
  endfunction

  always_comb next_beats = choose_buggy_burst_beats(int'(remaining_beats));

  // AW channel. The outputs come from registered state only, so VALID never
  // depends on READY (IHI0022E A3.3.1).
  assign AWVALID = (state == ISSUE_AW);
  assign AWADDR  = current_addr;
  assign AWLEN   = 8'(next_beats - 1);   // AxLEN = transfers - 1
  assign AWSIZE  = size_q;
  assign AWBURST = 2'b01;                // INCR

  // W channel: transfer beat_index of the burst that started at current_addr.
  assign WVALID = (state == SEND_W);
  assign WDATA  = {21'h0, beat_index};
  assign WSTRB  = lane_strobe(current_addr + (32'(beat_index) << size_q), size_q);
  assign WLAST  = (state == SEND_W) && (beat_index == burst_beats - 11'd1);

  always_ff @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn) begin
      state           <= IDLE;
      current_addr    <= '0;
      remaining_beats <= '0;
      burst_beats     <= '0;
      beat_index      <= '0;
      size_q          <= '0;
      bridge_done     <= 1'b0;
    end else begin
      bridge_done <= 1'b0;

      case (state)
        IDLE: begin
          if (req_valid && req_write) begin
            current_addr    <= req_addr;
            remaining_beats <= req_beats;
            size_q          <= req_size;
            state           <= ISSUE_AW;
          end
        end

        ISSUE_AW: begin
          if (AWREADY) begin                 // AW handshake: AWVALID is high in this state
            burst_beats <= 11'(next_beats);
            beat_index  <= '0;
            state       <= SEND_W;
          end
        end

        SEND_W: begin
          if (WREADY) begin                  // W handshake: WVALID is high in this state
            if (WLAST) begin
              current_addr    <= current_addr + (32'(burst_beats) << size_q);
              remaining_beats <= remaining_beats - burst_beats;

              if (remaining_beats == burst_beats) begin
                bridge_done <= 1'b1;
                state       <= IDLE;
              end else begin
                state <= ISSUE_AW;
              end
            end else begin
              beat_index <= beat_index + 11'd1;
            end
          end
        end

        default: state <= IDLE;
      endcase
    end
  end

endmodule
