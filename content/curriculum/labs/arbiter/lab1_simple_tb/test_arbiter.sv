// A minimal, non-UVM testbench for the round-robin bus arbiter DUT.
module test_arbiter;

  parameter int NUM_REQUESTORS = 4;

  logic                      clk = 1'b0;
  logic                      rst_n;
  logic [NUM_REQUESTORS-1:0] req;
  logic [NUM_REQUESTORS-1:0] gnt;

  arbiter #(
    .NUM_REQUESTORS(NUM_REQUESTORS),
    .ARBITRATION_SCHEME("ROUND_ROBIN")
  ) dut (
    .clk(clk),
    .rst_n(rst_n),
    .req(req),
    .gnt(gnt)
  );

  // Clock generation: rising edges at 5, 15, 25 ns ...
  always #5 clk = ~clk;

  // Check gnt mid-cycle, after the last rising edge has moved the arbiter's pointer.
  task automatic expect_gnt(input logic [NUM_REQUESTORS-1:0] exp, input string what);
    @(negedge clk);
    assert (gnt === exp) else $error("%s: gnt=%b, expected %b", what, gnt, exp);
  endtask

  // Test sequence
  initial begin
    rst_n = 1'b0;
    req   = '0;
    repeat (2) @(posedge clk);
    rst_n <= 1'b1;

    req <= 4'b0001;
    expect_gnt(4'b0001, "a lone request is granted");

    req <= 4'b1111;                    // everyone requests: the grant rotates
    expect_gnt(4'b0010, "the search starts one past the last winner, 0");
    expect_gnt(4'b0100, "then requester 2");
    expect_gnt(4'b1000, "then requester 3");
    expect_gnt(4'b0001, "then it wraps to requester 0");

    req <= 4'b0101;                    // only 0 and 2 request: they alternate
    expect_gnt(4'b0100, "requester 2, the next requester after 0");
    expect_gnt(4'b0001, "then requester 0 again");

    $display("test_arbiter done");
    $finish;
  end

endmodule
