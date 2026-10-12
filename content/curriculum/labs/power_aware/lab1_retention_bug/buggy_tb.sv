// compile: buggy_tb.sv (self-contained: model, checker and testbench in one file)
// Lab power-aware-retention (E-PWR-1), starter. The [WAKE] block in tb_top is wrong.
// Run it first, unchanged, and record which assertions fail and when (README Step 1).
// The goal is the last line PASS=5 FAIL=0.
`timescale 1ns/1ps

// ---------------------------------------------------------------------------------
// PD_CPU: a behavioural stand-in for "PD_CPU's RTL plus its UPF in a power-aware
// simulator" (the same model as E-PWR-1 Make It Work). With real UPF the simulator
// adds corruption, isolation, retention and the switch to unchanged RTL; here they
// are written out, so any 4-state simulator shows them.
// ---------------------------------------------------------------------------------
module cpu_pd_model #(
  parameter int unsigned ACK_DELAY = 3   // switch acknowledge latency, cycles (>= 1)
) (
  input  logic       clk,                // always-on clock
  input  logic       por_n,              // always-on power-on reset, active low
  input  logic       cpu_clk_en,         // 0: PD_CPU's clock is stopped
  input  logic       cpu_iso_en,         // 1: PD_CPU's outputs are clamped to 0
  input  logic       cpu_save,           // 1 at an edge: save ctx_reg (retention)
  input  logic       cpu_restore,        // 1 at an edge: copy it back into ctx_reg
  input  logic       cpu_pwr_en,         // power-switch control: 1 = VDD_CPU on
  output logic       cpu_pwr_ack,        // the switch's acknowledge: 1 = VDD_CPU is on
  input  logic       cpu_rst_n,          // PD_CPU reset, asynchronous, active low
  input  logic       req_valid,          // a request from PD_TOP this cycle
  input  logic       req_write,          // 1: write, 0: read
  input  logic       req_addr,           // 0: CTX (retained), 1: SCRATCH (not retained)
  input  logic [7:0] req_wdata,
  output logic       rsp_valid,          // the response PD_TOP sees (after isolation)
  output logic [7:0] rsp_rdata
);
  logic [7:0]  ctx_reg, scratch;         // PD_CPU's state
  logic [7:0]  ret_ctx;                  // ctx_reg's retention element (always-on)
  logic        cpu_rsp_valid;            // PD_CPU's outputs, before the isolation cells
  logic [7:0]  cpu_rsp_rdata;
  int unsigned ack_count;

  // Power switch: the acknowledge follows cpu_pwr_en ACK_DELAY cycles later, and
  // VDD_CPU counts as on exactly while the acknowledge is 1.
  always_ff @(posedge clk or negedge por_n) begin
    if (!por_n) begin
      cpu_pwr_ack <= 1'b1;               // PD_CPU is powered at power-on
      ack_count   <= 0;
    end else if (cpu_pwr_ack != cpu_pwr_en) begin
      if (ack_count == ACK_DELAY - 1) begin
        cpu_pwr_ack <= cpu_pwr_en;
        ack_count   <= 0;
      end else begin
        ack_count <= ack_count + 1;
      end
    end else begin
      ack_count <= 0;
    end
  end

  // The domain reset is asynchronous, so it works while PD_CPU's clock is stopped.
  always_ff @(posedge clk or negedge cpu_rst_n or negedge cpu_pwr_ack) begin
    if (!cpu_pwr_ack) begin              // VDD_CPU off: the state is corrupted
      ctx_reg       <= 'x;
      scratch       <= 'x;
      cpu_rsp_valid <= 1'bx;
      cpu_rsp_rdata <= 'x;
    end else if (!cpu_rst_n) begin       // powered and in reset
      ctx_reg       <= '0;
      scratch       <= '0;
      cpu_rsp_valid <= 1'b0;
      cpu_rsp_rdata <= '0;
    end else if (cpu_restore) begin      // only the retained register comes back
      ctx_reg <= ret_ctx;
    end else if (cpu_clk_en) begin       // normal operation, one request per cycle
      cpu_rsp_valid <= req_valid;
      if (req_valid && req_write) begin
        if (req_addr) scratch <= req_wdata;
        else          ctx_reg <= req_wdata;
        cpu_rsp_rdata <= req_wdata;      // a write's response echoes the value written
      end else if (req_valid) begin
        cpu_rsp_rdata <= req_addr ? scratch : ctx_reg;
      end
    end
  end

  // The retention element is on the always-on supply. A save from a powered-down
  // domain copies X: the real value is already gone.
  always_ff @(posedge clk) begin
    if (cpu_save) ret_ctx <= ctx_reg;
  end

  // Isolation cells, on the always-on supply: clamp to 0 while cpu_iso_en is 1.
  assign rsp_valid = cpu_iso_en ? 1'b0  : cpu_rsp_valid;
  assign rsp_rdata = cpu_iso_en ? 8'h00 : cpu_rsp_rdata;
endmodule

// ---------------------------------------------------------------------------------
// Power-sequencing assertions on the always-on clock (the lesson's six, reporting
// with $error instead of `uvm_error, and counting failures per assertion).
// ---------------------------------------------------------------------------------
module pwr_seq_checker (
  input logic       clk,
  input logic       por_n,
  input logic       cpu_clk_en,
  input logic       cpu_iso_en,
  input logic       cpu_save,
  input logic       cpu_restore,
  input logic       cpu_pwr_en,
  input logic       cpu_pwr_ack,
  input logic       cpu_rst_n,
  input logic       rsp_valid,
  input logic [7:0] rsp_rdata
);
  int unsigned fails[string];            // failures, by assertion name

  // Since power last returned: has PD_CPU been reset, and restored after that reset?
  logic reset_seen, restored;
  always_ff @(posedge clk or negedge por_n) begin
    if (!por_n) begin
      reset_seen <= 1'b1;                // the power-on reset counts
      restored   <= 1'b1;                // and there is nothing to restore yet
    end else if (!cpu_pwr_ack) begin
      reset_seen <= 1'b0;                // power lost: both are needed again
      restored   <= 1'b0;
    end else if (!cpu_rst_n) begin
      reset_seen <= 1'b1;
      restored   <= 1'b0;                // a reset wipes a restore that came before it
    end else if (cpu_restore) begin
      restored   <= 1'b1;
    end
  end

  function automatic void fail(string name, string msg);
    if (fails.exists(name)) fails[name]++;
    else                    fails[name] = 1;
    $error("[%0d ns] %s: %s", $time, name, msg);
  endfunction

  default clocking @(posedge clk); endclocking
  default disable iff (!por_n);

  a_iso_before_off: assert property ($fell(cpu_pwr_en) |-> $past(cpu_iso_en))
    else fail("a_iso_before_off", "power switched off without isolation");
  a_iso_unless_on: assert property (!(cpu_pwr_en && cpu_pwr_ack) |-> cpu_iso_en)
    else fail("a_iso_unless_on", "isolation off while not fully powered");
  a_save_while_on: assert property (cpu_save |-> cpu_pwr_en && cpu_pwr_ack)
    else fail("a_save_while_on", "save while PD_CPU is not powered");
  a_restore_while_on: assert property (
    cpu_restore |-> cpu_pwr_en && cpu_pwr_ack && cpu_rst_n)
    else fail("a_restore_while_on", "restore while unpowered or in reset");
  // TODO (Step 3): a_release_after_wake. When cpu_iso_en falls, PD_CPU must be
  // powered (cpu_pwr_ack), clocked and out of reset, and both reset_seen and
  // restored must be 1. Report with fail("a_release_after_wake", "...").
  a_no_x_into_top: assert property (
    !$isunknown(rsp_valid) && !(rsp_valid && $isunknown(rsp_rdata)))
    else fail("a_no_x_into_top", "X reached PD_TOP from PD_CPU");

  // Prints the failures per assertion and returns their total.
  function automatic int unsigned report();
    int unsigned total = 0;
    foreach (fails[name]) begin
      $display("  %s failed %0d time(s)", name, fails[name]);
      total += fails[name];
    end
    return total;
  endfunction
