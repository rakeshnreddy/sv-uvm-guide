// testbench.sv: AXI Deadlock Hunt Lab (reference bench, read-only).
// An illegal master dependency (WVALID waits for AWREADY) meets a legal but
// strict slave policy (AWREADY waits for WVALID): the write deadlocks, and a
// read queued behind it in the slave hangs too.
// Run with no plusarg for the buggy master; run with +FIX_MASTER for the fixed
// master, which must complete the write and the read with zero checker failures.

`timescale 1ns/1ps

module top;

  //------------------------------------------------------------------
  // Clock and Reset
  //------------------------------------------------------------------
  bit ACLK;
  bit ARESETn;
  bit fix_master;

  always #5 ACLK = ~ACLK;

  initial begin
    fix_master = $test$plusargs("FIX_MASTER");
    ARESETn = 0;
    $display("# %0d ns: RESET asserted (%s master)", $time,
             fix_master ? "fixed" : "buggy");
    repeat (10) @(posedge ACLK);
    ARESETn <= 1;  // released on a clock edge (IHI0022E A3.1.2)
    $display("# %0d ns: RESET deasserted", $time);
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
    BREADY  = 1;  // this master can always take a response (A3.2.2)
    ARVALID = 0; ARADDR = 0; ARID = 0; ARLEN = 0;
    RREADY  = 1;
  end

  //------------------------------------------------------------------
  // Strict slave (legal AXI READY policy, risky in integration)
  //------------------------------------------------------------------
  // AWREADY waits until the slave has registered WVALID, and WREADY waits until
  // it has registered AWVALID (it enters WRITE_WAIT only on AWVALID). Both are
  // legal destination policies (A3.3.1), implemented through registers because
  // A3.1.1 forbids combinational input-to-output paths. The slave also serves
  // one transaction at a time, so a read waits behind a pending write.
  //------------------------------------------------------------------
  strict_slave u_slave (
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
  // Service bounds are enabled as this lab's explicit integration contract.
  // They diagnose the stalled handshakes; they are not base AXI protocol rules.
  axi_deadlock_checker #(.MAX_WAIT(32), .ENABLE_SERVICE_BOUNDS(1'b1)) u_checker (
    .ACLK    (ACLK),
    .ARESETn (ARESETn),
    .AWVALID (AWVALID), .AWREADY (AWREADY), .AWID (AWID), .AWADDR (AWADDR),
    .AWLEN   (AWLEN),
    .WVALID  (WVALID),  .WREADY  (WREADY), .WDATA (WDATA), .WSTRB (WSTRB),
    .WLAST   (WLAST),
    .BVALID  (BVALID),  .BREADY  (BREADY), .BID (BID), .BRESP (BRESP),
    .ARVALID (ARVALID), .ARREADY (ARREADY), .ARID (ARID), .ARADDR (ARADDR),
    .ARLEN   (ARLEN),
    .RVALID  (RVALID),  .RREADY  (RREADY), .RID (RID), .RDATA (RDATA),
    .RRESP   (RRESP),   .RLAST   (RLAST)
  );

  //------------------------------------------------------------------
  // Master Stimulus: one write (ID=1) and one read (ID=3)
  //------------------------------------------------------------------
  // Each wait below is clocked: "do @(posedge ACLK); while (!(VALID && READY));"
  // returns just after the edge at which the handshake happened.
  //------------------------------------------------------------------
  initial begin
    wait (ARESETn === 1);
    repeat (2) @(posedge ACLK);

    $display("# %0d ns: Master: AWVALID for write ID=1, ADDR=0x1000", $time);
    AWVALID <= 1;
    AWID    <= 4'd1;
    AWADDR  <= 32'h0000_1000;
    AWLEN   <= 8'd0;  // single transfer
    if (fix_master) begin
      // FIXED: WVALID is raised with AWVALID; it never waits for a READY.
      WVALID <= 1;
      WDATA  <= 32'hDEAD_BEEF;
      WSTRB  <= 4'hF;
      WLAST  <= 1;
    end

    fork
      begin : aw_and_w
        if (fix_master) begin
          fork
            begin : aw_ch
              do @(posedge ACLK); while (!(AWVALID && AWREADY));
              AWVALID <= 0;
            end
            begin : w_ch
              do @(posedge ACLK); while (!(WVALID && WREADY));
              WVALID <= 0;
              WLAST  <= 0;
            end
          join
        end else begin
          // BUG (A3.3.1): WVALID waits for AWREADY. Against this slave, which
          // waits for WVALID before AWREADY, neither ever rises.
          do @(posedge ACLK); while (!(AWVALID && AWREADY));
          AWVALID <= 0;
          $display("# %0d ns: Master: AW accepted, now sending WVALID", $time);
          WVALID <= 1;
          WDATA  <= 32'hDEAD_BEEF;
          WSTRB  <= 4'hF;
          WLAST  <= 1;
          do @(posedge ACLK); while (!(WVALID && WREADY));
          WVALID <= 0;
          WLAST  <= 0;
        end
      end

      begin : b_ch
        do @(posedge ACLK); while (!(BVALID && BREADY));
        $display("# %0d ns: Master: B received, BID=%0d BRESP=%0d", $time, BID, BRESP);
      end

      begin : ar_ch
        // The read starts one edge after the write.
        @(posedge ACLK);
        $display("# %0d ns: Master: ARVALID for read ID=3, ADDR=0x3000", $time);
        ARVALID <= 1;
        ARID    <= 4'd3;
        ARADDR  <= 32'h0000_3000;
        ARLEN   <= 8'd0;
        do @(posedge ACLK); while (!(ARVALID && ARREADY));
        ARVALID <= 0;
      end

      begin : r_ch
        do @(posedge ACLK); while (!(RVALID && RREADY && RLAST));
        $display("# %0d ns: Master: R received, RID=%0d RDATA=0x%08h", $time,
                 RID, RDATA);
      end
    join

    repeat (2) @(posedge ACLK);
    $display("# %0d ns: DONE: write and read completed", $time);
    $finish;
  end

  //------------------------------------------------------------------
  // Timeout Watchdog
  //------------------------------------------------------------------
  initial begin
    #2000;
    $display("# %0d ns: TIMEOUT: integration watchdog stopped unresolved channel waits",
             $time);
    $finish;
  end

  //------------------------------------------------------------------
  // Signal Logger (prints the handshake signals every 10 cycles)
  //------------------------------------------------------------------
  initial begin
    wait (ARESETn === 1);
    forever begin
      repeat (10) @(posedge ACLK);
      $write("# %0d ns: AWVALID=%b AWREADY=%b | WVALID=%b WREADY=%b",
             $time, AWVALID, AWREADY, WVALID, WREADY);
      $display(" | ARVALID=%b ARREADY=%b", ARVALID, ARREADY);
    end
  end

endmodule


//======================================================================
// Strict Slave Module
// A legal destination policy that closes the wait cycle with a buggy master.
//======================================================================
module strict_slave (
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
    WRITE_WAIT  = 3'd1,  // Waiting for the AW and W handshakes
    WRITE_RESP  = 3'd2,  // Sending B response
    READ_RESP   = 3'd3   // Sending R data
  } state_t;

  state_t      state;
  logic [31:0] saved_addr;
  logic [3:0]  saved_id;
  logic        aw_ready_q;  // registered AWREADY
  logic        aw_done;     // AW handshake taken for the current write
  logic        w_done;      // WLAST handshake taken for the current write

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
      aw_ready_q <= 0;
      aw_done    <= 0;
      w_done     <= 0;
    end else begin
      case (state)
        IDLE: begin
          BVALID     <= 0;
          RVALID     <= 0;
          RLAST      <= 0;
          aw_ready_q <= 0;
          aw_done    <= 0;
          w_done     <= 0;
          // ARREADY is HIGH in IDLE, so ARVALID here IS an AR handshake. Serve
          // it first; otherwise the accepted read would never get its R
          // transfer (A3.3.1, A3.4.4).
          if (ARVALID) begin
            state      <= READ_RESP;
            saved_addr <= ARADDR;
            saved_id   <= ARID;
          end else if (AWVALID) begin
            // Note the write, but do not accept AW yet.
            state      <= WRITE_WAIT;
            saved_addr <= AWADDR;
            saved_id   <= AWID;
          end
        end

        WRITE_WAIT: begin
          // POLICY (legal, A3.3.1): AWREADY waits until WVALID has been seen.
          // It is raised one edge later, from a register (A3.1.1).
          if (AWVALID && AWREADY) begin
            aw_ready_q <= 0;
            aw_done    <= 1;
          end else if ((WVALID || w_done) && !aw_done) begin
            aw_ready_q <= 1;
          end
          if (WVALID && WREADY && WLAST) w_done <= 1;
          // AXI4 (A3.3.1): respond only after both the AW and WLAST handshakes.
          if ((aw_done || (AWVALID && AWREADY)) &&
              (w_done  || (WVALID && WREADY && WLAST))) begin
            state <= WRITE_RESP;
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
  // READY outputs: functions of registers only (A3.1.1)
  //------------------------------------------------------------------
  assign AWREADY = aw_ready_q;
  // WREADY waits for AWVALID: the slave enters WRITE_WAIT only on AWVALID.
  assign WREADY  = (state == WRITE_WAIT) && !w_done;
  // POLICY (legal): reads are accepted only in IDLE, so a read waits behind a
  // pending write. With the buggy master, the write never completes and the
  // read hangs with it.
  assign ARREADY = (state == IDLE);

endmodule
