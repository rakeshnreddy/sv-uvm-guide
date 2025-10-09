module dut_counter (
  input  logic       clk,
  input  logic       rst_n,
  input  logic       enable,
  input  logic [7:0] data,
  output logic [7:0] count
);
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      count <= '0;
    end else if (enable) begin
      count <= count + data;
    end
  end
endmodule
