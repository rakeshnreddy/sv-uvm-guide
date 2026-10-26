// alu_closure_solution.sv: reference solution for the I-SV-3B closure-loop lab.
// One self-contained file (package, DUT, testbench). Top level: tb_top.
// The only changes from the starter are in class alu_txn: see "FIX" below.
package alu_pkg;
  timeunit 1ns;      // every design element in the file declares the same
  timeprecision 1ns; // time unit and precision (IEEE 1800-2023 §3.14.2.3)
  typedef enum bit [2:0] {ADD, SUB, MUL, DIV, AND, OR, XOR} op_t;

  function automatic bit [7:0] alu_model(op_t op, bit [7:0] a, bit [7:0] b);
    case (op)
      ADD:     return a + b;
      SUB:     return a - b;
      MUL:     return a * b;
      DIV:     return a / b;
      AND:     return a & b;
      OR:      return a | b;
      default: return a ^ b;
    endcase
  endfunction

  class alu_txn;
    rand op_t      op;
    rand bit [7:0] a;
    rand bit [7:0] b;

    // FIX 1 (generator bug, ALU-1): DIV was missing, so it had probability 0.
    constraint c_ops { op inside {ADD, SUB, MUL, DIV, AND, OR, XOR}; }

    // FIX 2 (under-stimulated, ALU-2 to ALU-5): uniform inputs hit one edge
    // value once in 256 samples, so one op x edge cell had p = 1/1792. Weight
    // BOTH edge values of both inputs: P(0) = P(8'hFF) = 1/4 before c_spec.
    constraint c_edges {
      a dist {8'h00 := 1, 8'hFF := 1, [8'h01:8'hFE] :/ 2};
      b dist {8'h00 := 1, 8'hFF := 1, [8'h01:8'hFE] :/ 2};
    }

    // FIX 3 (forbidden, ALU-5): steering b toward 0 made DIV with b == 0
    // frequent. The spec forbids it, so the generator must never send it.
    // ignore_bins would hide it; the illegal cross bin stays as a second check.
    constraint c_spec { op == DIV -> b != 8'h00; }
  endclass

  class alu_cov;
    op_t      op;
    bit [7:0] a;
    bit [7:0] b;

    covergroup cg;
      option.per_instance = 1;
      option.cross_num_print_missing = 32;
      cp_op: coverpoint op {
        option.comment = "ALU-1";
        bins ops[] = {ADD, SUB, MUL, DIV, AND, OR, XOR};
      }
      cp_a: coverpoint a {
        option.comment = "ALU-2";
        bins zero = {8'h00};
        bins max  = {8'hFF};
      }
      cp_b: coverpoint b {
        option.comment = "ALU-3";
        bins zero = {8'h00};
        bins max  = {8'hFF};
      }
      x_op_a: cross cp_op, cp_a {
        option.comment = "ALU-4";
      }
      x_op_b: cross cp_op, cp_b {
        option.comment = "ALU-5";
        illegal_bins div_by_zero = binsof(cp_op) intersect {DIV} &&
                                   binsof(cp_b.zero);
      }
    endgroup

    function new(string name);
      cg = new();
      cg.set_inst_name(name);
    endfunction

    function void write(alu_txn t);
      op = t.op;
      a  = t.a;
      b  = t.b;
      cg.sample();
    endfunction

    function void report();
      int covered, total;
      void'(cg.cp_op.get_inst_coverage(covered, total));
      $display("COV %s cp_op %0d/%0d", cg.cp_op.option.comment, covered, total);
      void'(cg.cp_a.get_inst_coverage(covered, total));
      $display("COV %s cp_a %0d/%0d", cg.cp_a.option.comment, covered, total);
      void'(cg.cp_b.get_inst_coverage(covered, total));
      $display("COV %s cp_b %0d/%0d", cg.cp_b.option.comment, covered, total);
      void'(cg.x_op_a.get_inst_coverage(covered, total));
      $display("COV %s x_op_a %0d/%0d", cg.x_op_a.option.comment, covered, total);
      void'(cg.x_op_b.get_inst_coverage(covered, total));
      $display("COV %s x_op_b %0d/%0d", cg.x_op_b.option.comment, covered, total);
    endfunction
  endclass
endpackage

module alu
  import alu_pkg::*;
(
  input  op_t        op,
  input  logic [7:0] a,
  input  logic [7:0] b,
  output logic [7:0] y
);
  timeunit 1ns;
  timeprecision 1ns;
  always_comb begin
    case (op)
      ADD:     y = a + b;
      SUB:     y = a - b;
      MUL:     y = a * b;
      DIV:     y = a / b;
      AND:     y = a & b;
      OR:      y = a | b;
      default: y = a ^ b;
    endcase
  end
endmodule

module tb_top;
  timeunit 1ns;
  timeprecision 1ns;
  import alu_pkg::*;

  localparam int BUDGET = 500;

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

    seed = 1;
    void'($value$plusargs("SEED=%d", seed));
    p = process::self();
    p.srandom(seed);

    cov = new("tb_top.cov");

    repeat (BUDGET) begin
      t = new();
      if (!t.randomize()) $fatal(1, "alu_txn randomize() failed");
      op <= t.op;
      a  <= t.a;
      b  <= t.b;
      #1;
      if (t.op == DIV && t.b == 8'h00) begin
        n_illegal++;
        $error("ALU-5 forbidden input generated: DIV with b == 0");
      end else if (y !== alu_model(t.op, t.a, t.b)) begin
        n_fail++;
        $error("ALU-6 mismatch: %s a=%0h b=%0h y=%0h", t.op.name(), t.a, t.b, y);
      end else begin
        n_pass++;
      end
      cov.write(t);
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
