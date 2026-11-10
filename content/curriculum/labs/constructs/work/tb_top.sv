// tb_top.sv: the starter testbench for lab constructs-1 (see README.md).
// Compile it with work/rot_pipe.sv and work/pipe_if.sv; the top is tb_top.
// It compiles and runs as it is, but it checks nothing. Each TODO step N
// comment marks code you write in step N. The clock, the DUT connection, the
// scoreboard type, the reference model and the test are given.
module tb_top;
  timeunit 1ns; timeprecision 1ps;

  localparam time     CLK_PERIOD   = 10ns;
  // Driven through cb just after edge k: changes in Re-NBA after edge k, accepted
  // at edge k+1 (R2), in the output register at k+3, sampled by mon_cb at k+4.
  localparam int      SAMPLE_EDGES = 4;
  localparam realtime TIMEOUT      = 10us;   // the run needs about 160 ns

  logic clk = 1'b0;                          // must start known: ~x stays x
  always #(CLK_PERIOD / 2) clk = ~clk;       // rising edges at 5, 15, 25 ns ...

  pipe_if bus (.clk(clk));

  // The DUT. Set .BUG(1) or .BUG(2) to prove that the bench can fail (step 6).
  rot_pipe #(.BUG(0)) dut (
    .clk(clk), .rst_n(bus.rst_n),
    .in_vld(bus.in_vld), .in_data(bus.in_data),
    .out_vld(bus.out_vld), .out_data(bus.out_data)
  );

  // Scoreboard: one expectation per item, oldest first
  typedef struct {
    logic [7:0] din;                         // the input, so a failure can name it
    logic [7:0] dout;                        // the expected result (R3)
    time        due;                         // the edge at which mon_cb must see it
  } exp_t;

  exp_t exp_q[$];
  int   pass_cnt = 0;
  int   fail_cnt = 0;

  // ------------------------------------------------- reference model (given)
  // R3 written from the specification, not copied from the RTL.
  function automatic logic [7:0] model_rotl(input logic [7:0] d);
    return (d << 1) | (d >> 7);              // 8-bit context: bit 7 comes back as bit 0
  endfunction

  // ------------------------------------------------------- step 3: the driver
  // Call send right after @(bus.cb), at edge k. It returns at edge k+1.
  task automatic send(input logic [7:0] data);
    // TODO step 3: drive in_vld high and in_data through cb; push an exp_t
    // with the input, model_rotl(data) and the edge at which mon_cb must see
    // the result ($time + SAMPLE_EDGES * CLK_PERIOD); then wait for @(bus.cb).
  endtask

  // No item for n cycles. Call it right after @(bus.cb), like send.
  task automatic idle(input int n);
    // TODO step 3: drive in_vld low through cb, then wait n events of cb.
  endtask

  // ------------------------------------------------------ step 4: the monitor
  task automatic monitor();
    // TODO step 4: forever, wait for @(bus.mon_cb) and read only mon_cb.
    // Skip samples taken in reset, fail on an unknown out_vld, and when
    // out_vld is 1 check the oldest expectation: fail on an empty queue, on a
    // result at the wrong time ($time != due) and on a wrong value (!==).
    // Count every check in pass_cnt or fail_cnt.
  endtask

  initial monitor();                         // runs for the whole simulation

  // ------------------------------------------------------- the test (given)
  task automatic run_test();
    send(8'h01);                             // bit 7 clear
    send(8'h80);                             // only bit 7 set: the bit that wraps
    send(8'hC3);                             // back to back: three items in flight
    idle(2);                                 // no result may appear in a gap
    send(8'h5A);
    send(8'hFF);                             // all ones: a lost bit 7 shows as FE
    idle(1);
  endtask

  // ------------------------------------------------- step 5: verdict and main
  // The verdict: exactly one line, in a format a script can match.
  function automatic void report();
    // TODO step 5: count leftover expectations and an empty run as failures.
    $display("PASS=%0d FAIL=%0d", pass_cnt, fail_cnt);
  endfunction

  initial begin : main
    if ($test$plusargs("DUMP")) begin
      $dumpfile("tb_top.vcd");
      $dumpvars(0, tb_top);
    end
    // TODO step 5: in one branch of a fork, drive in_vld low through cb,
    // release rst_n directly at 12 ns, wait for the 15 ns edge with
    // @(bus.cb), run the test and drain with bus.wait_cycles. In a second
    // branch, a watchdog. Join with join_any, then disable fork.
    run_test();
    report();
    $finish;
  end
endmodule
