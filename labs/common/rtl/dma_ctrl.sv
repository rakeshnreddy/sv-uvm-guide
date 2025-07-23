```systemverilog
//
// Design: Simple DMA Controller
//
//
// Description:
// A simple multi-channel Direct Memory Access (DMA) controller.
// This DMA features a bus-functional interface for programming control registers
// (source address, destination address, transfer length) for multiple channels.
//
// Parameters:
// - NUM_CHANNELS: Number of DMA channels.
// - ADDR_WIDTH: Width of the address bus.
// - DATA_WIDTH: Width of the data bus.
//
// Ports:
// - clk: Clock
// - rst_n: Asynchronous reset, active low
//
// Control Interface (simplified for this example)
// - ctrl_addr: Address for accessing control registers
// - ctrl_wr_en: Write enable for control registers
// - ctrl_wr_data: Write data for control registers
// - ctrl_rd_en: Read enable for control registers
// - ctrl_rd_data: Read data from control registers
//
// Memory Interface (conceptual)
// - mem_rd_addr: Memory read address
// - mem_rd_data: Memory read data
// - mem_wr_addr: Memory write address
// - mem_wr_data: Memory write data
// - mem_wr_en: Memory write enable
//

module dma_ctrl #(
    parameter NUM_CHANNELS = 4,
    parameter ADDR_WIDTH   = 32,
    parameter DATA_WIDTH   = 32
) (
    input  logic                  clk,
    input  logic                  rst_n,

    // Control Register Interface
    input  logic [7:0]              ctrl_addr,
    input  logic                  ctrl_wr_en,
    input  logic [DATA_WIDTH-1:0] ctrl_wr_data,
    input  logic                  ctrl_rd_en,
    output logic [DATA_WIDTH-1:0] ctrl_rd_data,

    // Memory-facing Interface (conceptual - behavior is modeled)
    output logic [ADDR_WIDTH-1:0] mem_rd_addr,
    input  logic [DATA_WIDTH-1:0] mem_rd_data,
    output logic [ADDR_WIDTH-1:0] mem_wr_addr,
    output logic [DATA_WIDTH-1:0] mem_wr_data,
    output logic                  mem_wr_en
);

    // Register structure for each channel
    typedef struct packed {
        logic [ADDR_WIDTH-1:0] src_addr;
        logic [ADDR_WIDTH-1:0] dest_addr;
        logic [15:0]           length;
        logic                  start;
        logic                  done;
    } dma_channel_t;

    // Array of channels
    dma_channel_t channels [NUM_CHANNELS];

    // Control Register Access
    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            for (int i = 0; i < NUM_CHANNELS; i++) begin
                channels[i] <= '0;
            end
        end else if (ctrl_wr_en) begin
            // Simplified register map:
            // 0x00 - 0x0F: Channel 0 regs (src, dest, len, ctrl)
            // 0x10 - 0x1F: Channel 1 regs
            // ...
            int channel_idx = ctrl_addr[7:4];
            int reg_offset  = ctrl_addr[3:0];

            if (channel_idx < NUM_CHANNELS) begin
                case (reg_offset)
                    'h0: channels[channel_idx].src_addr  <= ctrl_wr_data;
                    'h4: channels[channel_idx].dest_addr <= ctrl_wr_data;
                    'h8: channels[channel_idx].length    <= ctrl_wr_data[15:0];
                    'hC: channels[channel_idx].start     <= ctrl_wr_data[0];
                    default:;
                endcase
            end
        end
    end

    // DMA Transfer Logic (conceptual FSM for one channel for simplicity)
    // A real implementation would have parallel FSMs for each channel.
    typedef enum logic [1:0] {IDLE, READ_MEM, WRITE_MEM} dma_state_t;
    dma_state_t state;
    logic [15:0] transfer_count;
    int current_channel;

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= IDLE;
            mem_wr_en <= 1'b0;
            transfer_count <= '0;
        end else begin
            case (state)
                IDLE: begin
                    // Find a channel that needs to start
                    for (int i = 0; i < NUM_CHANNELS; i++) begin
                        if (channels[i].start) begin
                            state <= READ_MEM;
                            current_channel <= i;
                            transfer_count <= 0;
                            channels[i].start <= 1'b0; // Clear start bit
                            channels[i].done <= 1'b0;
                            break;
                        end
                    end
                end

                READ_MEM: begin
                    // For simplicity, assume read takes 1 cycle
                    mem_rd_addr <= channels[current_channel].src_addr + transfer_count;
                    state <= WRITE_MEM;
                end

                WRITE_MEM: begin
                    mem_wr_addr <= channels[current_channel].dest_addr + transfer_count;
                    mem_wr_data <= mem_rd_data; // Data from previous cycle's read
                    mem_wr_en   <= 1'b1;
                    state <= (transfer_count == channels[current_channel].length - 1) ? IDLE : READ_MEM;

                    if (transfer_count == channels[current_channel].length - 1) begin
                        channels[current_channel].done <= 1'b1;
                    end
                    transfer_count <= transfer_count + 1;
                end
                default: state <= IDLE;
            endcase
            if (state != WRITE_MEM) begin
              mem_wr_en <= 1'b0;
            end
        end
    end

    // Control Register Read Logic
    // Simplified, non-combinatorial for ease of understanding
    always_ff @(posedge clk) begin
        if (ctrl_rd_en) begin
            int channel_idx = ctrl_addr[7:4];
            int reg_offset  = ctrl_addr[3:0];
            if (channel_idx < NUM_CHANNELS) begin
                case (reg_offset)
                    'h0: ctrl_rd_data <= channels[channel_idx].src_addr;
                    'h4: ctrl_rd_data <= channels[channel_idx].dest_addr;
                    'h8: ctrl_rd_data <= {16'b0, channels[channel_idx].length};
                    'hC: ctrl_rd_data <= {31'b0, channels[channel_idx].done};
                    default: ctrl_rd_data <= 'x;
                endcase
            end else begin
                ctrl_rd_data <= 'x;
            end
        end
    end

endmodule
```
