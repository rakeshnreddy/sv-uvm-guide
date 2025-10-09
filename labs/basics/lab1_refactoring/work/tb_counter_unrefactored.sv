`timescale 1ns/1ps

module tb_counter_unrefactored;
  logic clk;
  logic rst_n;
  logic enable;
  logic [7:0] data;
  logic [7:0] count;

  dut_counter dut (
    .clk   (clk),
    .rst_n (rst_n),
    .enable(enable),
    .data  (data),
    .count (count)
  );

  // Clock generation
  initial begin
    clk = 0;
    forever #5 clk = ~clk;
  end

  // Scenario driver (needs refactoring!)
  initial begin
    rst_n  = 0;
    enable = 0;
    data   = '0;

    repeat (2) @(posedge clk);
    rst_n = 1;
    repeat (2) @(posedge clk);

    // Scenario 1: three quick bursts starting at 0x01
    @(posedge clk);
    enable = 1;
    data   = 8'h01;
    repeat (3) begin
      @(posedge clk);
      data <= data + 1;
    end
    enable = 0;
    @(posedge clk);
    $display("[Scenario 1] count=%0d", count);

    // Scenario 2: medium bursts starting at 0x10
    @(posedge clk);
    enable = 1;
    data   = 8'h10;
    repeat (5) begin
      @(posedge clk);
      data <= data + 2;
    end
    enable = 0;
    @(posedge clk);
    $display("[Scenario 2] count=%0d", count);

    // Scenario 3: long burst starting at 0x20
    @(posedge clk);
    enable = 1;
    data   = 8'h20;
    repeat (8) begin
      @(posedge clk);
      data <= data + 3;
    end
    enable = 0;
    @(posedge clk);
    $display("[Scenario 3] count=%0d", count);

    $finish;
  end
endmodule
