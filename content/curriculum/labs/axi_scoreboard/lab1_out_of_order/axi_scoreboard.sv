// axi_scoreboard.sv (starter): included inside axi_rd_pkg by testbench.sv.
// It compiles as given; complete the TODOs.

// Two analysis imps in one component need two suffixed imp classes
// (IEEE 1800.2-2020 Annex B.5.22): write_exp() and write_act().
`uvm_analysis_imp_decl(_exp)
`uvm_analysis_imp_decl(_act)

class axi_rd_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(axi_rd_scoreboard)
  uvm_analysis_imp_exp #(axi_rd_item, axi_rd_scoreboard) exp_imp;  // predictor
  uvm_analysis_imp_act #(axi_rd_item, axi_rd_scoreboard) act_imp;  // monitor
  axi_rd_item  exp_q[int unsigned][$];   // per ARID, in issue order
  int unsigned n_match, n_mismatch, n_pending;

  function new(string name, uvm_component parent);
    super.new(name, parent);
    exp_imp = new("exp_imp", this);
    act_imp = new("act_imp", this);
  endfunction

  // Called by the predictor at each AR handshake, with a new object.
  function void write_exp(axi_rd_item e);
    exp_q[e.id].push_back(e);
    n_pending++;
  endfunction

  // Called by the monitor for each completed read.
  function void write_act(axi_rd_item a);
    // TODO 1: if exp_q has no entry for a.id, or it is empty, report
    //   `uvm_error("SCB_UNEXPECTED", ...) and return.
    // TODO 2: pop the OLDEST expected read for a.id (pop_front) and
    //   decrement n_pending. Different IDs may complete in any order, but
    //   one ID completes in issue order (A5.3.1).
    // TODO 3: compare with e.diff(a), which returns "" on a match or the
    //   first difference. Count n_match, or count n_mismatch and report
    //   `uvm_error("SCB_MISMATCH", ...) with the ID, address and difference.
  endfunction

  // End-of-test accounting: runs after the run phase ends.
  function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    // TODO 4: for every ID whose exp_q is not empty, report
    //   `uvm_error("SCB_PENDING", ...) with the ID and the count.
  endfunction

  function void report_phase(uvm_phase phase);
    super.report_phase(phase);
    `uvm_info("SCB_SUMMARY", $sformatf("matches=%0d mismatches=%0d pending=%0d",
              n_match, n_mismatch, n_pending), UVM_NONE)
  endfunction
endclass
