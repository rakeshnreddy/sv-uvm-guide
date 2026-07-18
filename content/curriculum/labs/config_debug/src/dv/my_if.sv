interface my_if(input logic clk);
  logic [7:0] data;
  logic       valid;

  clocking driver_cb @(posedge clk);
    output data, valid;
  endclocking

  modport driver_mp(clocking driver_cb);
endinterface
