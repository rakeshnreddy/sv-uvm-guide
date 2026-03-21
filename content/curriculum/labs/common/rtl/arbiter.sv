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
    logic [NUM_REQUESTORS-1:0] last_gnt;

    always_ff @(posedge clk or negedge rst_n) begin
      if (!rst_n) begin
        last_gnt <= '1; // Start with lowest priority
      end else if (|gnt) begin
        last_gnt <= gnt;
      end
    end

    always_comb begin
      gnt = '0;
      for (int i = 0; i < NUM_REQUESTORS; i++) begin
        int priority = (i + $clog2(NUM_REQUESTORS)'(last_gnt)) % NUM_REQUESTORS;
        if (req[priority]) begin
          gnt[priority] = 1'b1;
          break;
        end
      end
    end
  end

endmodule
