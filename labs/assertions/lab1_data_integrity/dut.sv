module dut (
  input  logic        clk,
  input  logic        rst_n,
  
  // Input interface
  input  logic        in_vld,
  input  logic [31:0] in_data,
  output logic        in_rdy,
  
  // Output interface
  output logic        out_vld,
  output logic [31:0] out_data,
  input  logic        out_rdy
);

  // A simple 4-stage pipeline that is supposed to pass data through.
  // BUG: It occasionally corrupts data if a stall happens in stage 2.
  
  logic [31:0] pipe_data [0:3];
  logic        pipe_vld  [0:3];
  
  assign in_rdy = !pipe_vld[0] || (out_rdy && !pipe_vld[1] && !pipe_vld[2] && !pipe_vld[3]);
  assign out_vld = pipe_vld[3];
  assign out_data = pipe_data[3];

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      for (int i=0; i<4; i++) begin
        pipe_vld[i] <= 1'b0;
        pipe_data[i] <= '0;
      end
    end else begin
      // Stage 0
      if (in_vld && in_rdy) begin
        pipe_vld[0]  <= 1'b1;
        pipe_data[0] <= in_data;
      end else if (!pipe_vld[1]) begin
        pipe_vld[0]  <= 1'b0;
      end
      
      // Stage 1
      if (pipe_vld[0]) begin
        pipe_vld[1]  <= 1'b1;
        pipe_data[1] <= pipe_data[0];
      end else if (!pipe_vld[2]) begin
        pipe_vld[1]  <= 1'b0;
      end

      // Stage 2
      if (pipe_vld[1]) begin
        pipe_vld[2]  <= 1'b1;
        // BUG: Occasionally corrupt the data when stalled!
        if (out_rdy == 1'b0 && pipe_vld[2]) begin
           pipe_data[2] <= pipe_data[1] ^ 32'hDEADBEEF; // Corruption!
        end else begin
           pipe_data[2] <= pipe_data[1];
        end
      end else if (!pipe_vld[3]) begin
        pipe_vld[2]  <= 1'b0;
      end

      // Stage 3
      if (pipe_vld[2]) begin
        pipe_vld[3]  <= 1'b1;
        pipe_data[3] <= pipe_data[2];
      end else if (out_rdy) begin
        pipe_vld[3]  <= 1'b0;
      end
    end
  end

endmodule
