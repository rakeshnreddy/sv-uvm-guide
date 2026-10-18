// Lab soc-vip-reuse (E-SOC-1): STARTER.
// The SoC team reused the SPI block team's environment (spi_blk_env, spi_apb_agent,
// apb_monitor, spi_reg_scb) unchanged and copied the block test. Do not edit the
// block team's classes except in the step 5 drill. Edit soc_test and, in step 4, tb_top.
`timescale 1ns/1ps
`include "uvm_macros.svh"

// =============================================== the firmware-testbench contract
// One package for addresses and codes, shared by the firmware build and the bench.
package soc_map_pkg;
  localparam logic [11:0] SPI_CTRL   = 12'h000;
  localparam logic [11:0] SPI_TXDATA = 12'h004;
  localparam logic [11:0] MAILBOX    = 12'h100;
  localparam logic [31:0] BOOT_DONE  = 32'h0000_0001;
  localparam logic [31:0] FW_PASS    = 32'h0000_0002;
  localparam logic [31:0] FW_FAIL    = 32'h0000_00FF;
  localparam int unsigned FW_APB_TRANSFERS = 5;   // the boot firmware's bus transfers
endpackage

// ======================================================================= the bus
// Nets, not variables: two drivers that disagree resolve to X, which an assertion
// can see. A clocking output that is never written stays 'z (IEEE 1800-2023 §14.16),
// so a passive agent cannot disturb the bus.
interface apb_if (input logic clk, input logic rst_n);
  wire        psel, penable, pwrite, pready;
  wire [11:0] paddr;
  wire [31:0] pwdata, prdata;
  clocking drv_cb @(posedge clk);                 // used only when the agent is active
    default input #1step output #1;
    output psel, penable, pwrite, paddr, pwdata;
    input  pready, prdata;
  endclocking
  clocking mon_cb @(posedge clk);
    default input #1step;
    input psel, penable, pwrite, paddr, pwdata, pready, prdata;
  endclocking
endinterface

// =================================================================== the mini SoC
// The SPI block's register port: CTRL and TXDATA, no wait states.
module spi_regs
  import soc_map_pkg::*;
(
  input  logic        clk,
  input  logic        rst_n,
  input  logic        psel,
  input  logic        penable,
  input  logic        pwrite,
  input  logic [11:0] paddr,
  input  logic [31:0] pwdata,
  output logic [31:0] prdata
);
  logic [31:0] ctrl, txdata;
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      ctrl   <= '0;
      txdata <= '0;
    end else if (psel && penable && pwrite) begin
      if (paddr == SPI_CTRL)   ctrl   <= pwdata;
      if (paddr == SPI_TXDATA) txdata <= pwdata;
    end
  end
  always_comb prdata = (paddr == SPI_CTRL)   ? ctrl   :
                       (paddr == SPI_TXDATA) ? txdata : '0;
endmodule

// The SoC: a CPU bus-functional model running the boot "firmware", the SPI block
// and a mailbox register at 0x100. The bus is inside the SoC; the interface port
// is the point where the testbench watches it.
module mini_soc
  import soc_map_pkg::*;
