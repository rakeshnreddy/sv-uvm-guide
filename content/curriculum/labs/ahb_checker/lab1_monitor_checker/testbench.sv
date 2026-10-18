// ============================================================================
// AHB-Lite Protocol Monitor & Checker Lab - Testbench
// ============================================================================
// This file provides the complete AHB-Lite testbench infrastructure:
//   - the AHB interface, with a clocking block for the master BFM
//   - a simple SRAM slave (with optional injected bugs)
//   - a master BFM that runs a traffic plan and checks read-back data
//   - a write-count check (white-box scoreboard) that reports at the end
//   - the place in tb_top where you hook up your monitor and checker
//
// Your tasks are in ahb_monitor.sv and ahb_checker.sv. You may edit this file
// to change the lab switches below and to add the hookups in tb_top.
//
// Section numbers refer to Arm IHI0033B.b (AMBA 5 AHB, AHB5 and AHB-Lite).
// Single-slave simplification: there is no decoder and no HSEL, and the slave's
// HREADYOUT drives HREADY directly. A real AHB-Lite slave also samples HSELx,
// only when HREADY is high (4.2).
// ============================================================================

// ----------------------------------------------------------------------------
// Lab switches. Change a 0 to 1 here in the editor, or pass +define+NAME=1.
//   BROKEN_MODE  the slave has two injected bugs (Part 3)
//   PIPELINED    back-to-back traffic with a BUSY, waits and a cancel (Part 4)
//   MASTER_BUG   with PIPELINED=1: the master moves HADDR during a wait (Part 4)
// ----------------------------------------------------------------------------
`ifndef BROKEN_MODE
  `define BROKEN_MODE 0
`endif
`ifndef PIPELINED
  `define PIPELINED 0
`endif
`ifndef MASTER_BUG
  `define MASTER_BUG 0
`endif

`timescale 1ns/1ps

// ----------------------------------------------------------------------------
// AHB-Lite interface
// ----------------------------------------------------------------------------
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

  // Transfer type encodings (Table 3-1)
  localparam IDLE   = 2'b00;
  localparam BUSY   = 2'b01;
  localparam NONSEQ = 2'b10;
  localparam SEQ    = 2'b11;

  // The master BFM samples just before each rising edge and drives just after
  // it, so it never races the slave's flip-flops.
  clocking mst_cb @(posedge HCLK);
    default input #1step output #0;
    output HADDR, HWRITE, HTRANS, HSIZE, HBURST, HWDATA;
    input  HRDATA, HREADY, HRESP, HRESETn;
  endclocking

  modport master (clocking mst_cb);

  modport slave (
    input  HADDR, HWRITE, HTRANS, HSIZE, HBURST, HWDATA,
    output HRDATA, HREADY, HRESP
  );

  modport monitor (
    input HADDR, HWRITE, HTRANS, HSIZE, HBURST, HWDATA,
          HRDATA, HREADY, HRESP
  );
endinterface


// ----------------------------------------------------------------------------
// Simple SRAM slave (with optional bugs for Part 3)
// ----------------------------------------------------------------------------
// Word accesses only: the slave writes and reads whole 32-bit words.
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

  // One OKAY wait state on every 4th accepted transfer
  always_ff @(posedge HCLK or negedge HRESETn) begin
    if (!HRESETn) begin
      wait_counter   <= '0;
      inserting_wait <= 1'b0;
    end else if (bus.HTRANS inside {2'b10, 2'b11} && bus.HREADY) begin
      if (wait_counter == 3) begin
        inserting_wait <= 1'b1;
        wait_counter   <= '0;
      end else begin
        inserting_wait <= 1'b0;
        wait_counter   <= wait_counter + 1;
      end
    end else if (inserting_wait) begin
      inserting_wait <= 1'b0;  // release after one cycle
    end
  end

  // Address phase capture: only at an edge with HREADY high (4.2)
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

  // Data phase: write to memory. An out-of-range write gets ERROR and must
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

  // Data phase: read from memory
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
      // transfer's data phase and not to the transfer that follows it.
      always_ff @(posedge HCLK or negedge HRESETn) begin
        if (!HRESETn) begin
          resp_state <= S_OKAY;
          bus.HRESP  <= 1'b0;
        end else begin
          case (resp_state)
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
              if (addr_phase_err) begin
                resp_state <= S_ERR1;
                bus.HRESP  <= 1'b1;
              end else begin
                resp_state <= S_OKAY;
                bus.HRESP  <= 1'b0;
              end
            end
            default: begin
              resp_state <= S_OKAY;
              bus.HRESP  <= 1'b0;
            end
          endcase
        end
      end

      // HREADY: low during an inserted wait state (with OKAY) and in the
      // first ERROR cycle; high during reset (7.1.2)
      assign bus.HREADY = !inserting_wait && (resp_state != S_ERR1);
    end
  endgenerate

