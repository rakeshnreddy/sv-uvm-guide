module arbiter #(
  parameter NUM_REQUESTORS = 4,
  parameter ARBITRATION_SCHEME = "FIXED_PRIORITY" // or "ROUND_ROBIN"
) (
  input  logic                clk,
  input  logic                rst_n,
  input  logic [NUM_REQUESTORS-1:0] req,
  output logic [NUM_REQUESTORS-1:0] gnt
);

  if (ARBITRATION_SCHEME == "FIXED_PRIORITY") begin: fixed_priority
    always_comb begin
      gnt = '0;
      for (int i = 0; i < NUM_REQUESTORS; i++) begin
        if (req[i]) begin
          gnt[i] = 1'b1;
          break;
        end
      end
    end
  end else begin: round_robin
    // Index of the requester granted last; the search starts one past it, so every
    // requester waits at most NUM_REQUESTORS - 1 grants.
    localparam int IW = (NUM_REQUESTORS > 1) ? $clog2(NUM_REQUESTORS) : 1;
    logic [IW-1:0] last_idx;

    always_ff @(posedge clk or negedge rst_n) begin
      if (!rst_n) begin
        last_idx <= IW'(NUM_REQUESTORS - 1); // so requester 0 is checked first after reset
      end else begin
        for (int i = 0; i < NUM_REQUESTORS; i++) begin
          if (gnt[i]) last_idx <= IW'(i);    // gnt is one-hot or zero
        end
      end
    end

    always_comb begin
      gnt = '0;
      for (int i = 1; i <= NUM_REQUESTORS; i++) begin
        automatic int idx = (int'(last_idx) + i) % NUM_REQUESTORS;
        if (req[idx]) begin
          gnt[idx] = 1'b1;
          break;
        end
      end
    end
  end

endmodule
