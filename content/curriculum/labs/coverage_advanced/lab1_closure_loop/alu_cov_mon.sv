typedef enum bit [2:0] { ADD=0, SUB=1, MUL=2, DIV=3, AND=4, OR=5, XOR=6 } op_t;

class alu_cov_mon;
  bit [7:0] a, b;
  op_t op;

  covergroup cg_alu;
    option.per_instance = 1;

    // Every operation. An enum coverpoint gets one automatic bin per named
    // value (IEEE 1800-2023 19.5.3), so the unused code 7 has no bin.
    cp_op: coverpoint op;

    // Edge cases on the inputs. The 'others' default bin catches every other
    // value; default bins do not count toward coverage and are excluded from
    // crosses (IEEE 1800-2023 19.5). So cp_a and cp_b have 2 bins each.
    cp_a: coverpoint a {
      bins zero = {0};
      bins max  = {8'hFF};
      bins others = default;
    }
    cp_b: coverpoint b {
      bins zero = {0};
      bins max  = {8'hFF};
      bins others = default;
    }

    // Every operation with a == 0 and with a == 8'hFF: 7 x 2 = 14 cross bins.
    cross_edge_op: cross cp_op, cp_a;
  endgroup

  function new();
    cg_alu = new();
  endfunction

  function void sample(bit [7:0] in_a, bit [7:0] in_b, op_t in_op);
    a = in_a;
    b = in_b;
    op = in_op;
    cg_alu.sample();
  endfunction

  // Average of the four items (cp_op, cp_a, cp_b, cross_edge_op), weight 1 each.
  function real get_score();
    return cg_alu.get_inst_coverage();
  endfunction

endclass
