// A minimal, non-UVM testbench for the FIFO DUT.
module test_fifo;

  parameter DATA_WIDTH = 32;
  parameter DEPTH      = 16;

  logic                  clk;
  logic                  rst_n;
  logic                  wr_en;
  logic [DATA_WIDTH-1:0] wr_data;
  logic                  rd_en;
  logic [DATA_WIDTH-1:0] rd_data;
  logic                  full;
  logic                  empty;

  fifo #(
    .DATA_WIDTH(DATA_WIDTH),
    .DEPTH(DEPTH)
  ) dut (
    .clk(clk),
    .rst_n(rst_n),
    .wr_en(wr_en),
    .wr_data(wr_data),
    .rd_en(rd_en),
    .rd_data(rd_data),
    .full(full),
    .empty(empty)
  );

  // Clock generation
  always #5 clk = ~clk;

  // Test sequence
  initial begin
    clk = 0;
    rst_n = 0;
    wr_en = 0;
    rd_en = 0;
    wr_data = 0;

    // Reset the DUT
    #10 rst_n = 1;

    // Write some data
    for (int i = 0; i < DEPTH; i++) begin
      wr_en = 1;
      wr_data = i;
      #10;
    end
    wr_en = 0;

    // Read some data
    for (int i = 0; i < DEPTH; i++) begin
      rd_en = 1;
      #10;
      assert(rd_data == i);
    end
    rd_en = 0;

    $finish;
  end

endmodule
