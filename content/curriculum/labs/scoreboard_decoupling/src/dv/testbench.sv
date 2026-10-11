// Top level of the scoreboard-decoupling lab.
// Compile this file only, with src/dv on the include path; to run the
// solution, put solution/ on the include path before src/dv.
`timescale 1ns/1ps
`include "uvm_macros.svh"
import uvm_pkg::*;

`include "txn.sv"
`include "traffic_gen.sv"
`include "scoreboard.sv"
`include "env.sv"

class decoupling_test extends uvm_test;
  `uvm_component_utils(decoupling_test)

  my_env env;
  decoupling_lab_config cfg;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    cfg = decoupling_lab_config::type_id::create("cfg");
    cfg.transaction_count = 10;
    cfg.rsp_latency       = 30ns;
    void'($value$plusargs("CORRUPT=%d", cfg.corrupt_index));  // e.g. +CORRUPT=4
    uvm_config_db#(decoupling_lab_config)::set(this, "env.gen", "cfg", cfg);
    env = my_env::type_id::create("env", this);
    uvm_root::get().set_timeout(10us);   // a hang ends here
  endfunction

  // The traffic source knows when its last response is out, so the test
  // ends there; it never reaches into the scoreboard.
  virtual task run_phase(uvm_phase phase);
    phase.raise_objection(this, "traffic running");
    env.gen.send();
    phase.drop_objection(this, "traffic done");
  endtask
endclass

module tb_top;
  initial begin
    $timeformat(-9, 0, " ns", 0);
    run_test("decoupling_test");
  end
endmodule
