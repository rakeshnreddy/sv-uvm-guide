// testbench.sv
`include "uvm_macros.svh"
import uvm_pkg::*;

interface axi_if(input bit ACLK);
  // AR Channel
  logic        ARVALID;
  logic        ARREADY;
  logic [31:0] ARADDR;
  logic [3:0]  ARID;
  
  // R Channel
  logic        RVALID;
  logic        RREADY;
  logic [31:0] RDATA;
  logic [3:0]  RID;
  logic        RLAST;
endinterface

`include "axi_monitor.sv"
`include "axi_scoreboard.sv"

class axi_env extends uvm_env;
  `uvm_component_utils(axi_env)

  axi_monitor mon;
  axi_scoreboard scb;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    mon = axi_monitor::type_id::create("mon", this);
    scb = axi_scoreboard::type_id::create("scb", this);
  endfunction

  function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    mon.ap.connect(scb.actual_export);
  endfunction
endclass

class test extends uvm_test;
  `uvm_component_utils(test)
  
  axi_env env;
  virtual axi_if vif;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    env = axi_env::type_id::create("env", this);
    if (!uvm_config_db#(virtual axi_if)::get(this, "", "vif", vif))
      `uvm_fatal("TEST", "No virtual interface")
  endfunction

  task run_phase(uvm_phase phase);
    axi_transaction exp1, exp2;
    phase.raise_objection(this);

    // Give scoreboard expected transactions
    exp1 = new("exp1"); exp1.id = 1; exp1.addr = 32'h1000; exp1.data = 32'hAAAA_BBBB; exp1.is_write = 0;
    exp2 = new("exp2"); exp2.id = 2; exp2.addr = 32'h2000; exp2.data = 32'hCCCC_DDDD; exp2.is_write = 0;
    
    env.scb.write_expected(exp1);
    env.scb.write_expected(exp2);

    // Drive AR Channel for ID 1 (Read A)
    vif.ARVALID <= 1; vif.ARID <= 1; vif.ARADDR <= 32'h1000;
    @(posedge vif.ACLK);
    vif.ARVALID <= 0;
    
    // Drive AR Channel for ID 2 (Read B)
    vif.ARVALID <= 1; vif.ARID <= 2; vif.ARADDR <= 32'h2000;
    @(posedge vif.ACLK);
    vif.ARVALID <= 0;

    // Simulate out-of-order response (ID 2 finishes first)
    repeat(2) @(posedge vif.ACLK);
    vif.RVALID <= 1; vif.RID <= 2; vif.RDATA <= 32'hCCCC_DDDD; vif.RLAST <= 1;
    @(posedge vif.ACLK);
    vif.RVALID <= 0; vif.RLAST <= 0;

    // Simulate ID 1 finishing later
    repeat(3) @(posedge vif.ACLK);
    vif.RVALID <= 1; vif.RID <= 1; vif.RDATA <= 32'hAAAA_BBBB; vif.RLAST <= 1;
    @(posedge vif.ACLK);
    vif.RVALID <= 0; vif.RLAST <= 0;

    repeat(2) @(posedge vif.ACLK);
    phase.drop_objection(this);
  endtask
endclass

module top;
  bit clk;
  always #5 clk = ~clk;

  axi_if vif(clk);

  // Default ready signals
  initial begin
    vif.ARREADY = 1;
    vif.RREADY = 1;
  end

  initial begin
    uvm_config_db#(virtual axi_if)::set(null, "uvm_test_top", "vif", vif);
    run_test("test");
  end
endmodule
