// testbench.sv — AHB-to-AXI Bridge Debug Lab
// Self-contained directed test for 4KB boundary split logic.
//
// The DUT intentionally contains a subtle split bug:
//   beats_to_4kb_boundary_buggy() returns one beat too many.
// This lets the first AXI burst cross a 4KB boundary for a request that
// starts at 0x0FF0 with eight 4-byte beats.

`timescale 1ns/1ps

`include "bridge_split_checker.sv"

module top;

  bit ACLK;
  logic ARESETn;

  always #5 ACLK = ~ACLK;

  // Abstract AHB request interface used by this lab.
  logic        req_valid;
  logic        req_ready;
  logic [31:0] req_addr;
  logic [7:0]  req_beats;
  logic [2:0]  req_size;
  logic        req_write;

  // Plan sideband for the checker.
  logic        plan_valid;
  logic [31:0] plan_addr;
  logic [7:0]  plan_beats;
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
    input logic [7:0]  beats,
    input logic [2:0]  size
  );
    int bytes_per_beat;
    bytes_per_beat = 1 << size;

    $display("\n# AHB request %-18s addr=0x%08h beats=%0d size=%0d bytes",
             name, addr, beats, bytes_per_beat);

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

    issue_ahb_write("safe_incr4",        32'h0000_2000, 8'd4, 3'd2);
    issue_ahb_write("exact_boundary",   32'h0000_1FE0, 8'd8, 3'd2);
    issue_ahb_write("crossing_4kb_bug", 32'h0000_0FF0, 8'd8, 3'd2);

    repeat (10) @(posedge ACLK);
    $display("\nLAB NOTE: If your checker is complete, crossing_4kb_bug should fail before this line.");
    $finish;
  end

  always_ff @(posedge ACLK) begin
    if (ARESETn && AWVALID && AWREADY) begin
      $display("# Time %4t: AXI AW addr=0x%08h beats=%0d AWSIZE=%0d last_byte=0x%08h",
               $time,
               AWADDR,
               AWLEN + 1,
               AWSIZE,
               AWADDR + (((AWLEN + 1) << AWSIZE) - 1));
    end

    if (ARESETn && WVALID && WREADY) begin
      $display("# Time %4t: AXI W beat data=0x%08h WLAST=%0b", $time, WDATA, WLAST);
    end
  end

endmodule

module buggy_ahb_axi_bridge (
  input  logic        ACLK,
  input  logic        ARESETn,

  input  logic        req_valid,
  output logic        req_ready,
  input  logic [31:0] req_addr,
  input  logic [7:0]  req_beats,
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

  typedef enum logic [1:0] {
    IDLE     = 2'd0,
    ISSUE_AW = 2'd1,
    SEND_W   = 2'd2
  } state_t;

  state_t state;

  logic [31:0] current_addr;
  logic [7:0]  remaining_beats;
  logic [7:0]  current_burst_beats;
  logic [7:0]  beat_index;
  logic [2:0]  size_q;

  assign req_ready = (state == IDLE);

  function automatic int beat_bytes(input logic [2:0] size);
    return 1 << size;
  endfunction

  function automatic int beats_to_4kb_boundary_buggy(
    input logic [31:0] addr,
    input logic [2:0]  size
  );
    int bytes_to_boundary;
    int beats;
    bytes_to_boundary = 4096 - int'(addr[11:0]);
    beats = bytes_to_boundary / beat_bytes(size);

    // BUG: This grants one extra beat past the 4KB boundary.
    return beats + 1;
  endfunction

  function automatic int choose_buggy_burst_beats(
    input logic [31:0] addr,
    input int          remaining,
    input logic [2:0]  size
  );
    int chosen;
    int to_boundary;
    chosen = remaining;
    to_boundary = beats_to_4kb_boundary_buggy(addr, size);

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

  always_ff @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn) begin
      state <= IDLE;
      current_addr <= '0;
      remaining_beats <= '0;
      current_burst_beats <= '0;
      beat_index <= '0;
      size_q <= '0;
      AWVALID <= 0;
      AWADDR <= '0;
      AWLEN <= '0;
      AWSIZE <= '0;
      AWBURST <= 2'b01; // INCR
      WVALID <= 0;
      WDATA <= '0;
      WSTRB <= '0;
      WLAST <= 0;
      bridge_done <= 0;
    end else begin
      bridge_done <= 0;

      case (state)
        IDLE: begin
          AWVALID <= 0;
          WVALID <= 0;
          WLAST <= 0;

          if (req_valid && req_ready && req_write) begin
            current_addr <= req_addr;
            remaining_beats <= req_beats;
            size_q <= req_size;
            state <= ISSUE_AW;
          end
        end

        ISSUE_AW: begin
          int next_beats;
          next_beats = choose_buggy_burst_beats(current_addr, remaining_beats, size_q);

          AWVALID <= 1;
          AWADDR <= current_addr;
          AWLEN <= next_beats[7:0] - 1;
          AWSIZE <= size_q;
          AWBURST <= 2'b01;

          if (AWVALID && AWREADY) begin
            AWVALID <= 0;
            current_burst_beats <= next_beats[7:0];
            beat_index <= 0;
            state <= SEND_W;
          end
        end

        SEND_W: begin
          WVALID <= 1;
          WDATA <= {24'h0, beat_index};
          WSTRB <= 4'hF;
          WLAST <= (beat_index == current_burst_beats - 1);

          if (WVALID && WREADY) begin
            if (beat_index == current_burst_beats - 1) begin
              WVALID <= 0;
              WLAST <= 0;
              current_addr <= current_addr + (current_burst_beats * beat_bytes(size_q));
              remaining_beats <= remaining_beats - current_burst_beats;

              if (remaining_beats == current_burst_beats) begin
                bridge_done <= 1;
                state <= IDLE;
              end else begin
                state <= ISSUE_AW;
              end
            end else begin
              beat_index <= beat_index + 1;
            end
          end
        end

        default: state <= IDLE;
      endcase
    end
  end

endmodule
