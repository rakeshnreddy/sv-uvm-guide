`include "uvm_macros.svh"
import uvm_pkg::*;

`include "src/dv/txn.sv"
`include "src/dv/monitor.sv"
`include "src/dv/scoreboard.sv"
`include "src/dv/env.sv"

class decoupling_test extends uvm_test;
  `uvm_component_utils(decoupling_test)

  my_env env;
  decoupling_lab_config cfg;

  function new(string name = "decoupling_test", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    cfg = decoupling_lab_config::type_id::create("cfg");
    cfg.transaction_count = 10;
    cfg.consumer_delay = 30ns;
    uvm_config_db#(decoupling_lab_config)::set(this, "env", "cfg", cfg);
    env = my_env::type_id::create("env", this);
  endfunction

  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    env.scb.wait_until_complete();
    phase.drop_objection(this);
  endtask
endclass

module testbench;
  initial begin
    run_test("decoupling_test");
  end

  initial begin
    #10us;
    `uvm_fatal("TIMEOUT", "Scoreboard decoupling lab did not complete")
  end
endmodule
