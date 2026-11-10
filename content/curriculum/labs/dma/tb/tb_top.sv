// Top level of lab dma-1: clock, reset, the DUT, the two interfaces, and run_test().
// Pick the test with +UVM_TESTNAME=<test> and a planted bug with +DMA_BUG=<n>.
module tb_top;
  import uvm_pkg::*;
  import dma_tb_pkg::*;

  logic clk = 1'b0;
  always #5 clk = ~clk;              // 10 ns clock

  dma_cfg_if cfg_if (clk);
  dma_mem_if mem_if (clk);

  // One reset for both interfaces: low for the first three rising edges.
  logic rst_n = 1'b0;
  initial begin
    repeat (3) @(posedge clk);
    rst_n <= 1'b1;
  end
  assign cfg_if.rst_n = rst_n;
  assign mem_if.rst_n = rst_n;

  dma_copy dut (
    .clk        (clk),
    .rst_n      (rst_n),
    .cfg_valid  (cfg_if.cfg_valid),
    .cfg_write  (cfg_if.cfg_write),
    .cfg_addr   (cfg_if.cfg_addr),
    .cfg_wdata  (cfg_if.cfg_wdata),
    .cfg_rdata  (cfg_if.cfg_rdata),
    .mem_req    (mem_if.mem_req),
    .mem_we     (mem_if.mem_we),
    .mem_addr   (mem_if.mem_addr),
    .mem_wdata  (mem_if.mem_wdata),
    .mem_gnt    (mem_if.mem_gnt),
    .mem_rvalid (mem_if.mem_rvalid),
    .mem_rdata  (mem_if.mem_rdata),
    .done_o     (cfg_if.done_o)
  );

  initial begin
    $timeformat(-9, 0, " ns", 0);    // UVM messages print "@ 115 ns"
    uvm_config_db#(virtual dma_cfg_if)::set(null, "uvm_test_top.env.cfg_agt*", "vif", cfg_if);
    uvm_config_db#(virtual dma_mem_if)::set(null, "uvm_test_top.env.mem_agt*", "vif", mem_if);
    run_test("dma_smoke_test");
  end
endmodule
