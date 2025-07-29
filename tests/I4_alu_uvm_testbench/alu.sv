module alu (alu_if.DUT alu_port);
  always_comb begin
    case (alu_port.opcode)
      ADD: alu_port.y = alu_port.a + alu_port.b;
      SUB: alu_port.y = alu_port.a - alu_port.b;
      default: alu_port.y = 'x;
    endcase
  end
endmodule
