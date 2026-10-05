`timescale 1ns/1ps

// Reference solution for lab basics-1.
// Compile it together with work/dut_counter.sv; the top module is tb_counter_refactored.
module tb_counter_refactored;
  logic       clk;
  logic       rst_n;
  logic       enable;
  logic [7:0] data;
  logic [7:0] count;

  logic [7:0] exp_count;     // reference model of the DUT's 8-bit accumulator
  int         n_pass;
  int         n_fail;

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

  // What the DUT adds during one burst: start_value, start_value + step, ...
  // (repeat_count values), wrapped to 8 bits like count.
  function automatic logic [7:0] burst_sum(input logic [7:0]  acc,
                                           input byte         start_value,
                                           input int unsigned repeat_count,
                                           input byte         step);
    for (int unsigned k = 0; k < repeat_count; k++)
      acc += start_value + k * step;
    return acc;
  endfunction

  // One burst. Every drive uses <=, so the DUT's always_ff samples the values
  // from before the edge, whichever process the simulator runs first.
  task automatic drive_sequence(input byte         start_value,
                                input int unsigned repeat_count,
                                input byte         step = 8'h01);
    byte payload = start_value;   // legal only because the task is automatic
    @(posedge clk);
    enable <= 1'b1;
    data   <= payload;
    for (int unsigned i = 0; i < repeat_count; i++) begin
      @(posedge clk);
      payload += step;
      data    <= payload;
    end
    enable <= 1'b0;
    @(posedge clk);
    $display("[Task] start=%0h step=%0h count=%0d", start_value, step, count);

    // Check this burst against the reference model.
    exp_count = burst_sum(exp_count, start_value, repeat_count, step);
    if (count !== exp_count) begin
      n_fail++;
      $error("start=%0h: count=%0d, expected %0d", start_value, count, exp_count);
    end
    else n_pass++;
  endtask

  initial begin
    rst_n     = 1'b0;
    enable    = 1'b0;
    data      = '0;
    exp_count = '0;            // count after reset

    repeat (2) @(posedge clk);
    rst_n <= 1'b1;             // release with <=, like every drive at a clock edge
    repeat (2) @(posedge clk);

    // Scenario 1: three quick bursts starting at 0x01 (default step of 1)
    drive_sequence(8'h01, 3);

    // Scenario 2: medium bursts starting at 0x10 (all arguments by position)
    drive_sequence(8'h10, 5, 8'h02);

    // Scenario 3: long burst starting at 0x20 (arguments bound by name)
    drive_sequence(.start_value(8'h20), .repeat_count(8), .step(8'h03));

    $display("PASS=%0d FAIL=%0d", n_pass, n_fail);
    $finish;
  end
endmodule
