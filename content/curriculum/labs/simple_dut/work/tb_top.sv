// tb_top.sv: starter testbench for lab simple-dut-1 (see README.md).
// Compile it together with work/sat_adder_reg.sv; the top module is tb_top.
//
// It compiles and runs as it is, but it checks nothing yet. Every
// "TODO step N" marks code you write in that step of the README. Keep the names
// (send, idle, model_sat_add, exp_q, check_result, report ...): they are the
// names F2E uses, and the lab's step checks look for them.
module tb_top;
  timeunit 1ns; timeprecision 1ps;

  localparam int         W       = 8;
  localparam realtime    TIMEOUT = 10us;               // for the watchdog (step 6)
  localparam logic [W:0] MAX_SUM = {1'b0, {W{1'b1}}};  // 255: the largest W-bit value

  // Signals between the bench and the DUT
  logic         clk;                   // TODO step 2: give clk an initial value
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

  // The DUT. Leave .BUG(0) until step 7.
  sat_adder_reg #(.W(W), .BUG(0)) dut (
    .clk(clk), .rst_n(rst_n), .in_valid(in_valid), .a(a), .b(b),
    .out_valid(out_valid), .sum(sum)
  );

  // ----------------------------------------------------- step 2: clock and reset
  // TODO step 2: generate a 10 ns clock (rising edges at 5, 15, 25 ns ...).

  // Hold rst_n low for a number of rising edges, then release it.
  task automatic reset_dut(input int cycles = 2);
    // TODO step 2: drive rst_n, in_valid, a and b to known values, wait
    // `cycles` rising edges, then release rst_n. Use <= for every drive.
  endtask

  // ------------------------------------------- step 3: reference model and drive
  // The specification's answer (README, "The DUT"), written without reading the RTL.
  function automatic logic [W-1:0] model_sat_add(input logic [W-1:0] op_a,
                                                 input logic [W-1:0] op_b);
    // TODO step 3: return op_a + op_b, or MAX_SUM[W-1:0] when the sum does not
    // fit in W bits. Widen the operands first so that the carry is kept.
    return 'x;
  endfunction

  // Drive one addition for one cycle and record what the DUT must answer.
  task automatic send(input logic [W-1:0] a_val, input logic [W-1:0] b_val);
    // TODO step 3: wait for a rising edge, drive in_valid, a and b with <=,
    // and push an exp_t with the model's answer onto exp_q.
  endtask

  // Drive no addition for n cycles.
  task automatic idle(input int n);
    // TODO step 3: for n rising edges, drive in_valid low with <=.
  endtask

  // ---------------------------------------------------------- step 4: checker
  // Compare one DUT result with the oldest expectation.
  function automatic void check_result(input logic [W-1:0] actual);
    // TODO step 4: fail on an empty queue, pop the oldest expectation, compare
    // with !==, and count a pass or a failure (with $error).
  endfunction

  // TODO step 4: the checker process. On every rising edge after reset, fail
  // if out_valid is unknown, and call check_result(sum) when out_valid is 1.

  // -------------------------------------------------- step 5: directed tests
  task automatic test_smoke();         // R3 for ordinary values: no saturation
    send(8'd1, 8'd2);
    send(8'd10, 8'd20);
    send(8'd100, 8'd27);
    idle(1);
  endtask

  task automatic test_corners();       // R3 at the saturation boundary
    // TODO step 5
  endtask

  task automatic test_gaps();          // R2: one result per valid input
    // TODO step 5
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
  // Wait until every expectation is checked, then two quiet cycles.
  task automatic drain(input int max_cycles = 20);
    // TODO step 6
  endtask

  // The verdict: exactly one line, in a format a script can match.
  function automatic void report();
    // TODO step 6: count leftover expectations as failures, and fail a run
    // that checked nothing, before printing the line.
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
    // TODO step 6: make the run below, from reset_dut() to drain(), the first
    // branch of a fork; add a watchdog branch that ends a hung run with $fatal;
    // join with join_any and stop the branch still running with disable fork.
    reset_dut();
    if (test_name == "all") begin
      run_one("smoke");
      run_one("corners");
      run_one("gaps");
    end else begin
      run_one(test_name);
    end
    drain();
    report();
    $finish;
  end
endmodule
