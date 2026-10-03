// ============================================================================
// AHB-Lite Protocol Monitor & Checker Lab — Testbench
// ============================================================================
// This file provides the complete AHB-Lite testbench infrastructure:
//   - AHB interface definition
//   - A simple SRAM slave (with optional BROKEN_MODE)
//   - A master BFM that drives test sequences and checks read-back data
//   - A write-count check (white-box scoreboard) that reports at $finish
//   - A stub environment where you will wire in your monitor and checker
//
// Your tasks are in ahb_monitor.sv and ahb_checker.sv.
// ============================================================================

`ifndef BROKEN_MODE
  `define BROKEN_MODE 0
`endif

`timescale 1ns/1ps

// ─────────────────────────────────────────────────────────────
// AHB-Lite Interface
// ─────────────────────────────────────────────────────────────
interface ahb_if (input logic HCLK, input logic HRESETn);
  logic [31:0] HADDR;
  logic        HWRITE;
  logic [1:0]  HTRANS;
  logic [2:0]  HSIZE;
  logic [2:0]  HBURST;
  logic [31:0] HWDATA;
  logic [31:0] HRDATA;
  logic        HREADY;
  logic        HRESP;

  // Transfer type encodings
  localparam IDLE   = 2'b00;
  localparam BUSY   = 2'b01;
  localparam NONSEQ = 2'b10;
  localparam SEQ    = 2'b11;

  modport master (
    output HADDR, HWRITE, HTRANS, HSIZE, HBURST, HWDATA,
    input  HRDATA, HREADY, HRESP
  );

  modport slave (
    input  HADDR, HWRITE, HTRANS, HSIZE, HBURST, HWDATA,
    output HRDATA, HREADY, HRESP
  );

  modport monitor (
    input HADDR, HWRITE, HTRANS, HSIZE, HBURST, HWDATA,
          HRDATA, HREADY, HRESP
  );
endinterface


// ─────────────────────────────────────────────────────────────
// AHB Transaction Class
// ─────────────────────────────────────────────────────────────
class ahb_transaction;
  bit [31:0] addr;
  bit        write;
  bit [2:0]  size;
  bit [2:0]  burst;
  bit [1:0]  trans;
  bit [31:0] data;
  bit        resp;
  int unsigned wait_cycles;

  function string to_string();
    return $sformatf("%s addr=0x%08h data=0x%08h size=%0d waits=%0d resp=%s",
      write ? "WR" : "RD", addr, data, size, wait_cycles,
      resp ? "ERROR" : "OKAY");
  endfunction
endclass


