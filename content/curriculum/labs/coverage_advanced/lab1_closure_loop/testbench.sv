program test;
  initial begin
    alu_cov_mon monitor;
    bit [7:0] a, b;
    op_t op;

    monitor = new();
    $display("--- Starting Coverage Loop Test ---");

    repeat (500) begin
      // This generation does not reach 100% coverage.
      // FIX ME:
      // 1. DIV is missing from the 'inside' list below (step 2).
      // 2. a and b are uniform, so 0 and 8'hFF each appear about once in
      //    256 samples. Add 'dist' constraints that weight BOTH edge values
      //    (step 3): the cross needs every op with a == 0 AND with a == 8'hFF.

      if (!std::randomize(a, b, op) with {
            // The previous engineer left a bug where DIV is never generated
            op inside { ADD, SUB, MUL, AND, OR, XOR };
          })
        $fatal(1, "std::randomize failed");

      monitor.sample(a, b, op);
    end

    $display("Final ALU Coverage: %0.2f%%", monitor.get_score());
    if (monitor.get_score() == 100.0)
      $display("SUCCESS: Coverage Closed!");
    else
      $display("FAILURE: Coverage holes remain.");
  end
endprogram
