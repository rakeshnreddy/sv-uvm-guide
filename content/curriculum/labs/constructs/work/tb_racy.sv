// tb_racy.sv: the bench before the conversion, for step 7 of lab constructs-1
// (see README.md). It is complete; do not copy its driver into real benches.
// Compile it with work/rot_pipe.sv only; the top is tb_racy.
//
// It runs the same items as tb_top and checks them the same way, value and
// arrival time, but it has no interface and no clocking block. The driver wakes
// on @(posedge clk), with the DUT's flops, and writes their inputs with blocking
// assignments. Both processes are ready in the Active region of that time slot,
// and IEEE 1800-2023 4.7 lets the simulator run them in either order:
//   - the flops first: they read the old inputs, and the item is accepted at
//     the next edge, as the bench expects;
//   - the driver first: the flops read the new inputs at this edge, and every
//     result arrives one cycle early.
// +DUT_FIRST replays the first order on any simulator: nonblocking writes land
// in the NBA region, after the flops have read the old values (4.4.2.4), which
// is what the flops see when they run before the blocking writes.
module tb_racy;
  timeunit 1ns; timeprecision 1ps;

  localparam time     CLK_PERIOD   = 10ns;
  localparam int      SAMPLE_EDGES = 4;      // as in tb_top: driven at edge k, seen at edge k+4
  localparam realtime TIMEOUT      = 10us;

  logic       clk = 1'b0;
  always #(CLK_PERIOD / 2) clk = ~clk;       // rising edges at 5, 15, 25 ns ...

  logic       rst_n = 1'b0;
  logic       in_vld = 1'b0;                 // time 0: no edge yet, nothing races
  logic [7:0] in_data;
  logic       out_vld;
  logic [7:0] out_data;

  rot_pipe #(.BUG(0)) dut (.*);

  typedef struct {
    logic [7:0] din;
    logic [7:0] dout;
    time        due;
  } exp_t;

  exp_t exp_q[$];
  int   pass_cnt = 0;
  int   fail_cnt = 0;
  bit   dut_first;

  function automatic logic [7:0] model_rotl(input logic [7:0] d);
    return (d << 1) | (d >> 7);
  endfunction

  // The racy driver. It intends what tb_top's send does: the DUT accepts the
  // item at the edge after the one it was driven at, so the result is in the
  // output register at edge k+3 and the monitor sees it at edge k+4.
  task automatic send_racy(input logic [7:0] data);
    @(posedge clk);                          // wakes with the DUT's flops
    if (dut_first) begin
      in_vld  <= 1'b1;
      in_data <= data;
    end else begin
      in_vld  = 1'b1;                        // the race: blocking writes at the edge
      in_data = data;
    end
    exp_q.push_back(exp_t'{din: data, dout: model_rotl(data),
                           due: $time + SAMPLE_EDGES * CLK_PERIOD});
  endtask

  task automatic idle_racy(input int n);
    repeat (n) begin
      @(posedge clk);
      if (dut_first) in_vld <= 1'b0;
      else           in_vld = 1'b0;
    end
  endtask

  // The monitor reads the DUT's outputs right after @(posedge clk). That read
  // is deterministic: the DUT writes them with <=, so an Active-region read
  // sees the values from before this edge's NBA update, the same values as
  // tb_top's #1step samples. The race is in the driver only. (Reading a
  // clockvar after @(posedge clk) would race; F4C.)
  always @(posedge clk) begin : monitor
    exp_t e;
    if (rst_n === 1'b1 && out_vld === 1'b1) begin
      if (exp_q.size() == 0) begin
        fail_cnt++;
        $error("CHK unexpected result %h: nothing was sent", out_data);
      end else begin
        e = exp_q.pop_front();
        if ($time != e.due) begin
          fail_cnt++;
          $error("CHK in=%h: result at %0d ns, expected at %0d ns", e.din, $time, e.due);
        end else if (out_data !== e.dout) begin
          fail_cnt++;
          $error("CHK in=%h: out=%h, expected %h", e.din, out_data, e.dout);
        end else begin
          pass_cnt++;
          $display("%0d ns PASS in=%h out=%h", $time, e.din, e.dout);
        end
      end
    end
  end

  function automatic void report();
    if (exp_q.size() != 0) begin
      fail_cnt += exp_q.size();
      $error("CHK %0d result(s) never arrived", exp_q.size());
    end
    if (pass_cnt == 0 && fail_cnt == 0) begin
      fail_cnt++;
      $error("CHK nothing was checked");
    end
    $display("PASS=%0d FAIL=%0d", pass_cnt, fail_cnt);
  endfunction

  initial begin : main
    dut_first = $test$plusargs("DUT_FIRST");
    fork
      begin : run
        #12 rst_n = 1'b1;                    // between edges
        send_racy(8'h01);                    // at 15 ns: the same items and edges as tb_top
        send_racy(8'h80);
        send_racy(8'hC3);
        idle_racy(2);
        send_racy(8'h5A);
        send_racy(8'hFF);
        idle_racy(1);
        repeat (SAMPLE_EDGES + 2) @(negedge clk);   // drain, away from the active edge
      end
      begin : watchdog
        #(TIMEOUT);
        fail_cnt++;
        report();
        $fatal(1, "WDOG still running at %0d ns", $time);
      end
    join_any
    disable fork;
    report();
    $finish;
  end
endmodule
