// testbench.sv — AXI Deadlock Hunt Lab
// This testbench simulates a realistic channel-dependency deadlock scenario.
// A buggy slave creates an illegal AWREADY → WVALID dependency that deadlocks
// write transactions, and cascading stalls that block read transactions too.

`timescale 1ns/1ps

module top;

  //------------------------------------------------------------------
  // Clock and Reset
  //------------------------------------------------------------------
  bit ACLK;
  bit ARESETn;

  always #5 ACLK = ~ACLK;

  initial begin
    ARESETn = 0;
    $display("# Time %4t: RESET asserted", $time);
    repeat (10) @(posedge ACLK);
    ARESETn = 1;
    $display("# Time %4t: RESET deasserted", $time);
  end

  //------------------------------------------------------------------
  // AXI Signals
  //------------------------------------------------------------------

  // AW Channel (Write Address)
  logic        AWVALID, AWREADY;
  logic [31:0] AWADDR;
  logic [3:0]  AWID;
  logic [7:0]  AWLEN;

  // W Channel (Write Data)
  logic        WVALID, WREADY;
  logic [31:0] WDATA;
  logic [3:0]  WSTRB;
  logic        WLAST;

  // B Channel (Write Response)
  logic        BVALID, BREADY;
  logic [3:0]  BID;
  logic [1:0]  BRESP;

  // AR Channel (Read Address)
  logic        ARVALID, ARREADY;
  logic [31:0] ARADDR;
  logic [3:0]  ARID;
  logic [7:0]  ARLEN;

  // R Channel (Read Data)
  logic        RVALID, RREADY;
  logic [31:0] RDATA;
  logic [3:0]  RID;
  logic [1:0]  RRESP;
  logic        RLAST;

  //------------------------------------------------------------------
  // Default Initialization
  //------------------------------------------------------------------
  initial begin
    AWVALID = 0; AWADDR = 0; AWID = 0; AWLEN = 0;
    WVALID  = 0; WDATA  = 0; WSTRB = 0; WLAST = 0;
    BREADY  = 1;
    ARVALID = 0; ARADDR = 0; ARID = 0; ARLEN = 0;
    RREADY  = 1;
  end

  //------------------------------------------------------------------
  // Buggy Slave (contains the deadlock bug)
  //------------------------------------------------------------------
  // BUG: This slave waits for WVALID before asserting AWREADY.
  // This violates the AXI spec rule that AWREADY must not depend on WVALID.
  //
  // Additionally, the slave's internal FSM blocks ARREADY while a write
  // is "in progress" (i.e., waiting for the AW handshake that never completes),
  // causing a cascade that blocks read transactions too.
  //------------------------------------------------------------------
  buggy_slave u_slave (
    .ACLK    (ACLK),
    .ARESETn (ARESETn),
    // AW
    .AWVALID (AWVALID), .AWREADY (AWREADY), .AWADDR (AWADDR),
    .AWID    (AWID),    .AWLEN   (AWLEN),
    // W
    .WVALID  (WVALID),  .WREADY  (WREADY),  .WDATA  (WDATA),
    .WSTRB   (WSTRB),   .WLAST   (WLAST),
    // B
    .BVALID  (BVALID),  .BREADY  (BREADY),  .BID    (BID),
    .BRESP   (BRESP),
    // AR
    .ARVALID (ARVALID), .ARREADY (ARREADY), .ARADDR (ARADDR),
    .ARID    (ARID),    .ARLEN   (ARLEN),
    // R
    .RVALID  (RVALID),  .RREADY  (RREADY),  .RDATA  (RDATA),
    .RID     (RID),     .RRESP   (RRESP),   .RLAST  (RLAST)
  );

  //------------------------------------------------------------------
  // Protocol Checker (your assertions go here)
  //------------------------------------------------------------------
  axi_deadlock_checker #(.MAX_WAIT(32)) u_checker (
    .ACLK    (ACLK),
    .ARESETn (ARESETn),
    .AWVALID (AWVALID), .AWREADY (AWREADY),
    .WVALID  (WVALID),  .WREADY  (WREADY),
    .BVALID  (BVALID),  .BREADY  (BREADY),
    .ARVALID (ARVALID), .ARREADY (ARREADY),
    .RVALID  (RVALID),  .RREADY  (RREADY)
  );

  //------------------------------------------------------------------
  // Master Stimulus — drives two writes and one read
  //------------------------------------------------------------------
  // The master waits for AWREADY before asserting WVALID.
  // This is LEGAL per the AXI spec (the master CAN do this).
  // But combined with the buggy slave, it creates the deadlock.
  //------------------------------------------------------------------
  initial begin
    wait (ARESETn === 1);
    repeat (2) @(posedge ACLK);

    // ---------- Write Transaction 1 (ID=1) ----------
    $display("# Time %4t: Master: Driving AWVALID for Write ID=1, ADDR=0x1000", $time);
    AWVALID <= 1;
    AWID    <= 4'd1;
    AWADDR  <= 32'h0000_1000;
    AWLEN   <= 8'd0;  // single beat

    // Also start a read to show the cascade effect
    @(posedge ACLK);
    $display("# Time %4t: Master: Driving ARVALID for Read ID=3, ADDR=0x3000", $time);
    ARVALID <= 1;
    ARID    <= 4'd3;
    ARADDR  <= 32'h0000_3000;
    ARLEN   <= 8'd0;

    // Master waits for AWREADY before sending write data
    // (This is LEGAL — A3.3.1: "WVALID can wait for AWREADY")
    fork
      begin : aw_wait
        wait (AWREADY === 1);
        @(posedge ACLK);
        AWVALID <= 0;
        // Now send write data
        $display("# Time %4t: Master: AW accepted, now sending WVALID", $time);
        WVALID <= 1;
        WDATA  <= 32'hDEAD_BEEF;
        WSTRB  <= 4'hF;
        WLAST  <= 1;
        @(posedge ACLK);
        wait (WREADY === 1);
        @(posedge ACLK);
        WVALID <= 0;
        WLAST  <= 0;
      end

      begin : ar_wait
        wait (ARREADY === 1);
        @(posedge ACLK);
        ARVALID <= 0;
      end
    join_any

    // Wait a bit for any response
    repeat (5) @(posedge ACLK);
  end

  //------------------------------------------------------------------
  // Timeout Watchdog
  //------------------------------------------------------------------
  initial begin
    #2000;
    $display("# Time %4t: TIMEOUT — simulation stopped (deadlock detected by assertions)", $time);
    $finish;
  end

  //------------------------------------------------------------------
  // Waveform Logger (prints key signal state every 10 cycles)
  //------------------------------------------------------------------
  initial begin
    wait (ARESETn === 1);
    forever begin
      repeat (10) @(posedge ACLK);
      $display("# Time %4t: AWVALID=%b AWREADY=%b | WVALID=%b WREADY=%b | ARVALID=%b ARREADY=%b",
        $time, AWVALID, AWREADY, WVALID, WREADY, ARVALID, ARREADY);
    end
  end

endmodule


//======================================================================
// Buggy Slave Module
// Contains an ILLEGAL channel dependency: AWREADY waits for WVALID
//======================================================================
module buggy_slave (
  input  logic        ACLK,
  input  logic        ARESETn,
  // AW Channel
  input  logic        AWVALID,
  output logic        AWREADY,
  input  logic [31:0] AWADDR,
  input  logic [3:0]  AWID,
  input  logic [7:0]  AWLEN,
  // W Channel
  input  logic        WVALID,
  output logic        WREADY,
  input  logic [31:0] WDATA,
  input  logic [3:0]  WSTRB,
  input  logic        WLAST,
  // B Channel
  output logic        BVALID,
  input  logic        BREADY,
  output logic [3:0]  BID,
  output logic [1:0]  BRESP,
  // AR Channel
  input  logic        ARVALID,
  output logic        ARREADY,
  input  logic [31:0] ARADDR,
  input  logic [3:0]  ARID,
  input  logic [7:0]  ARLEN,
  // R Channel
  output logic        RVALID,
  input  logic        RREADY,
  output logic [31:0] RDATA,
  output logic [3:0]  RID,
  output logic [1:0]  RRESP,
  output logic        RLAST
);

  typedef enum logic [2:0] {
    IDLE        = 3'd0,
    WRITE_WAIT  = 3'd1,  // Waiting for AW + W
    WRITE_RESP  = 3'd2,  // Sending B response
    READ_RESP   = 3'd3   // Sending R data
  } state_t;

  state_t state;
  logic [31:0] saved_addr;
  logic [3:0]  saved_id;

  always_ff @(posedge ACLK or negedge ARESETn) begin
    if (!ARESETn) begin
      state      <= IDLE;
      BVALID     <= 0;
      BID        <= 0;
      BRESP      <= 0;
      RVALID     <= 0;
      RDATA      <= 0;
      RID        <= 0;
      RRESP      <= 0;
      RLAST      <= 0;
      saved_addr <= 0;
      saved_id   <= 0;
    end else begin
      case (state)
        IDLE: begin
          BVALID <= 0;
          RVALID <= 0;
          RLAST  <= 0;

          if (AWVALID) begin
            // Enter write-wait state (but DON'T accept AW yet!)
            state <= WRITE_WAIT;
            saved_addr <= AWADDR;
            saved_id   <= AWID;
          end else if (ARVALID) begin
            state      <= READ_RESP;
            saved_addr <= ARADDR;
            saved_id   <= ARID;
          end
        end

        WRITE_WAIT: begin
          // BUG: Wait for WVALID (and WLAST) before completing write
          // The AW handshake won't happen until AWREADY is asserted,
          // but AWREADY depends on WVALID — creating the deadlock.
          if (WVALID && WLAST) begin
            state  <= WRITE_RESP;
          end
        end

        WRITE_RESP: begin
          BVALID <= 1;
          BID    <= saved_id;
          BRESP  <= 2'b00; // OKAY
          if (BVALID && BREADY) begin
            BVALID <= 0;
            state  <= IDLE;
          end
        end

        READ_RESP: begin
          RVALID <= 1;
          RDATA  <= 32'hCAFE_BABE; // Dummy read data
          RID    <= saved_id;
          RRESP  <= 2'b00;
          RLAST  <= 1;
          if (RVALID && RREADY) begin
            RVALID <= 0;
            RLAST  <= 0;
            state  <= IDLE;
          end
        end

        default: state <= IDLE;
      endcase
    end
  end

  //------------------------------------------------------------------
  // AWREADY and WREADY Logic — HERE IS THE BUG
  //------------------------------------------------------------------
  // BUG: AWREADY only goes high when WVALID is also high.
  // This is ILLEGAL per AXI spec A3.3.1.
  // A conformant slave must be able to accept the address independently.
  //------------------------------------------------------------------
  assign AWREADY = (state == WRITE_WAIT) && WVALID;  // <-- BUG!

  // WREADY is fine — slave accepts data when in WRITE_WAIT
  assign WREADY = (state == WRITE_WAIT);

  //------------------------------------------------------------------
  // ARREADY Logic — CASCADING BUG
  //------------------------------------------------------------------
  // The slave blocks read acceptance while a write is "in progress".
  // Since the write is stuck forever (deadlocked), reads also hang.
  //------------------------------------------------------------------
  assign ARREADY = (state == IDLE);

endmodule
