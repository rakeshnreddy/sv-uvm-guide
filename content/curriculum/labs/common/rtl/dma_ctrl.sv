module dma_ctrl #(
  parameter NUM_CHANNELS = 4
) (
  input  logic                  clk,
  input  logic                  rst_n,
  // Bus interface for programming
  input  logic [7:0]            bus_addr,
  input  logic                  bus_wr_en,
  input  logic [31:0]           bus_wr_data,
  output logic [31:0]           bus_rd_data,
  // Memory interface
  output logic [31:0]           mem_addr,
  output logic                  mem_rd_en,
  input  logic [31:0]           mem_rd_data,
  output logic                  mem_wr_en,
  output logic [31:0]           mem_wr_data
);

  // Registers for each channel
  logic [31:0] src_addr [NUM_CHANNELS];
  logic [31:0] dst_addr [NUM_CHANNELS];
  logic [31:0] length   [NUM_CHANNELS];
  logic        enable   [NUM_CHANNELS];

  // For simplicity, this is a very basic DMA controller.
  // A real DMA would have more complex state machines and arbitration.

  // Bus interface logic
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      for (int i = 0; i < NUM_CHANNELS; i++) begin
        src_addr[i] <= '0;
        dst_addr[i] <= '0;
        length[i]   <= '0;
        enable[i]   <= '0;
      end
    end else if (bus_wr_en) begin
      case (bus_addr)
        // Channel 0
        8'h00: src_addr[0] <= bus_wr_data;
        8'h04: dst_addr[0] <= bus_wr_data;
        8'h08: length[0]   <= bus_wr_data;
        8'h0C: enable[0]   <= bus_wr_data[0];
        // Other channels would be here
        default: ;
      endcase
    end
  end

  // This is a simplified read logic
  assign bus_rd_data = (bus_addr == 8'h0) ? src_addr[0] : 32'h0;

  // DMA transfer logic (simplified for one channel)
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      mem_wr_en <= 1'b0;
      mem_rd_en <= 1'b0;
    end else if (enable[0] && length[0] > 0) begin
      // In a real DMA, this would be a state machine
      mem_rd_en   <= 1'b1;
      mem_addr    <= src_addr[0];
      src_addr[0] <= src_addr[0] + 4; // Assuming 32-bit words

      // This is a simplification. A real DMA would have a separate read/write
      // state machine.
      mem_wr_en   <= 1'b1;
      mem_wr_data <= mem_rd_data;
      mem_addr    <= dst_addr[0];
      dst_addr[0] <= dst_addr[0] + 4;
      length[0]   <= length[0] - 1;
    end else begin
        mem_wr_en <= 1'b0;
        mem_rd_en <= 1'b0;
    end
  end

endmodule
