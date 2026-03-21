`timescale 1ns/1ps

module tb_counter_refactored;
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

  initial begin
    clk = 0;
    forever #5 clk = ~clk;
  end

  task automatic drive_sequence(
    input byte start_value,
    input int unsigned repeat_count,
    input byte step
  );
    byte payload = start_value;
    @(posedge clk);
    enable <= 1'b1;
    data   <= payload;
    for (int i = 0; i < repeat_count; i++) begin
      @(posedge clk);
      payload += step;
      data    <= payload;
    end
    enable <= 1'b0;
    @(posedge clk);
    $display("[Task] start=%0h step=%0h count=%0d", start_value, step, count);
  endtask

  initial begin
    rst_n  = 0;
    enable = 0;
    data   = '0;

    repeat (2) @(posedge clk);
    rst_n = 1;
    repeat (2) @(posedge clk);

    // Scenario 1: three quick bursts starting at 0x01
    drive_sequence(8'h01, 3, 8'h01);

    // Scenario 2: medium bursts starting at 0x10
    drive_sequence(8'h10, 5, 8'h02);

    // Scenario 3: long burst starting at 0x20
    drive_sequence(8'h20, 8, 8'h03);

    $finish;
  end
endmodule
