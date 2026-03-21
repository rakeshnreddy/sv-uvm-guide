module testbench;

  logic        clk;
  logic        rst_n;
  
  logic        in_vld;
  logic [31:0] in_data;
  logic        in_rdy;
  
  logic        out_vld;
  logic [31:0] out_data;
  logic        out_rdy;

  dut u_dut (
    .clk(clk),
    .rst_n(rst_n),
    .in_vld(in_vld),
    .in_data(in_data),
    .in_rdy(in_rdy),
    .out_vld(out_vld),
    .out_data(out_data),
    .out_rdy(out_rdy)
  );

  // Clock generation
  initial begin
    clk = 0;
    forever #5 clk = ~clk;
  end

  // Test stimulus
  initial begin
    rst_n = 0;
    in_vld = 0;
    in_data = 0;
    out_rdy = 1;

    #20 rst_n = 1;

    // Send a burst of data
    for (int i = 0; i < 10; i++) begin
      @(posedge clk);
      wait(in_rdy);
      in_vld <= 1;
      in_data <= i * 32'h1000;
      
      // Randomly toggle out_rdy to cause stalls and trigger the bug
      if (i == 5 || i == 7) begin
         out_rdy <= 0;
      end else begin
         out_rdy <= 1;
      end
    end
    
    @(posedge clk);
    in_vld <= 0;

    // Wait for pipeline to drain
    repeat(10) @(posedge clk);
    out_rdy <= 1;
    repeat(10) @(posedge clk);

    $display("Simulation Finished.");
    $finish;
  end

endmodule
