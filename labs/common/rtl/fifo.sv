```systemverilog
//
// Design: AXI-S FIFO
//
//
// Description:
// A simple First-In, First-Out (FIFO) buffer with parameterizable data width and depth.
// This FIFO is designed with a standard synchronous interface.
//
// Parameters:
// - DATA_WIDTH: Width of the data bus.
// - DEPTH: Number of entries in the FIFO.
//
// Ports:
// - clk: Clock
// - rst_n: Asynchronous reset, active low
// - wr_en: Write enable
// - wr_data: Write data
// - rd_en: Read enable
// - rd_data: Read data
// - full: FIFO full signal
// - empty: FIFO empty signal
//

module fifo #(
    parameter DATA_WIDTH = 32,
    parameter DEPTH      = 16
) (
    input  logic                  clk,
    input  logic                  rst_n,

    // Write Interface
    input  logic                  wr_en,
    input  logic [DATA_WIDTH-1:0] wr_data,

    // Read Interface
    input  logic                  rd_en,
    output logic [DATA_WIDTH-1:0] rd_data,

    // Status Signals
    output logic                  full,
    output logic                  empty
);

    // Calculate address width based on DEPTH
    localparam ADDR_WIDTH = $clog2(DEPTH);

    // FIFO memory array
    logic [DATA_WIDTH-1:0] mem [DEPTH-1:0];

    // Write and read pointers
    logic [ADDR_WIDTH-1:0] wr_ptr;
    logic [ADDR_WIDTH-1:0] rd_ptr;

    // FIFO counter to track number of elements
    logic [ADDR_WIDTH:0]   count;

    // Empty and Full conditions
    assign empty = (count == 0);
    assign full  = (count == DEPTH);

    // Write logic
    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            wr_ptr <= '0;
        end else if (wr_en && !full) begin
            mem[wr_ptr] <= wr_data;
            wr_ptr      <= wr_ptr + 1;
        end
    end

    // Read logic
    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            rd_ptr <= '0;
        end else if (rd_en && !empty) begin
            rd_ptr <= rd_ptr + 1;
        end
    end

    // Read data output
    assign rd_data = mem[rd_ptr];

    // Counter logic
    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= '0;
        end else begin
            case ({wr_en && !full, rd_en && !empty})
                2'b10: count <= count + 1; // Write, no read
                2'b01: count <= count - 1; // Read, no write
                2'b11: count <= count;     // Write and read, count remains the same
                default: count <= count;
            endcase
        end
    end

endmodule
```
