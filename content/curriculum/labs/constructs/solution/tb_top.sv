// tb_top.sv: reference solution for lab constructs-1 (see README.md).
// Compile it with work/rot_pipe.sv and solution/pipe_if.sv; the top is tb_top.
// It is the M1 bench of F4C: Synchronizing with Clocking and Program Blocks,
// for rot_pipe instead of pipe2, with F2E's self-checking conventions and one
// addition: every result is checked for its arrival time as well as its value.
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
  // Call it right after @(bus.cb), at edge k. The drives change in_vld and
  // in_data in the Re-NBA region after edge k (1800-2023 14.16), after the
  // DUT's flops have read them, so the DUT accepts the item at edge k+1 in
  // every process order. Returns at edge k+1, ready for the next item.
  task automatic send(input logic [7:0] data);
    bus.cb.in_vld  <= 1'b1;
    bus.cb.in_data <= data;
    exp_q.push_back(exp_t'{din: data, dout: model_rotl(data),
                           due: $time + SAMPLE_EDGES * CLK_PERIOD});
    @(bus.cb);
  endtask

  // No item for n cycles. Call it right after @(bus.cb), like send.
  task automatic idle(input int n);
    bus.cb.in_vld <= 1'b0;
    repeat (n) @(bus.cb);
  endtask

  // ------------------------------------------------------ step 4: the monitor
  // It wakes on the clocking block event, after this edge's samples are stored
  // (14.10, 14.13), and reads nothing but mon_cb, so every value it reads is
  // the value from just before the edge, whatever order the processes run in.
  task automatic monitor();
    exp_t e;
    forever begin
      @(bus.mon_cb);                         // never @(posedge clk) before a mon_cb read
      if (bus.mon_cb.rst_n !== 1'b1) continue;   // ignore samples taken in reset
      if ($isunknown(bus.mon_cb.out_vld)) begin
        fail_cnt++;
        $error("CHK out_vld is %b after reset", bus.mon_cb.out_vld);
      end else if (bus.mon_cb.out_vld) begin
        if (exp_q.size() == 0) begin
          fail_cnt++;
          $error("CHK unexpected result %h: nothing was sent", bus.mon_cb.out_data);
        end else begin
          e = exp_q.pop_front();
          if ($time != e.due) begin          // right value, wrong cycle, is a failure
            fail_cnt++;
            $error("CHK in=%h: result at %0d ns, expected at %0d ns", e.din, $time, e.due);
          end else if (bus.mon_cb.out_data !== e.dout) begin
            fail_cnt++;
            $error("CHK in=%h: out=%h, expected %h", e.din, bus.mon_cb.out_data, e.dout);
          end else begin
            pass_cnt++;
            $display("%0d ns PASS in=%h out=%h", $time, e.din, e.dout);
          end
        end
      end
    end
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
    if (exp_q.size() != 0) begin
      fail_cnt += exp_q.size();
      $error("CHK %0d result(s) never arrived", exp_q.size());
    end
    if (pass_cnt == 0 && fail_cnt == 0) begin
      fail_cnt++;                            // a run that checked nothing proves nothing
      $error("CHK nothing was checked");
    end
    $display("PASS=%0d FAIL=%0d", pass_cnt, fail_cnt);
  endfunction

  initial begin : main
    if ($test$plusargs("DUMP")) begin
      $dumpfile("tb_top.vcd");
      $dumpvars(0, tb_top);
    end
    fork
      begin : run
        bus.cb.in_vld <= 1'b0;               // no clocking event yet: lands at 5 ns
        #12 bus.rst_n = 1'b1;                // asynchronous: written directly, between edges
        @(bus.cb);                           // the 15 ns edge
        run_test();
        bus.wait_cycles(SAMPLE_EDGES + 2);   // drain: the last result, then two quiet edges
      end
      begin : watchdog
        #(TIMEOUT);
        fail_cnt++;                          // a hang is a failure, never a pass
        report();
        $fatal(1, "WDOG still running at %0d ns", $time);
      end
    join_any
    disable fork;                            // stops the watchdog; monitor is not a child
    report();
    $finish;
  end
endmodule