endmodule

// ---------------------------------------------------------------------------------
// The testbench: it plays PD_TOP (bus requests) and the PMU (power controls).
// ---------------------------------------------------------------------------------
module tb_top;
  typedef enum {CLK_OFF, ISO_ON, SAVE, PWR_OFF, PWR_ON, RST, RESTORE, CLK_ON,
                ISO_OFF} pwr_op_e;
  localparam bit CTX = 1'b0, SCRATCH = 1'b1;

  logic       clk;
  logic       por_n;
  logic       cpu_clk_en  = 1'b1;        // PMU controls, at their power-on values
  logic       cpu_iso_en  = 1'b0;
  logic       cpu_save    = 1'b0;
  logic       cpu_restore = 1'b0;
  logic       cpu_pwr_en  = 1'b1;
  logic       cpu_rst_n   = 1'b0;        // PD_CPU stays in reset until released below
  logic       cpu_pwr_ack;
  logic       req_valid   = 1'b0;
  logic       req_write   = 1'b0;
  logic       req_addr    = 1'b0;
  logic [7:0] req_wdata   = 8'h00;
  logic       rsp_valid;
  logic [7:0] rsp_rdata;
  int unsigned passes, fails;            // data checks

  cpu_pd_model #(.ACK_DELAY(3)) u_cpu_pd (.*);
  pwr_seq_checker u_chk (.*);

  // Every drive goes through the clocking block: outputs change just after an edge,
  // inputs are the values just before it, so the testbench never races the model.
  clocking cb @(posedge clk);
    output cpu_clk_en, cpu_iso_en, cpu_save, cpu_restore, cpu_pwr_en, cpu_rst_n;
    output req_valid, req_write, req_addr, req_wdata;
    input  por_n, cpu_pwr_ack, rsp_valid, rsp_rdata;
  endclocking

  initial begin
    clk = 1'b0;
    forever #5 clk = ~clk;               // rising edges at 5, 15, 25 ns ...
  end

  initial begin
    por_n <= 1'b0;                       // always-on power-on reset
    repeat (2) @(posedge clk);
    por_n <= 1'b1;                       // released just after 15 ns
  end

  // One PMU action. Each starts at a clock edge, so two actions never share a cycle.
  task automatic pmu(pwr_op_e op);
    @(cb);
    $display("[%0d ns] PMU %s", $time, op.name());
    case (op)
      CLK_OFF: cb.cpu_clk_en <= 1'b0;
      CLK_ON:  cb.cpu_clk_en <= 1'b1;
      ISO_ON:  cb.cpu_iso_en <= 1'b1;
      ISO_OFF: cb.cpu_iso_en <= 1'b0;
      SAVE: begin
        cb.cpu_save <= 1'b1;
        @(cb) cb.cpu_save <= 1'b0;       // a one-cycle pulse
      end
      RESTORE: begin
        cb.cpu_restore <= 1'b1;
        @(cb) cb.cpu_restore <= 1'b0;
      end
      RST: begin
        cb.cpu_rst_n <= 1'b0;
        repeat (2) @(cb);
        cb.cpu_rst_n <= 1'b1;
      end
      PWR_OFF: begin
        cb.cpu_pwr_en <= 1'b0;
        @(cb iff cb.cpu_pwr_ack === 1'b0);   // the switch confirms: off
      end
      PWR_ON: begin
        cb.cpu_pwr_en <= 1'b1;
        @(cb iff cb.cpu_pwr_ack === 1'b1);   // never reset or restore before this
      end
    endcase
  endtask

  // One request, then up to four cycles for its response.
  task automatic bus_xfer(input bit write, input bit addr, input logic [7:0] wdata,
                          output logic [7:0] rdata, output bit got);
    got   = 1'b0;
    rdata = 'x;
    @(cb);
    cb.req_valid <= 1'b1;
    cb.req_write <= write;
    cb.req_addr  <= addr;
    cb.req_wdata <= wdata;
    @(cb);
    cb.req_valid <= 1'b0;                // a request lasts one cycle
    for (int i = 0; i < 4 && !got; i++) begin
      @(cb);
      if (cb.rsp_valid === 1'b1) begin
        got   = 1'b1;
        rdata = cb.rsp_rdata;
      end
    end
  endtask

  task automatic bus_write(bit addr, logic [7:0] wdata);
    logic [7:0] rdata;
    bit         got;
    bus_xfer(1'b1, addr, wdata, rdata, got);
    if (!got) begin
      fails++;
      $error("[%0d ns] WRITE %s: no response", $time, addr ? "SCRATCH" : "CTX");
    end
  endtask

  task automatic check_read(bit addr, logic [7:0] expected);
    logic [7:0] rdata;
    bit         got;
    string      name = addr ? "SCRATCH" : "CTX";
    bus_xfer(1'b0, addr, 8'h00, rdata, got);
    if (!got) begin
      fails++;
      $error("[%0d ns] READ %s: no response", $time, name);
    end else if (rdata !== expected) begin  // !== so that X never matches
      fails++;
      $error("[%0d ns] READ %s: expected 0x%02h observed 0x%02h",
             $time, name, expected, rdata);
    end else begin
      passes++;
      $display("[%0d ns] READ %s = 0x%02h ok", $time, name, rdata);
    end
  endtask

  initial begin
    int unsigned assertion_fails;
    @(cb iff cb.por_n === 1'b1);
    cb.cpu_rst_n <= 1'b1;                // power-on: release PD_CPU's reset

    bus_write(CTX, 8'hA5);
    bus_write(SCRATCH, 8'h3C);
    check_read(CTX, 8'hA5);
    check_read(SCRATCH, 8'h3C);

    // [SLEEP] clock off, isolate, save while powered, power off; then stay off
    pmu(CLK_OFF);
    pmu(ISO_ON);
    pmu(SAVE);
    pmu(PWR_OFF);
    repeat (10) @(cb);

    // [WAKE] edit this block (Steps 2 and 4)
    pmu(ISO_OFF);                        // BUG: releases the clamp while VDD_CPU is off
    pmu(PWR_ON);
    pmu(RESTORE);
    pmu(CLK_ON);

    check_read(CTX, 8'hA5);              // retained: the value saved before power-off
    check_read(SCRATCH, 8'h00);          // not retained: the reset value
    bus_write(SCRATCH, 8'h5A);           // and PD_CPU works normally again
    check_read(SCRATCH, 8'h5A);

    repeat (5) @(cb);                    // keep the assertions running for a while
    $display("--- summary ---");
    assertion_fails = u_chk.report();
    $display("PASS=%0d FAIL=%0d", passes, fails + assertion_fails);
    $finish;
  end

  initial begin                          // a hung lab ends here instead of never
    #20us;
    $fatal(1, "watchdog: the test did not finish in 20 us");
  end
endmodule
