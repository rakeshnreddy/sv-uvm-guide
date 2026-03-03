// Solution for the Data Integrity Challenge
// We use a local variable to sample the data as it enters the pipeline
// and check that it matches the data when it exits the pipeline.

module solution_assertions (
  input logic        clk,
  input logic        rst_n,
  input logic        in_vld,
  input logic [31:0] in_data,
  input logic        in_rdy,
  input logic        out_vld,
  input logic [31:0] out_data,
  input logic        out_rdy
);

  // Property that checks data integrity across the pipeline
  property p_data_integrity;
    // Local variable to store the incoming data
    logic [31:0] local_data;
    
    @(posedge clk) disable iff (!rst_n)
      // When a valid transaction is accepted, store the data
      (in_vld && in_rdy, local_data = in_data)
      
      // Implication: Once accepted, it must eventually exit the pipeline
      |->
      
      // s_eventually requires that a sequence eventually matches
      s_eventually (
        // When it exits, the data must match what we stored
        out_vld && out_rdy && (out_data == local_data)
      );
  endproperty

  // Assert the property
  a_data_integrity: assert property (p_data_integrity)
    else $error("Data Corruption Detected! Expected: %h, Actual: %h", 
                p_data_integrity.local_data, out_data); // Note: local vars aren't easily printable in all tools but we show intent
                
  // Cover the property to ensure it's hit
  c_data_integrity: cover property (p_data_integrity);

endmodule

// Bind the assertion module to the DUT
bind dut solution_assertions u_chk (
  .clk(clk),
  .rst_n(rst_n),
  .in_vld(in_vld),
  .in_data(in_data),
  .in_rdy(in_rdy),
  .out_vld(out_vld),
  .out_data(out_data),
  .out_rdy(out_rdy)
);