(
  apb_if bus
);
  logic        cpu_psel, cpu_penable, cpu_pwrite;
  logic [11:0] cpu_paddr;
  logic [31:0] cpu_pwdata, spi_rdata, mailbox_q;

  assign bus.psel    = cpu_psel;                  // the CPU is the only master
  assign bus.penable = cpu_penable;
  assign bus.pwrite  = cpu_pwrite;
  assign bus.paddr   = cpu_paddr;
  assign bus.pwdata  = cpu_pwdata;
  assign bus.pready  = 1'b1;                      // no wait states
  assign bus.prdata  = bus.paddr[8] ? mailbox_q : spi_rdata;

  spi_regs u_spi (
    .clk    (bus.clk),
    .rst_n  (bus.rst_n),
    .psel   (bus.psel && !bus.paddr[8]),          // 0x000-0x0FF is the SPI block
    .penable(bus.penable),
    .pwrite (bus.pwrite),
    .paddr  (bus.paddr),
    .pwdata (bus.pwdata),
    .prdata (spi_rdata)
  );

  always_ff @(posedge bus.clk or negedge bus.rst_n) begin
    if (!bus.rst_n) mailbox_q <= '0;
    else if (bus.psel && bus.penable && bus.pwrite && bus.paddr == MAILBOX)
      mailbox_q <= bus.pwdata;
  end

  // One APB write: a setup cycle (psel = 1), then an access cycle (penable = 1).
  task automatic apb_write(input logic [11:0] addr, input logic [31:0] data);
    @(posedge bus.clk);
    cpu_psel <= 1'b1;  cpu_penable <= 1'b0;  cpu_pwrite <= 1'b1;
    cpu_paddr <= addr; cpu_pwdata <= data;
    @(posedge bus.clk);
    cpu_penable <= 1'b1;
    @(posedge bus.clk);                           // pready = 1: completes at this edge
    cpu_psel <= 1'b0;  cpu_penable <= 1'b0;
  endtask

  task automatic apb_read(input logic [11:0] addr, output logic [31:0] data);
    @(posedge bus.clk);
    cpu_psel <= 1'b1;  cpu_penable <= 1'b0;  cpu_pwrite <= 1'b0;
    cpu_paddr <= addr;
    @(posedge bus.clk);
    cpu_penable <= 1'b1;
    @(posedge bus.clk);
    data = bus.prdata;                            // stable: no write is in progress
    cpu_psel <= 1'b0;  cpu_penable <= 1'b0;
  endtask

  // The boot firmware, reduced to the bus transfers it makes (5 of them).
  initial begin : firmware
    logic [31:0] rd;
    cpu_psel = 1'b0;  cpu_penable = 1'b0;  cpu_pwrite = 1'b0;
    cpu_paddr = '0;   cpu_pwdata = '0;
    @(posedge bus.rst_n);
    apb_write(MAILBOX, BOOT_DONE);                // 1: boot code finished
    apb_write(SPI_CTRL, 32'h9);                   // 2: enable the SPI block
    apb_read (SPI_CTRL, rd);                      // 3: firmware's own read-back
    apb_write(SPI_TXDATA, 32'hA5);                // 4: first byte to send
    apb_write(MAILBOX, (rd == 32'h9) ? FW_PASS : FW_FAIL);   // 5: verdict
  end
endmodule

// ============================================================= the UVM testbench
package soc_spi_pkg;
  import uvm_pkg::*;
  import soc_map_pkg::*;
  `include "uvm_macros.svh"

  // ------- the SPI block team's VIP and environment (reused; one SoC adaptation marked)
  class apb_item extends uvm_sequence_item;
    rand bit        write;
    rand bit [11:0] addr;
    rand bit [31:0] data;
    `uvm_object_utils_begin(apb_item)
      `uvm_field_int(write, UVM_ALL_ON)
      `uvm_field_int(addr,  UVM_ALL_ON)
      `uvm_field_int(data,  UVM_ALL_ON)
    `uvm_object_utils_end
    function new(string name = "apb_item");
      super.new(name);
    endfunction
    function string convert2string();
      return $sformatf("%s addr=0x%03h data=0x%08h", write ? "WR" : "RD", addr, data);
    endfunction
  endclass

  typedef uvm_sequencer #(apb_item) apb_sequencer;

  class apb_driver extends uvm_driver #(apb_item);
    `uvm_component_utils(apb_driver)
    virtual apb_if vif;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(virtual apb_if)::get(this, "", "vif", vif))
        `uvm_fatal("NO_VIF", "apb_driver: no virtual interface")
    endfunction
    task run_phase(uvm_phase phase);
      forever begin
        seq_item_port.get_next_item(req);
        @(vif.drv_cb);
        vif.drv_cb.psel    <= 1'b1;               // setup cycle
        vif.drv_cb.penable <= 1'b0;
        vif.drv_cb.pwrite  <= req.write;
        vif.drv_cb.paddr   <= req.addr;
        vif.drv_cb.pwdata  <= req.data;
        @(vif.drv_cb);
        vif.drv_cb.penable <= 1'b1;               // access cycle
        @(vif.drv_cb);
        while (!vif.drv_cb.pready) @(vif.drv_cb);
        if (!req.write) req.data = vif.drv_cb.prdata;
        vif.drv_cb.psel    <= 1'b0;
        vif.drv_cb.penable <= 1'b0;
        seq_item_port.item_done();
      end
    endtask
  endclass

  class apb_monitor extends uvm_monitor;
    `uvm_component_utils(apb_monitor)
    virtual apb_if vif;
    uvm_analysis_port #(apb_item) ap;
    int unsigned n_seen;                          // activity evidence for the SoC
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      ap = new("ap", this);
      if (!uvm_config_db#(virtual apb_if)::get(this, "", "vif", vif))
        `uvm_fatal("NO_VIF", "apb_monitor: no virtual interface")
    endfunction
    task run_phase(uvm_phase phase);
      forever begin
        @(vif.mon_cb);
        if (vif.mon_cb.psel && vif.mon_cb.penable && vif.mon_cb.pready) begin
          apb_item t = apb_item::type_id::create("t");   // a new object per transfer
          t.write = vif.mon_cb.pwrite;
          t.addr  = vif.mon_cb.paddr;
          t.data  = vif.mon_cb.pwrite ? vif.mon_cb.pwdata : vif.mon_cb.prdata;
          n_seen++;
          `uvm_info("APB_MON", t.convert2string(), UVM_MEDIUM)
          ap.write(t);
        end
      end
    endtask
  endclass

  // The SPI block's agent for its APB register port.
  class spi_apb_agent extends uvm_agent;
    `uvm_component_utils(spi_apb_agent)
    apb_monitor   monitor;
    apb_sequencer sequencer;
    apb_driver    driver;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      super.build_phase(phase);                   // uvm_agent reads "is_active" here
      monitor = apb_monitor::type_id::create("monitor", this);
      if (get_is_active() == UVM_ACTIVE) begin    // passive: never built at all
        sequencer = apb_sequencer::type_id::create("sequencer", this);
        driver    = apb_driver::type_id::create("driver", this);
      end
    endfunction
    function void connect_phase(uvm_phase phase);
      super.connect_phase(phase);
      if (get_is_active() == UVM_ACTIVE)          // the same guard as build_phase
        driver.seq_item_port.connect(sequencer.seq_item_export);
    endfunction
  endclass

  // The block team's bring-up sequence: it plays the CPU and configures the block.
  class spi_cfg_seq extends uvm_sequence #(apb_item);
    `uvm_object_utils(spi_cfg_seq)
    function new(string name = "spi_cfg_seq");
      super.new(name);
    endfunction
    task body();
      do_write(SPI_CTRL, 32'h1);
      do_write(SPI_TXDATA, 32'h3C);
    endtask
    task do_write(bit [11:0] addr, bit [31:0] data);
      apb_item it = apb_item::type_id::create("it");
      start_item(it);                             // needs a sequencer: see step 2
      it.write = 1'b1;
      it.addr  = addr;
      it.data  = data;
      finish_item(it);
    endtask
  endclass

  // Predicts from what the monitor saw, not from what a sequence meant to send,
  // so it works whether a sequence or firmware drives the port.
  class spi_reg_scb extends uvm_subscriber #(apb_item);
    `uvm_component_utils(spi_reg_scb)
    bit [31:0]   shadow [bit [11:0]];
    int unsigned n_match, n_mismatch;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void write(apb_item t);
      if (t.addr[8]) return;                      // adapted for SoC: not SPI's window
      if (t.write) shadow[t.addr] = t.data;
      else begin
        bit [31:0] exp = shadow.exists(t.addr) ? shadow[t.addr] : '0;  // reset 0
        if (t.data == exp) n_match++;
        else begin
          n_mismatch++;
          `uvm_error("SPI_SCB", $sformatf("read 0x%03h: got 0x%08h, expected 0x%08h",
                                          t.addr, t.data, exp))
        end
      end
    endfunction
    function void report_phase(uvm_phase phase);
      `uvm_info("SCB_SUMMARY", $sformatf("matches=%0d mismatches=%0d pending=0",
                                         n_match, n_mismatch), UVM_LOW)
    endfunction
  endclass

  class spi_blk_env extends uvm_env;
    `uvm_component_utils(spi_blk_env)
    spi_apb_agent spi_agent;
    spi_reg_scb   scb;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      spi_agent = spi_apb_agent::type_id::create("spi_agent", this);
      scb       = spi_reg_scb::type_id::create("scb", this);
    endfunction
    function void connect_phase(uvm_phase phase);
      spi_agent.monitor.ap.connect(scb.analysis_export);
    endfunction
  endclass

  // ----------------------------------------------------------- SoC-only code
  // Turns firmware mailbox writes into events the test can wait on.
  class mbx_decoder extends uvm_subscriber #(apb_item);
    `uvm_component_utils(mbx_decoder)
    uvm_event boot_done_ev, fw_pass_ev;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      boot_done_ev = uvm_event_pool::get_global("fw_boot_done");
      fw_pass_ev   = uvm_event_pool::get_global("fw_pass");
    endfunction
    function void write(apb_item t);
      if (!(t.write && t.addr == MAILBOX)) return;
      case (t.data)
        BOOT_DONE: begin
          `uvm_info("MBX", "firmware reports BOOT_DONE", UVM_LOW)
          boot_done_ev.trigger();
        end
        FW_PASS: begin
          `uvm_info("MBX", "firmware reports FW_PASS", UVM_LOW)
          fw_pass_ev.trigger();
        end
        default: `uvm_error("MBX", $sformatf("firmware reports code 0x%08h", t.data))
      endcase
    endfunction
  endclass

  class soc_env extends uvm_env;
    `uvm_component_utils(soc_env)
    spi_blk_env spi_env;                          // the block env, reused whole
    mbx_decoder mbx_dec;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      spi_env = spi_blk_env::type_id::create("spi_env", this);
      mbx_dec = mbx_decoder::type_id::create("mbx_dec", this);
    endfunction
    function void connect_phase(uvm_phase phase);
      spi_env.spi_agent.monitor.ap.connect(mbx_dec.analysis_export);
    endfunction
    // Evidence that the passive monitor is really connected to the busy bus.
    function void check_phase(uvm_phase phase);
      int unsigned n = spi_env.spi_agent.monitor.n_seen;
      `uvm_info("SOC_ENV", $sformatf("spi_agent monitor saw %0d transfers", n), UVM_LOW)
      if (n != FW_APB_TRANSFERS)
        `uvm_error("TRAFFIC_COUNT", $sformatf("expected %0d transfers from firmware",
                                              FW_APB_TRANSFERS))
    endfunction
  endclass

  // Copied from the SPI block team's block_test and renamed. Steps 2 and 3 fix it.
  class soc_test extends uvm_test;
    `uvm_component_utils(soc_test)
    soc_env env;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      // TODO (step 2): the CPU drives the SPI block's APB port in the SoC.
      // Make env.spi_env.spi_agent passive with uvm_config_db, using the exact path.
      env = soc_env::type_id::create("env", this);
    endfunction
    function void end_of_elaboration_phase(uvm_phase phase);
      uvm_root::get().print_topology();           // build audit (Annex F.7.4.2)
      // TODO (step 3): fail with UVM_FATAL [MODE] unless spi_agent is passive.
    endfunction
    task run_phase(uvm_phase phase);
      uvm_event boot_done = uvm_event_pool::get_global("fw_boot_done");
      uvm_event fw_pass   = uvm_event_pool::get_global("fw_pass");
      spi_cfg_seq cfg_seq = spi_cfg_seq::type_id::create("cfg_seq");
      phase.raise_objection(this);
      fork
        begin
          // From the block test: configure the SPI block through the agent.
          // TODO (step 3): in the SoC, firmware owns this bus. Remove these lines.
          cfg_seq.start(env.spi_env.spi_agent.sequencer);
          boot_done.wait_on();                    // returns at once if already on
          `uvm_info("TEST", "boot complete: system checks enabled", UVM_LOW)
          fw_pass.wait_on();
          `uvm_info("TEST", "firmware test finished", UVM_LOW)
        end
        begin                                     // a watchdog, not synchronization
          #10us;
          `uvm_error("FW_TIMEOUT", "no BOOT_DONE and FW_PASS within 10 us")
        end
      join_any
      disable fork;
      phase.drop_objection(this);
    endtask
  endclass
endpackage

// ========================================================================= tb_top
module tb_top;
  import uvm_pkg::*;
  import soc_spi_pkg::*;

  logic clk   = 1'b0;
  logic rst_n = 1'b0;
  always #5 clk = ~clk;                           // rising edges at 5, 15, 25 ns, ...
  initial #22 rst_n = 1'b1;                       // released between two edges

  apb_if   apb_bus   (clk, rst_n);
  apb_if   spare_bus (clk, rst_n);                // an idle APB segment (used in step 4)
  mini_soc u_soc     (.bus(apb_bus));

  // An SoC-level protocol check that reports through UVM, so it fails the test.
  a_apb_known: assert property (@(posedge clk) disable iff (!rst_n)
    !$isunknown({apb_bus.psel, apb_bus.penable}) &&
    (!apb_bus.psel || !$isunknown({apb_bus.pwrite, apb_bus.paddr})))
    else `uvm_error("APB_X", "X on APB control: is a second master driving the bus?")

  initial begin
    // Only the reused agent's components need this interface.
    uvm_config_db#(virtual apb_if)::set(null, "uvm_test_top.env.spi_env.spi_agent.*",
                                        "vif", apb_bus);
    run_test("soc_test");                         // +UVM_TESTNAME overrides this
  end
endmodule
