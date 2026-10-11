// tb_top.sv: stimulus, the ALU-5 and ALU-6 checks, and the coverage report.
// Run with +SEED=<n> (default 1). The same seed replays the same stimulus.
module tb_top;
  timeunit 1ns;
  timeprecision 1ns;
  import alu_pkg::*;

  localparam int BUDGET = 500;  // transactions per seed

  op_t        op;
  logic [7:0] a, b, y;

  alu dut (.op(op), .a(a), .b(b), .y(y));

  initial begin
    alu_txn t;
    alu_cov cov;
    process p;
    int     seed;
    int     n_pass, n_fail, n_illegal;
    real    total;

    // Seed this thread's random generator from +SEED. Every alu_txn object is
    // seeded from this thread when it is created (IEEE 1800-2023 18.14.1).
    seed = 1;
    void'($value$plusargs("SEED=%d", seed));
    p = process::self();
    p.srandom(seed);

    cov = new("tb_top.cov");

    repeat (BUDGET) begin
      t = new();
      if (!t.randomize()) $fatal(1, "alu_txn randomize() failed");

      // The ALU is combinational and has no clock: drive, wait 1 ns, compare.
      op <= t.op;
      a  <= t.a;
      b  <= t.b;
      #1;

      if (t.op == DIV && t.b == 8'h00) begin
        // ALU-5: the generator sent an input the spec forbids.
        n_illegal++;
        $error("ALU-5 forbidden input generated: DIV with b == 0");
      end else if (y !== alu_model(t.op, t.a, t.b)) begin
        // ALU-6: the result does not match the reference model.
        n_fail++;
        $error("ALU-6 mismatch: %s a=%0h b=%0h y=%0h", t.op.name(), t.a, t.b, y);
      end else begin
        n_pass++;
      end

      cov.write(t);  // one sample per transaction, after its check
    end

    cov.report();
    total = cov.cg.get_inst_coverage();
    $display("COV_SUMMARY seed=%0d items=%0d total=%0.2f PASS=%0d FAIL=%0d ILLEGAL=%0d",
             seed, BUDGET, total, n_pass, n_fail, n_illegal);
    if (n_fail == 0 && n_illegal == 0 && total >= cov.cg.option.goal)
      $display("LAB RESULT: CLOSED");
    else
      $display("LAB RESULT: OPEN");
    $finish;
  end
endmodule
