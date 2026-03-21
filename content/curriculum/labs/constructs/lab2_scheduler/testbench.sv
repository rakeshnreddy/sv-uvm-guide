module pipeline_race;
  logic clk;
  logic [7:0] data_in;
  logic [7:0] stage1, stage2;

  // Clock generation
  initial begin
    clk = 0;
    forever #5 clk = ~clk;
  end

  // BUGGY PIPELINE: Uses blocking assignments for sequential logic!
  // This creates a race: if stage2 updates before stage1, it gets old data.
  // If stage1 updates before stage2, stage2 gets NEW data immediately (0-delay feedthrough).
  always @(posedge clk) begin
    stage1 = data_in; // Blocking!
  end

  always @(posedge clk) begin
    stage2 = stage1;  // Blocking! Race condition here.
  end

  // Stimulus
  initial begin
    data_in = 8'h00;
    #15; // Align away from clock edge slightly
    
    data_in = 8'hAA;
    @(posedge clk);
    $display("[%0t] Input driven: %h", $time, data_in);

    @(posedge clk);
    $display("[%0t] Stage1: %h | Stage2: %h", $time, stage1, stage2);
    
    @(posedge clk);
    $display("[%0t] Stage1: %h | Stage2: %h", $time, stage1, stage2);

    $finish;
  end

endmodule