endmodule


// ----------------------------------------------------------------------------
// Master BFM: runs a traffic plan through the clocking block mst_cb
// ----------------------------------------------------------------------------
module ahb_master_bfm #(
  parameter bit PIPELINED  = `PIPELINED,
  parameter bit MASTER_BUG = `MASTER_BUG
)(
  ahb_if.master bus,
  input logic   HCLK,
  input logic   HRESETn
);
  localparam logic [1:0] IDLE = 2'b00, BUSY = 2'b01, NONSEQ = 2'b10, SEQ = 2'b11;
  localparam logic [2:0] SINGLE = 3'b000, INCR4 = 3'b011;
  localparam logic [2:0] WORD = 3'b010;

  // One step of the plan: an address phase (or IDLE/BUSY) and its data.
  // data is the write data for a write, and the expected read data for a read.
  typedef struct {
    logic [1:0]  trans;
    logic [31:0] addr;
    logic        write;
    logic [2:0]  burst;
    logic [31:0] data;
  } step_t;
  step_t plan[$];

  int unsigned read_fails;

  function automatic void add(logic [1:0] trans, logic [31:0] addr, logic write,
                              logic [2:0] burst, logic [31:0] data = '0);
    plan.push_back('{trans, addr, write, burst, data});
  endfunction

  task automatic drive_addr(step_t s);
    bus.mst_cb.HTRANS <= s.trans;
    bus.mst_cb.HADDR  <= s.addr;
    bus.mst_cb.HWRITE <= s.write;
    bus.mst_cb.HSIZE  <= WORD;
    bus.mst_cb.HBURST <= s.burst;
  endtask

  // Called at every edge with HREADY high: the data phase of plan[dp] ends here
  task automatic complete(int dp);
    if (dp < 0 || plan[dp].write) return;
    if (bus.mst_cb.HRESP === 1'b1) begin
      $display("  RD addr=0x%08h ERROR (no read data)", plan[dp].addr);
    end else if (bus.mst_cb.HRDATA === plan[dp].data) begin
      $display("  RD addr=0x%08h data=0x%08h PASS", plan[dp].addr, bus.mst_cb.HRDATA);
    end else begin
      read_fails++;
      $error("  RD addr=0x%08h data=0x%08h FAIL (expected 0x%08h)",
             plan[dp].addr, bus.mst_cb.HRDATA, plan[dp].data);
    end
  endtask

  // Runs the plan. The next address phase is driven while the current data
  // phase is still in progress (3.1); with IDLE steps in the plan this gives
  // the simple non-overlapping traffic of Parts 1 to 3.
  task automatic run_plan();
    int unsigned i  = 0;    // plan[i] is on the address bus
    int          dp = -1;   // plan[dp] is in its data phase (-1: none)
    drive_addr(plan[0]);
    while (i < plan.size()) begin
      @(bus.mst_cb);
      if (bus.mst_cb.HREADY === 1'b1) begin
        complete(dp);
        // plan[i] is accepted at this edge
        dp = (plan[i].trans inside {NONSEQ, SEQ}) ? int'(i) : -1;
        if (dp >= 0 && plan[i].write) bus.mst_cb.HWDATA <= plan[i].data;
        i++;
        if (i < plan.size()) drive_addr(plan[i]);
        else                 bus.mst_cb.HTRANS <= IDLE;
      end else if (bus.mst_cb.HRESP === 1'b1) begin
        // First ERROR cycle: cancel what waits on the address bus by driving
        // IDLE in the second ERROR cycle (3.5.2), and drop the rest of a burst.
        bus.mst_cb.HTRANS <= IDLE;
        while (i < plan.size() && plan[i].trans != NONSEQ) i++;
        do @(bus.mst_cb); while (bus.mst_cb.HREADY !== 1'b1);
        complete(dp);       // the ERROR transfer ends here
        dp = -1;            // the IDLE accepted here starts no data phase
        if (i < plan.size()) drive_addr(plan[i]);   // re-issue: this BFM's policy
      end else if (MASTER_BUG && plan[i].trans inside {NONSEQ, SEQ}) begin
        // MASTER BUG: changes the address of a waited NONSEQ/SEQ (breaks 3.6.2)
        bus.mst_cb.HADDR <= plan[i].addr + 32'h100;
      end
      // otherwise an OKAY wait state: hold address, control and HWDATA (3.6, 6.1.1)
    end
    do @(bus.mst_cb); while (bus.mst_cb.HREADY !== 1'b1);   // the last data phase
    complete(dp);
  endtask

  initial begin
    bus.mst_cb.HTRANS <= IDLE;          // IDLE during reset (7.1.2)
    bus.mst_cb.HADDR  <= '0;
    bus.mst_cb.HWRITE <= 1'b0;
    bus.mst_cb.HWDATA <= '0;
    bus.mst_cb.HSIZE  <= WORD;
    bus.mst_cb.HBURST <= SINGLE;

    if (!PIPELINED) begin
      // Parts 1 to 3: single transfers, each followed by an IDLE, so no
      // address phase overlaps a data phase.
      for (int k = 0; k < 8; k++) begin
        add(NONSEQ, k * 4, 1'b1, SINGLE, 32'hA000_0000 + k);
        add(IDLE,   k * 4, 1'b0, SINGLE);
      end
      for (int k = 0; k < 8; k++) begin
        add(NONSEQ, k * 4, 1'b0, SINGLE, 32'hA000_0000 + k);
        add(IDLE,   k * 4, 1'b0, SINGLE);
      end
      add(NONSEQ, 32'h0000_1000, 1'b1, SINGLE, 32'hDEAD_BEEF);   // out of range: ERROR
      add(IDLE,   32'h0000_1000, 1'b0, SINGLE);
      // 0x1000 would alias onto location 0 if the slave wrote it anyway
      add(NONSEQ, 32'h0000_0000, 1'b0, SINGLE, 32'hA000_0000);
      add(IDLE,   32'h0000_0000, 1'b0, SINGLE);
    end else begin
      // Part 4: back to back, an INCR4 write with a BUSY cycle, an INCR4 read,
      // an ERROR write, and a read that the master cancels and re-issues.
      add(NONSEQ, 32'h000, 1'b1, SINGLE, 32'hA000_0000);
      add(NONSEQ, 32'h010, 1'b1, INCR4,  32'hB000_0010);
      add(SEQ,    32'h014, 1'b1, INCR4,  32'hB000_0014);
      add(SEQ,    32'h018, 1'b1, INCR4,  32'hB000_0018);
      add(BUSY,   32'h01C, 1'b1, INCR4);              // BUSY carries the next address
      add(SEQ,    32'h01C, 1'b1, INCR4,  32'hB000_001C);
      add(NONSEQ, 32'h010, 1'b0, INCR4,  32'hB000_0010);
      add(SEQ,    32'h014, 1'b0, INCR4,  32'hB000_0014);
      add(SEQ,    32'h018, 1'b0, INCR4,  32'hB000_0018);
      add(SEQ,    32'h01C, 1'b0, INCR4,  32'hB000_001C);
      add(NONSEQ, 32'h0000_1000, 1'b1, SINGLE, 32'hDEAD_BEEF);   // out of range: ERROR
      add(NONSEQ, 32'h000, 1'b0, SINGLE, 32'hA000_0000);  // cancelled, then re-issued
    end

    do @(bus.mst_cb); while (bus.mst_cb.HRESETn !== 1'b1);
    $display("\n=== Running the %s traffic plan (%0d steps) ===",
             PIPELINED ? "pipelined" : "single-transfer", plan.size());
    run_plan();
    $display("\n=== Test complete: %0d read check(s) failed ===\n", read_fails);
    repeat (5) @(bus.mst_cb);
    $finish;
  end
endmodule


// ----------------------------------------------------------------------------
// Top-level testbench
// ----------------------------------------------------------------------------
module tb_top;
  logic HCLK    = 1'b0;
  logic HRESETn = 1'b0;

  // Clock generation: 10 ns period, rising edges at 5, 15, 25, ... ns
  always #5 HCLK = ~HCLK;

  // Reset: released with a nonblocking assignment just after a rising edge,
  // so no flip-flop sees it change at that edge (7.1.2)
  initial begin
    repeat (4) @(posedge HCLK);
    HRESETn <= 1'b1;
  end

  // AHB interface
  ahb_if bus (.HCLK(HCLK), .HRESETn(HRESETn));

  // DUT: SRAM slave
  ahb_sram_slave #(.DEPTH(256)) u_sram (
    .bus    (bus),
    .HCLK   (HCLK),
    .HRESETn(HRESETn)
  );

  // Master BFM
  ahb_master_bfm u_master (
    .bus    (bus),
    .HCLK   (HCLK),
    .HRESETn(HRESETn)
  );

  // ------------------------------------------
  // TODO: Instantiate your ahb_monitor here
  //   ahb_monitor u_monitor (
  //     .bus    (bus),
  //     .HCLK   (HCLK),
  //     .HRESETn(HRESETn)
  //   );
  // ------------------------------------------

  // ------------------------------------------
  // TODO: Bind your ahb_checker to the DUT. A bind directive may sit inside
  // a module; the port expressions are resolved inside ahb_sram_slave.
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
  // ------------------------------------------

  // ------------------------------------------
  // Write-count check (white-box scoreboard)
  // ------------------------------------------
  // Each write transfer that completes with OKAY must cause exactly one
  // memory write. A slave that also writes during wait states (Bug A) is
  // invisible to pin-level assertions, and the read-back passes too: the
  // master holds HWDATA valid through the wait states (IHI0033B.b 6.1.1),
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