// ─────────────────────────────────────────────────────────────
// Simple SRAM Slave (with optional bugs for Part 3)
// ─────────────────────────────────────────────────────────────
module ahb_sram_slave #(
  parameter DEPTH = 256,
  parameter BROKEN = `BROKEN_MODE
)(
  ahb_if.slave bus,
  input logic  HCLK,
  input logic  HRESETn
);
  logic [31:0] mem [0:DEPTH-1];

  // Pipeline registers
  logic [31:0] addr_reg;
  logic        write_reg;
  logic        active_reg;
  logic [2:0]  wait_counter;
  logic        inserting_wait;

  // Error response state machine
  typedef enum logic [1:0] { S_OKAY, S_ERR1, S_ERR2 } resp_state_t;
  resp_state_t resp_state;

  // Memory writes performed. The write-count check in tb_top compares this
  // with the number of write transfers that completed with OKAY on the bus.
  int unsigned mem_writes;

  // Out-of-range accesses get an ERROR response.
  //   addr_phase_err:    decided at the edge that accepts the address phase,
  //                      so the first data-phase cycle can already show ERROR
  //   addr_out_of_range: the transfer now in its data phase is out of range
  wire addr_phase_err    = bus.HREADY && (bus.HTRANS inside {2'b10, 2'b11}) &&
                           (bus.HADDR >= (DEPTH * 4));
  wire addr_out_of_range = (addr_reg >= (DEPTH * 4));

  // Simulate occasional wait states
  always_ff @(posedge HCLK or negedge HRESETn) begin
    if (!HRESETn) begin
      wait_counter   <= '0;
      inserting_wait <= 1'b0;
    end else if (bus.HTRANS inside {2'b10, 2'b11} && bus.HREADY) begin
      // Insert 1 wait state for every 4th transfer
      if (wait_counter == 3) begin
        inserting_wait <= 1'b1;
        wait_counter   <= '0;
      end else begin
        inserting_wait <= 1'b0;
        wait_counter   <= wait_counter + 1;
      end
    end else if (inserting_wait) begin
      inserting_wait <= 1'b0;  // Release after one cycle
    end
  end

  // Address phase capture
  always_ff @(posedge HCLK or negedge HRESETn) begin
    if (!HRESETn) begin
      addr_reg   <= '0;
      write_reg  <= 1'b0;
      active_reg <= 1'b0;
    end else if (bus.HREADY && bus.HTRANS inside {2'b10, 2'b11}) begin
      addr_reg   <= bus.HADDR;
      write_reg  <= bus.HWRITE;
      active_reg <= 1'b1;
    end else if (bus.HREADY) begin
      active_reg <= 1'b0;
    end
  end

  // Data phase — write to memory. An out-of-range write gets ERROR and must
  // not touch memory (addr_reg[9:2] would alias it onto a real location).
  generate
    if (BROKEN) begin : broken_write
      // BUG A: the write enable is not gated on HREADY, so the slave also
      // writes on every wait-state edge of a write data phase.
      always_ff @(posedge HCLK or negedge HRESETn) begin
        if (!HRESETn) begin
          mem_writes <= 0;
        end else if (active_reg && write_reg && !addr_out_of_range) begin
          mem[addr_reg[9:2]] <= bus.HWDATA;
          mem_writes         <= mem_writes + 1;
        end
      end
    end else begin : correct_write
      // Write once, at the edge where the data phase completes (HREADY high).
      always_ff @(posedge HCLK or negedge HRESETn) begin
        if (!HRESETn) begin
          mem_writes <= 0;
        end else if (active_reg && write_reg && bus.HREADY && !addr_out_of_range) begin
          mem[addr_reg[9:2]] <= bus.HWDATA;
          mem_writes         <= mem_writes + 1;
        end
      end
    end
  endgenerate

  // Data phase — read from memory
  assign bus.HRDATA = mem[addr_reg[9:2]];

  // Error response for out-of-range addresses
  generate
    if (BROKEN) begin : broken_error
      // BUG B: one-cycle ERROR. HRESP is high for one cycle while HREADY stays
      // high, so the transfer completes with ERROR without the first cycle
      // (HRESP high, HREADY low) that IHI0033B.b 5.1.3 requires.
      always_ff @(posedge HCLK or negedge HRESETn) begin
        if (!HRESETn) begin
          bus.HRESP <= 1'b0;
        end else begin
          bus.HRESP <= addr_phase_err;  // only one cycle of ERROR
        end
      end
      assign bus.HREADY = !inserting_wait;
    end else begin : correct_error
      // Two-cycle ERROR (IHI0033B.b 5.1.3, Table 5-2): HRESP high with HREADY
      // low, then HRESP high with HREADY high. The decision is made at the
      // edge that accepts the address phase, so the ERROR belongs to that
      // transfer's data phase and not to the IDLE that follows it.
      always_ff @(posedge HCLK or negedge HRESETn) begin
        if (!HRESETn) begin
          resp_state <= S_OKAY;
          bus.HRESP  <= 1'b0;
        end else case (resp_state)
          S_OKAY: begin
            if (addr_phase_err) begin
              resp_state <= S_ERR1;
              bus.HRESP  <= 1'b1;
            end else begin
              bus.HRESP <= 1'b0;
            end
          end
          S_ERR1: begin
            resp_state <= S_ERR2;
            bus.HRESP  <= 1'b1;
          end
          S_ERR2: begin
            // A transfer accepted at the edge that completes this ERROR may
            // itself be out of range.
            resp_state <= addr_phase_err ? S_ERR1 : S_OKAY;
            bus.HRESP  <= addr_phase_err;
          end
          default: begin
            resp_state <= S_OKAY;
            bus.HRESP  <= 1'b0;
          end
        endcase
      end

      // HREADY: low during an inserted wait state (with OKAY) and in the
      // first ERROR cycle
      assign bus.HREADY = !inserting_wait && (resp_state != S_ERR1);
    end
  endgenerate

endmodule


// ─────────────────────────────────────────────────────────────
// Master BFM — drives test sequences
// ─────────────────────────────────────────────────────────────
module ahb_master_bfm (
  ahb_if.master bus,
  input logic   HCLK,
  input logic   HRESETn
);

  task automatic single_write(input logic [31:0] addr, input logic [31:0] data);
    @(posedge HCLK);
    wait (bus.HREADY);
    bus.HADDR  <= addr;
    bus.HWRITE <= 1'b1;
    bus.HTRANS <= 2'b10;  // NONSEQ
    bus.HSIZE  <= 3'b010; // 32-bit
    bus.HBURST <= 3'b000; // SINGLE
    @(posedge HCLK);
    wait (bus.HREADY);
    bus.HWDATA <= data;
    bus.HTRANS <= 2'b00;  // IDLE
    @(posedge HCLK);
    wait (bus.HREADY);
  endtask

  task automatic single_read(input logic [31:0] addr, output logic [31:0] data);
    @(posedge HCLK);
    wait (bus.HREADY);
    bus.HADDR  <= addr;
    bus.HWRITE <= 1'b0;
    bus.HTRANS <= 2'b10;  // NONSEQ
    bus.HSIZE  <= 3'b010; // 32-bit
    bus.HBURST <= 3'b000; // SINGLE
    @(posedge HCLK);
    wait (bus.HREADY);
    bus.HTRANS <= 2'b00;  // IDLE
    @(posedge HCLK);
    wait (bus.HREADY);
    data = bus.HRDATA;
  endtask

  // Test sequence
  initial begin
    bus.HTRANS <= 2'b00;
    bus.HADDR  <= '0;
    bus.HWRITE <= 1'b0;
    bus.HWDATA <= '0;
    bus.HSIZE  <= 3'b010;
    bus.HBURST <= 3'b000;

    wait (HRESETn);
    repeat (3) @(posedge HCLK);

    // ── Write 8 locations ──
    $display("\n═══ Writing 8 locations ═══");
    for (int i = 0; i < 8; i++) begin
      single_write(i * 4, 32'hA000_0000 + i);
      $display("  WR addr=0x%08h data=0x%08h", i*4, 32'hA000_0000 + i);
    end

    // ── Read back and verify ──
    $display("\n═══ Reading back 8 locations ═══");
    for (int i = 0; i < 8; i++) begin
      logic [31:0] rdata;
      single_read(i * 4, rdata);
      if (rdata === (32'hA000_0000 + i))
        $display("  RD addr=0x%08h data=0x%08h ✓ PASS", i*4, rdata);
      else
        $error("  RD addr=0x%08h data=0x%08h ✗ FAIL (expected 0x%08h)", i*4, rdata, 32'hA000_0000 + i);
    end

    // ── Trigger out-of-range access (should get ERROR) ──
    $display("\n═══ Out-of-range access (expect ERROR) ═══");
    single_write(32'h0000_1000, 32'hDEAD_BEEF);

    // ── The failed write must not have changed memory ──
    // 0x1000 would alias onto location 0 if the slave wrote it anyway.
    begin : readback_after_error
      logic [31:0] rdata0;
      single_read(32'h0000_0000, rdata0);
      if (rdata0 === 32'hA000_0000)
        $display("  RD addr=0x00000000 data=0x%08h ✓ PASS (the ERROR write changed nothing)", rdata0);
      else
        $error("  RD addr=0x00000000 data=0x%08h ✗ FAIL (expected 0xa0000000)", rdata0);
    end

    repeat (5) @(posedge HCLK);
    $display("\n═══ Test complete ═══\n");
    $finish;
  end
endmodule


// ─────────────────────────────────────────────────────────────
// Top-level Testbench
// ─────────────────────────────────────────────────────────────
module tb_top;
  logic HCLK, HRESETn;

  // Clock generation: 10ns period
  initial HCLK = 0;
  always #5 HCLK = ~HCLK;

  // Reset
  initial begin
    HRESETn = 0;
    repeat (4) @(posedge HCLK);
    HRESETn = 1;
  end

  // AHB interface
  ahb_if bus (.HCLK(HCLK), .HRESETn(HRESETn));

  // DUT: SRAM slave
  ahb_sram_slave #(.DEPTH(256)) u_sram (
    .bus     (bus),
    .HCLK   (HCLK),
    .HRESETn(HRESETn)
  );

  // Master BFM
  ahb_master_bfm u_master (
    .bus     (bus),
    .HCLK   (HCLK),
    .HRESETn(HRESETn)
  );

  // ──────────────────────────────────────────
  // TODO: Instantiate your ahb_monitor here
  //   ahb_monitor u_monitor (
  //     .bus     (bus),
  //     .HCLK   (HCLK),
  //     .HRESETn(HRESETn)
  //   );
  // ──────────────────────────────────────────

  // ──────────────────────────────────────────
  // TODO: Bind your ahb_checker to the DUT
  //   bind ahb_sram_slave ahb_checker u_checker (
  //     .HCLK   (HCLK),
  //     .HRESETn(HRESETn),
  //     .HADDR  (bus.HADDR),
  //     .HTRANS (bus.HTRANS),
  //     .HWRITE (bus.HWRITE),
  //     .HSIZE  (bus.HSIZE),
  //     .HBURST (bus.HBURST),
  //     .HREADY (bus.HREADY),
  //     .HRESP  (bus.HRESP)
  //   );
  // ──────────────────────────────────────────

  // ──────────────────────────────────────────
  // Write-count check (white-box scoreboard)
  // ──────────────────────────────────────────
  // Each write transfer that completes with OKAY must cause exactly one
  // memory write. A slave that also writes during wait states (Bug A) is
  // invisible to pin-level assertions, and the read-back above passes too:
  // the master holds HWDATA valid through the wait states (IHI0033B.b 6.1.1),
  // so the extra write stores the same value. It only shows up as extra
  // memory writes, which would corrupt a FIFO or a write-1-to-clear register.
  int unsigned okay_writes;   // write data phases that completed with OKAY
  logic        dp_valid;      // a NONSEQ/SEQ transfer is in its data phase
  logic        dp_write;

  always_ff @(posedge HCLK or negedge HRESETn) begin
    if (!HRESETn) begin
      okay_writes <= 0;
      dp_valid    <= 1'b0;
      dp_write    <= 1'b0;
    end else if (bus.HREADY) begin
      // This edge completes the current data phase and accepts the next address phase.
      if (dp_valid && dp_write && !bus.HRESP)
        okay_writes <= okay_writes + 1;
      dp_valid <= (bus.HTRANS inside {2'b10, 2'b11});
      dp_write <= bus.HWRITE;
    end
  end

  final begin
    if (u_sram.mem_writes != okay_writes)
      $error("[SCB] %0d memory writes for %0d write transfers that completed OKAY: the slave wrote during a wait state",
             u_sram.mem_writes, okay_writes);
    else
      $display("[SCB] PASS: %0d memory writes for %0d write transfers that completed OKAY",
               u_sram.mem_writes, okay_writes);
  end

  // Waveform dump
  initial begin
    $dumpfile("ahb_lab.vcd");
    $dumpvars(0, tb_top);
  end
endmodule
