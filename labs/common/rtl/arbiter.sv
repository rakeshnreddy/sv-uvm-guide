```systemverilog
module arbiter #(
  parameter NUM_REQUESTERS = 4
) (
  input  logic                  clk,
  input  logic                  rst_n,
  input  logic [NUM_REQUESTERS-1:0] req,
  output logic [NUM_REQUESTERS-1:0] gnt
);

  // Round-robin arbitration
  logic [NUM_REQUESTERS-1:0] priority;

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      priority <= '1;
    end else if (|gnt) begin
      priority <= {gnt[NUM_REQUESTERS-2:0], gnt[NUM_REQUESTERS-1]};
    end
  end

  always_comb begin
    gnt = '0;
    for (int i = 0; i < NUM_REQUESTERS; i++) begin
      if (req[i] && priority[i]) begin
        gnt[i] = 1'b1;
        break;
      end
    end
    if (!|gnt) begin
      for (int i = 0; i < NUM_REQUESTERS; i++) begin
        if (req[i]) begin
          gnt[i] = 1'b1;
          break;
        end
      end
    end
  end

endmodule
```
