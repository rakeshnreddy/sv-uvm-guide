// alu_pkg.sv: types, reference model, stimulus class and coverage collector
// for the I-SV-3B closure-loop lab.
// Compile order: alu_pkg.sv, alu.sv, tb_top.sv. Top level: tb_top.
package alu_pkg;
  timeunit 1ns;      // all three files declare the same time unit and precision:
  timeprecision 1ns; // some set, some unset is an error (IEEE 1800-2023 §3.14.2.3)
  typedef enum bit [2:0] {ADD, SUB, MUL, DIV, AND, OR, XOR} op_t;

  // Reference model for plan row ALU-6: what the spec says y must be.
  // The spec forbids DIV with b == 0 (ALU-5), so the model never has to
  // define that result.
  function automatic bit [7:0] alu_model(op_t op, bit [7:0] a, bit [7:0] b);
    case (op)
      ADD:     return a + b;
      SUB:     return a - b;
      MUL:     return a * b;   // low byte of the product
      DIV:     return a / b;
      AND:     return a & b;
      OR:      return a | b;
      default: return a ^ b;   // XOR
    endcase
  endfunction

  // One ALU transaction. The constraints are the generator: they decide
  // which transactions can ever be produced, and how often.
  class alu_txn;
    rand op_t      op;
    rand bit [7:0] a;
    rand bit [7:0] b;

    constraint c_ops { op inside {ADD, SUB, MUL, AND, OR, XOR}; }
  endclass

  // Coverage collector: one covergroup, one plan ID per coverage item.
  // The plan IDs are read back by report(), so the log reads row by row.
  class alu_cov;
    op_t      op;
    bit [7:0] a;
    bit [7:0] b;

    covergroup cg;
      option.per_instance = 1;            // keep and report this instance
      option.cross_num_print_missing = 32; // tool reports list empty cells

      // ALU-1: every operation. Explicit bins: one per operation.
      cp_op: coverpoint op {
        option.comment = "ALU-1";
        bins ops[] = {ADD, SUB, MUL, DIV, AND, OR, XOR};
      }
      // ALU-2 and ALU-3: the edge values of each input. Other values fall
      // in no bin and are simply not counted.
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
      // ALU-4: every operation with each edge of a: 7 x 2 = 14 cells.
      x_op_a: cross cp_op, cp_a {
        option.comment = "ALU-4";
      }
      // ALU-5: every operation with each edge of b, except DIV with b == 0,
      // which the spec forbids: 14 - 1 = 13 cells that count. Sampling the
      // forbidden cell raises a run-time error (IEEE 1800-2023 19.6.3).
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

    // Called once per transaction, after the transaction has been checked.
    function void write(alu_txn t);
      op = t.op;
      a  = t.a;
      b  = t.b;
      cg.sample();
    endfunction

    // One line per plan row: COV <plan-id> <item> <covered>/<total>.
    // On a coverpoint or cross, get_inst_coverage(covered, total) returns
    // the true numerator and denominator of that item (19.8).
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
