// A minimal, non-UVM testbench for the bus arbiter DUT.
module test_arbiter;

  parameter NUM_REQUESTORS = 4;

  logic                  clk;
  logic                  rst_n;
  logic [NUM_REQUESTORS-1:0] req;
  logic [NUM_REQUESTORS-1:0] gnt;

  arbiter #(
    .NUM_REQUESTORS(NUM_REQUESTORS)
  ) dut (
    .clk(clk),
    .rst_n(rst_n),
    .req(req),
    .gnt(gnt)
  );

  // Clock generation
  always #5 clk = ~clk;

  // Test sequence
  initial begin
    clk = 0;
    rst_n = 0;
    req = 0;

    // Reset the DUT
    #10 rst_n = 1;

    // Apply some requests
    req = 4'b0001;
    #10;
    assert(gnt == 4'b0001);

    req = 4'b0010;
    #10;
    assert(gnt == 4'b0010);

    req = 4'b0100;
    #10;
    assert(gnt == 4'b0100);

    req = 4'b1000;
    #10;
    assert(gnt == 4'b1000);

    req = 4'b1111;
    #10;
    assert(gnt == 4'b0001); // Fixed priority

    $finish;
  end

endmodule
