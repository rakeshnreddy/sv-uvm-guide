// The bus the lab's agent drives and watches.
interface my_if (input logic clk);
  timeunit 1ns; timeprecision 1ps;
  logic [7:0] data;
  logic       valid;

  clocking driver_cb @(posedge clk);   // the driver's view: outputs
    output data, valid;
  endclocking

  clocking mon_cb @(posedge clk);      // the monitor's view: inputs sampled before the edge
    input data, valid;
  endclocking

  modport driver_mp (clocking driver_cb);
  modport mon_mp (clocking mon_cb);
endinterface
