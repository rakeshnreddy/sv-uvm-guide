// =============================================================
// Lab: Multi-agent environment with virtual sequences (M5)
// File: work/mx_mutants.svh  (complete: do not edit)
//
// Mutant tests: deliberately broken stimulus and topology. Your bench
// passes the milestone only if every one of these runs FAILS with the
// signature in the README. Each mutant is a factory override of
// mx_reconfig_vseq or a different topology, so the environment, the
// scoreboard and the assertions are the ones you wrote.
//
// This file is `include`d at the end of mx_pkg, after mx_reconfig_vseq
// and mx_reconfig_test are declared.
// =============================================================

// Mutant 1: configuration and data race. The data burst does not wait
// for CTRL.EN = 1, so the DUT drops the bytes that arrive first (R2).
class mx_data_first_vseq extends mx_reconfig_vseq;
  `uvm_object_utils(mx_data_first_vseq)

  function new(string name = "mx_data_first_vseq");
    super.new(name);
  endfunction

  virtual task body();
    check_handles();
    fork
      program_dut(KEY_1, MODE_XOR);
      send_burst(FIRST_1, BURST_LEN);
    join
    program_dut(KEY_2, MODE_ADD);
    send_burst(FIRST_2, BURST_LEN);
  endtask
endclass

// Mutant 2: reconfiguration without the safe point. KEY and MODE are
// written while EN = 1, so the DUT ignores the KEY write and keeps
// MODE (R4); burst 2 runs with the old configuration.
class mx_no_quiesce_vseq extends mx_reconfig_vseq;
  `uvm_object_utils(mx_no_quiesce_vseq)

  function new(string name = "mx_no_quiesce_vseq");
    super.new(name);
  endfunction

  virtual task body();
    cfg_write_seq wr;
    check_handles();
    program_dut(KEY_1, MODE_XOR);
    send_burst(FIRST_1, BURST_LEN);
    wr = cfg_write_seq::type_id::create("wr_key");
    wr.addr  = ADDR_KEY;
    wr.wdata = KEY_2;
    wr.start(p_sequencer.cfg_sqr, this);
    wr = cfg_write_seq::type_id::create("wr_ctrl");
    wr.addr  = ADDR_CTRL;
    wr.wdata = {6'b0, MODE_ADD, 1'b1};
    wr.start(p_sequencer.cfg_sqr, this);
    send_burst(FIRST_2, BURST_LEN);
  endtask
endclass

class mx_data_first_test extends mx_reconfig_test;
  `uvm_component_utils(mx_data_first_test)

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    mx_reconfig_vseq::type_id::set_type_override(mx_data_first_vseq::get_type());
  endfunction
endclass

class mx_no_quiesce_test extends mx_reconfig_test;
  `uvm_component_utils(mx_no_quiesce_test)

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    mx_reconfig_vseq::type_id::set_type_override(mx_no_quiesce_vseq::get_type());
  endfunction
endclass

// Mutant 3: topology. The configuration agent is made passive, so it
// has no sequencer and the virtual sequencer's cfg_sqr handle is null.
// The virtual sequence must stop at once with a named fatal, not hang.
class mx_passive_cfg_test extends mx_reconfig_test;
  `uvm_component_utils(mx_passive_cfg_test)

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void configure_env(mx_env_cfg cfg);
    cfg.cfg_agt_cfg.is_active = UVM_PASSIVE;
  endfunction
endclass
