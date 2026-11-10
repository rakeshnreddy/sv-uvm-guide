// tb_top.sv: the top module for lab fifo-1 (see README.md). Given; you do not
// need to change it except to set .BUG in step 8.
// Compile order: sync_fifo.sv, fifo_if.sv, fifo_tb_pkg.sv, tb_top.sv.
//
// Plusargs: +TEST=<name> runs one test (smoke, fill_drain, simultaneous,
// mixed); without it every test runs, back to back. +DUMP writes tb_top.vcd.
module tb_top;
  timeunit 1ns; timeprecision 1ps;
  import fifo_tb_pkg::*;

  localparam realtime TIMEOUT = 20us;   // the longest run takes under 2 us

  logic clk = 1'b0;                     // must start known: ~x stays x
  always #5 clk = ~clk;                 // 10 ns period

  fifo_if #(.W(W)) bus (.clk(clk));

  // The DUT. Set .BUG(1) or .BUG(2) to prove that the bench can fail (step 8).
  sync_fifo #(.W(W), .DEPTH(DEPTH), .BUG(0)) dut (
    .clk(clk), .rst_n(bus.rst_n),
    .wr_en(bus.wr_en), .wr_data(bus.wr_data), .rd_en(bus.rd_en),
    .rd_data(bus.rd_data), .full(bus.full), .empty(bus.empty)
  );

  fifo_env env;

  initial begin : main
    string test;
    bit    all_tests;

    if ($test$plusargs("DUMP")) begin
      $dumpfile("tb_top.vcd");
      $dumpvars(0, tb_top);
    end
    all_tests = !$value$plusargs("TEST=%s", test);
    if (all_tests) test = "all";

    env = new(bus);                     // the virtual interface handle: bus
    fork
      env.run(test);
      begin                             // watchdog: a hung run still ends
        #(TIMEOUT);
        env.sb.fail_cnt++;
        env.sb.report(all_tests);
        $fatal(1, "WDOG no end after %0t", TIMEOUT);
      end
    join_any
    disable fork;                       // stops the watchdog and the monitor
    env.sb.report(all_tests);
    $finish;
  end
endmodule
