program test;
  initial begin
    alu_cov_mon monitor = new();
    
    bit [7:0] a, b;
    op_t op;
    
    $display("--- Starting Coverage Loop Test ---");
    
    repeat(500) begin
      // This generic generation is not hitting 100% coverage!
      // FIX ME: Use 'std::randomize(a, b, op) with' to:
      // 1. Ensure op uses a 'dist' to hit DIV (which might be rare or excluded by a typo below).
      // 2. Ensure a and b have a reasonable chance to hit 8'hFF (max value).
      
      void'(std::randomize(a, b, op) with {
        // The previous engineer left a bug where DIV is never generated
        op inside { ADD, SUB, MUL, AND, OR, XOR };
        
        // No distribution on 'a' and 'b', making 8'hFF very rare
      });
      
      monitor.sample(a, b, op);
    end
    
    $display("Final ALU Coverage: %0.2f%%", monitor.get_score());
    if (monitor.get_score() == 100.0)
      $display("SUCCESS: Coverage Closed!");
    else
      $display("FAILURE: Coverage holes remain.");
  end
endprogram
