// A minimal, non-UVM testbench for the DMA controller DUT.
module test_dma;

  parameter NUM_CHANNELS = 4;

  logic                  clk;
  logic                  rst_n;
  logic [7:0]            bus_addr;
  logic                  bus_wr_en;
  logic [31:0]           bus_wr_data;
  logic [31:0]           bus_rd_data;
  logic [31:0]           mem_addr;
  logic                  mem_rd_en;
  logic [31:0]           mem_rd_data;
  logic                  mem_wr_en;
  logic [31:0]           mem_wr_data;

  dma_ctrl #(
    .NUM_CHANNELS(NUM_CHANNELS)
  ) dut (
    .clk(clk),
    .rst_n(rst_n),
    .bus_addr(bus_addr),
    .bus_wr_en(bus_wr_en),
    .bus_wr_data(bus_wr_data),
    .bus_rd_data(bus_rd_data),
    .mem_addr(mem_addr),
    .mem_rd_en(mem_rd_en),
    .mem_rd_data(mem_rd_data),
    .mem_wr_en(mem_wr_en),
    .mem_wr_data(mem_wr_data)
  );

  // Clock generation
  always #5 clk = ~clk;

  // Test sequence
  initial begin
    clk = 0;
    rst_n = 0;
    bus_addr = 0;
    bus_wr_en = 0;
    bus_wr_data = 0;

    // Reset the DUT
    #10 rst_n = 1;

    // Program a DMA transfer
    bus_wr_en = 1;
    bus_addr = 8'h00; // Source address
    bus_wr_data = 32'h1000;
    #10;
    bus_addr = 8'h04; // Destination address
    bus_wr_data = 32'h2000;
    #10;
    bus_addr = 8'h08; // Length
    bus_wr_data = 32'd16;
    #10;
    bus_addr = 8'h0C; // Enable
    bus_wr_data = 32'd1;
    #10;
    bus_wr_en = 0;

    // Wait for the transfer to complete
    // (In a real testbench, we would monitor the DUT for a completion signal)
    #200;

    $finish;
  end

endmodule
