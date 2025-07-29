module alu(
  input [7:0] a,
  input [7:0] b,
  input [3:0] op,
  output logic [7:0] result,
  input start,
  output logic done
);

  always @(posedge start) begin
    case (op)
      0: result <= a + b;
      1: result <= a - b;
      2: result <= a * b;
      default: result <= 'x;
    endcase
    done <= 1;
  end

endmodule
