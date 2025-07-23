```systemverilog
//
// Design: Bus Arbiter
//
//
// Description:
// A simple bus arbiter that grants access to a shared resource for a configurable
// number of requestors. This arbiter can be configured for either a fixed-priority
// or a round-robin arbitration scheme.
//
// Parameters:
// - NUM_REQUESTERS: The number of masters requesting access.
// - ARB_SCHEME: Arbitration scheme. 0 for fixed-priority, 1 for round-robin.
//
// Ports:
// - clk: Clock
// - rst_n: Asynchronous reset, active low
// - req: Request signals from each master
// - gnt: Grant signals to each master
//

module arbiter #(
    parameter NUM_REQUESTERS = 4,
    parameter ARB_SCHEME     = 1 // 0 = Fixed Priority, 1 = Round Robin
) (
    input  logic                    clk,
    input  logic                    rst_n,
    input  logic [NUM_REQUESTERS-1:0] req,
    output logic [NUM_REQUESTERS-1:0] gnt
);

    // Internal grant logic
    logic [NUM_REQUESTERS-1:0] gnt_internal;

    // Fixed-priority arbitration
    generate
        if (ARB_SCHEME == 0) begin : fixed_priority_arb
            always_comb begin
                gnt_internal = '0;
                for (int i = NUM_REQUESTERS - 1; i >= 0; i--) begin
                    if (req[i]) begin
                        gnt_internal[i] = 1'b1;
                    end
                end
            end
        end
    endgenerate

    // Round-robin arbitration
    generate
        if (ARB_SCHEME == 1) begin : round_robin_arb
            logic [NUM_REQUESTERS-1:0] priority;

            always_ff @(posedge clk or negedge rst_n) begin
                if (!rst_n) begin
                    priority <= '1; // Initial priority to requestor 0
                end else if (|gnt_internal) begin
                    // Shift priority to the next requestor
                    priority <= {gnt_internal[NUM_REQUESTERS-2:0], gnt_internal[NUM_REQUESTERS-1]};
                end
            end

            always_comb begin
                gnt_internal = '0;
                for (int i = 0; i < NUM_REQUESTERS; i++) begin
                    int current_req = (i + priority) % NUM_REQUESTERS;
                    if (req[current_req]) begin
                        gnt_internal[current_req] = 1'b1;
                        break; // Grant to the first requesting master in priority order
                    end
                end
            end
        end
    endgenerate

    // Registered grant output
    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            gnt <= '0;
        end else begin
            gnt <= gnt_internal;
        end
    end

endmodule
```
