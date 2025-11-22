module pipeline_fixed;
  logic clk;
  logic [7:0] data_in;
  logic [7:0] stage1, stage2;

  // Clock generation
  initial begin
    clk = 0;
    forever #5 clk = ~clk;
  end

  // FIXED PIPELINE: Uses Non-Blocking assignments (<=)
  // This ensures all reads happen before any writes in the NBA region.
  // Order of execution no longer matters.
  always_ff @(posedge clk) begin
    stage1 <= data_in; 
  end

  always_ff @(posedge clk) begin
    stage2 <= stage1;
  end

  // Stimulus
  initial begin
    data_in = 8'h00;
    // Good practice: Initialize inputs
    #12; 
    
    data_in = 8'hAA;
    @(posedge clk); 
    $display("[%0t] Input driven: %h", $time, data_in);

    // Wait for pipeline depth
    repeat(3) @(posedge clk) begin
        $display("[%0t] Stage1: %h | Stage2: %h", $time, stage1, stage2);
    end

    $finish;
  end

endmodule
