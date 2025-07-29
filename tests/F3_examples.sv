// Test file for F3_Behavioral_RTL_Modeling examples

module initial_example;
  logic reset;
  initial begin
    reset = 1;
    #20; // Wait for 20 time units
    reset = 0;
    $display("Reset released at time %0t", $time);
  end
endmodule

module mux_2_to_1 (
  input  logic [7:0] a, b,
  input  logic       sel,
  output logic [7:0] y
);

  always_comb begin
    if (sel == 0) begin
      y = a;
    end else begin
      y = b;
    end
  end

endmodule

module d_ff (
  input  logic       clk,
  input  logic       reset,
  input  logic       d,
  output logic       q
);

  always_ff @(posedge clk or posedge reset) begin
    if (reset)
      q <= 1'b0;
    else
      q <= d;
  end

endmodule

module counter (
  input  logic       clk,
  input  logic       reset,
  output logic [3:0] count
);

  always_ff @(posedge clk or posedge reset) begin
    if (reset)
      count <= 4'b0;
    else
      count <= count + 1;
  end

endmodule

module sequence_detector (
  input  logic clk,
  input  logic reset,
  input  logic din,
  output logic detected
);

  // 1. Define the states using an enumerated type
  typedef enum { S_IDLE, S_GOT_1, S_GOT_10 } state_t;
  state_t current_state, next_state;

  // 2. State Register: The sequential part
  // This holds the FSM's current state and only changes on a clock edge.
  always_ff @(posedge clk or posedge reset) begin
    if (reset)
      current_state <= S_IDLE;
    else
      current_state <= next_state;
  end

  // 3. Next State Logic: The combinational part
  // This determines the next state based on the current state and inputs.
  always_comb begin
    next_state = current_state; // Default: stay in the same state
    case (current_state)
      S_IDLE:
        if (din == 1) next_state = S_GOT_1;
      S_GOT_1:
        if (din == 0) next_state = S_GOT_10;
        else          next_state = S_GOT_1; // Still got a 1
      S_GOT_10:
        if (din == 1) next_state = S_IDLE; // Sequence detected, reset
        else          next_state = S_IDLE; // Sequence broken
    endcase
  end

  // 4. Output Logic: The combinational part for the output
  // This is a Moore FSM if output depends only on state.
  // This is a Mealy FSM if output depends on state AND input.
  // Let's make it Mealy for this example.
  assign detected = (current_state == S_GOT_10) && (din == 1);

endmodule
