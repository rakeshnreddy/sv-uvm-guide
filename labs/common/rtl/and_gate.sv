// A simple 2-input AND gate DUT
module and_gate (
  input  logic a,
  input  logic b,
  output logic y
);

  // Combinational logic for the AND function
  assign y = a & b;

endmodule
