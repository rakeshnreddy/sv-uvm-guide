`ifndef ALU_IF_SV
`define ALU_IF_SV

interface alu_if (input bit clk);
  logic [7:0] a;
  logic [7:0] b;
  logic [3:0] op;
  logic start;
  logic done;
  logic [7:0] result;

  clocking driver_cb @(posedge clk);
    output a, b, op, start;
  endclocking

  clocking monitor_cb @(posedge clk);
    input a, b, op, start, done, result;
  endclocking

endinterface

`endif // ALU_IF_SV
