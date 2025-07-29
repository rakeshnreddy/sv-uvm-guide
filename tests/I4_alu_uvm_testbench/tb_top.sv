module tb_top;
  logic clk = 0;
  always #5 clk = ~clk;

  alu_if vif(clk);
  alu dut(.alu_port(vif.DUT));

  initial begin
    uvm_config_db#(virtual alu_if)::set(null, "uvm_test_top.env.agent.drv", "vif", vif);
    uvm_config_db#(virtual alu_if)::set(null, "uvm_test_top.env.agent.mon", "vif", vif);
    run_test("base_test");
  end
endmodule
