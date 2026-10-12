// tb_top.sv: reference solution for lab simple-dut-1 (see README.md).
// Compile it together with work/sat_adder_reg.sv; the top module is tb_top.
// It follows the bench in F2E: Your First Self-Checking Testbench, with a model
// written from the saturating adder's specification.
module tb_top;
  timeunit 1ns; timeprecision 1ps;

  localparam int         W       = 8;
  localparam realtime    TIMEOUT = 10us;               // the longest run takes 250 ns
  localparam logic [W:0] MAX_SUM = {1'b0, {W{1'b1}}};  // 255: the largest W-bit value

  // Signals between the bench and the DUT
  logic         clk = 1'b0;            // must start known: ~x stays x
  logic         rst_n;
  logic         in_valid;
  logic [W-1:0] a, b;
  logic         out_valid;
  logic [W-1:0] sum;

  // Scoreboard: one expectation per transaction, oldest first
  typedef struct {
    logic [W-1:0] a, b;                // the inputs, so a failure can name them
    logic [W-1:0] sum;                 // the expected result
  } exp_t;

  exp_t exp_q[$];
  int   pass_cnt = 0;
  int   fail_cnt = 0;

  // The DUT. Set .BUG(1) or .BUG(2) to prove that the bench can fail (step 7).
  sat_adder_reg #(.W(W), .BUG(0)) dut (
    .clk(clk), .rst_n(rst_n), .in_valid(in_valid), .a(a), .b(b),
    .out_valid(out_valid), .sum(sum)
  );

  // ----------------------------------------------------- step 2: clock and reset
  always #5 clk = ~clk;                // 10 ns period: rising edges at 5, 15, 25 ns ...

  // Hold rst_n low for a number of rising edges, then release it.
  task automatic reset_dut(input int cycles = 2);
    rst_n    <= 1'b0;
    in_valid <= 1'b0;
    a        <= '0;
    b        <= '0;
    repeat (cycles) @(posedge clk);
    rst_n    <= 1'b1;                  // just after an edge: seen on the next one
  endtask

  // ------------------------------------------- step 3: reference model and drive
  // The specification's answer, written independently of the RTL: widen, add,
  // then clamp at the largest W-bit value.
  function automatic logic [W-1:0] model_sat_add(input logic [W-1:0] op_a,
                                                 input logic [W-1:0] op_b);
    logic [W:0] total;
    total = {1'b0, op_a} + {1'b0, op_b};   // widen first, so the carry is kept
    if (total > MAX_SUM) return MAX_SUM[W-1:0];
    return total[W-1:0];
  endfunction

  // Drive one addition for one cycle and record what the DUT must answer.
  task automatic send(input logic [W-1:0] a_val, input logic [W-1:0] b_val);
    @(posedge clk);
    in_valid <= 1'b1;                  // <= lands after the DUT's flops read this edge
    a        <= a_val;
    b        <= b_val;
    exp_q.push_back(exp_t'{a: a_val, b: b_val, sum: model_sat_add(a_val, b_val)});
  endtask

  // Drive no addition for n cycles.
  task automatic idle(input int n);
    repeat (n) begin
      @(posedge clk);
      in_valid <= 1'b0;
    end
  endtask

  // ---------------------------------------------------------- step 4: checker
  // Compare one DUT result with the oldest expectation.
  function automatic void check_result(input logic [W-1:0] actual);
    exp_t e;
    if (exp_q.size() == 0) begin
      fail_cnt++;
      $error("CHK unexpected result sum=%0d: nothing was sent", actual);
      return;
    end
    e = exp_q.pop_front();
    if (actual !== e.sum) begin        // !== : an x or z bit is a mismatch
      fail_cnt++;
      $error("CHK a=%0d b=%0d: sum=%0d, expected %0d", e.a, e.b, actual, e.sum);
    end else begin
      pass_cnt++;
    end
  endfunction

  // A testbench process, so always, not always_ff (1800-2023 9.2.2.4). It wakes
  // on every rising edge, whether or not sum changes, and reads out_valid and
  // sum as they were before this edge: the DUT updates them with <=.
  always @(posedge clk) begin
    if (rst_n) begin                   // no checks while the DUT is in reset
      if ($isunknown(out_valid)) begin
        fail_cnt++;
        $error("CHK out_valid is %b after reset", out_valid);
      end else if (out_valid) begin
        check_result(sum);
      end
    end
  end

  // -------------------------------------------------- step 5: directed tests
  task automatic test_smoke();         // R3 for ordinary values: no saturation
    send(8'd1, 8'd2);
    send(8'd10, 8'd20);
    send(8'd100, 8'd27);
    idle(1);
  endtask

  task automatic test_corners();       // R3 at the saturation boundary
    send(8'd0, 8'd0);                  // every result bit 0
    send(8'd255, 8'd0);                // 255: fits, no saturation
    send(8'd200, 8'd55);               // 255: the largest sum that fits
    send(8'd200, 8'd56);               // 256: the smallest sum that saturates
    send(8'd128, 8'd128);              // 256 with a zero low byte
    send(8'd255, 8'd255);              // 510: the largest sum, saturates
    send(8'd100, 8'd100);              // 200: back below the limit after saturating
    idle(1);
  endtask

  task automatic test_gaps();          // R2: one result per valid input
    send(8'd5, 8'd5);
    idle(2);                           // no result may appear on idle cycles
    send(8'd7, 8'd8);
    send(8'd9, 8'd10);                 // back to back: two results in flight
    idle(1);
    send(8'd11, 8'd12);
    idle(1);
  endtask

  task automatic run_one(input string name);
    $display("%t TEST %s", $time, name);
    case (name)
      "smoke":   test_smoke();
      "corners": test_corners();
      "gaps":    test_gaps();
      default:   $fatal(1, "TEST unknown test '%s' (use smoke, corners, gaps, all)",
                        name);
    endcase
  endtask

  // ---------------------------------------------------------- step 6: verdict
  // Wait (bounded) until every expectation is checked, then two quiet cycles,
  // so that a late or extra result cannot slip past the summary.
  task automatic drain(input int max_cycles = 20);
    repeat (max_cycles) begin
      @(negedge clk);                  // mid-cycle: the checker is not running
      if (exp_q.size() == 0) break;
    end
    repeat (2) @(negedge clk);
  endtask

  // The verdict: exactly one line, in a format a script can match.
  function automatic void report();
    if (exp_q.size() != 0) begin
      fail_cnt += exp_q.size();
      $error("CHK %0d result(s) never arrived", exp_q.size());
    end
    if (pass_cnt == 0 && fail_cnt == 0) begin
      fail_cnt++;                      // a run that checked nothing proves nothing
      $error("CHK nothing was checked");
    end
    $display("PASS=%0d FAIL=%0d", pass_cnt, fail_cnt);
  endfunction

  initial begin : main
    string test_name;
    $timeformat(-9, 0, " ns", 0);      // %t prints nanoseconds: "15 ns"
    if (!$value$plusargs("TEST=%s", test_name)) test_name = "all";
    if ($test$plusargs("DUMP")) begin  // waveforms only on request
      $dumpfile("tb_top.vcd");
      $dumpvars(0, tb_top);
    end
    fork
      begin : run
        reset_dut();
        if (test_name == "all") begin
          run_one("smoke");
          run_one("corners");
          run_one("gaps");
        end else begin
          run_one(test_name);
        end
        drain();
      end
      begin : watchdog
        #(TIMEOUT);
        fail_cnt++;                    // a hang is a failure, never a pass
        report();
        $fatal(1, "WDOG test '%s' still running at %t", test_name, $time);
      end
    join_any
    disable fork;                      // main has no other children: only the watchdog
    report();
    $finish;
  end
endmodule
