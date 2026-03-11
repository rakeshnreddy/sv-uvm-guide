typedef enum bit [2:0] { ADD=0, SUB=1, MUL=2, DIV=3, AND=4, OR=5, XOR=6 } op_t;

class alu_cov_mon;
  bit [7:0] a, b;
  op_t op;

  covergroup cg_alu;
    // We want to see every operation
    cp_op: coverpoint op {
      ignore_bins unused = { 7 }; // 3-bit enum, 7 is unused
    }
    
    // We want to see edge cases on inputs
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
    
    // Cross to ensure we do a MAX calculation
    cross_max_op: cross cp_op, cp_a;
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

  function real get_score();
    return cg_alu.get_inst_coverage();
  endfunction

endclass
