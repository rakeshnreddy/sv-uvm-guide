// STARTER: a coupled scoreboard. Both inputs are analysis imps, so all of its
// code runs inside the publisher's write() call, in zero simulation time.
//
// The check needs a request AND its response, but the response arrives 3
// cycles after the request. write_req() is a function: it cannot wait for the
// response, so the best it can do is give up. Run it and read the log.
//
// Your task (README.md): keep the names req_in and rsp_in, but make them
// uvm_analysis_export #(my_txn) members feeding two uvm_tlm_analysis_fifo
// buffers, and move the check into a run_phase thread that waits with get().

`uvm_analysis_imp_decl(_req)
`uvm_analysis_imp_decl(_rsp)

class my_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(my_scoreboard)

  uvm_analysis_imp_req #(my_txn, my_scoreboard) req_in;   // from gen.req_ap
  uvm_analysis_imp_rsp #(my_txn, my_scoreboard) rsp_in;   // from gen.rsp_ap

  protected my_txn last_rsp;            // the most recent response seen
  int unsigned n_match, n_mismatch;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    req_in = new("req_in", this);
    rsp_in = new("rsp_in", this);
  endfunction

  // A request arrives. Its response is still 3 cycles away.
  virtual function void write_req(my_txn req);
    // You cannot write @(...) or wait(...) here: a function shall not contain
    // a time-controlling statement (IEEE 1800-2023 §13.4).
    if (last_rsp == null || last_rsp.seq != req.seq) begin
      `uvm_error("SCB/NO_RSP", {req.convert2string(), ": no response yet, cannot check"})
      return;
    end
    check(req, last_rsp);
  endfunction

  virtual function void write_rsp(my_txn rsp);
    last_rsp = rsp;                     // arrives after write_req() has given up
  endfunction

  // The reference rule: the response carries ~data and the request's seq.
  protected function void check(my_txn req, my_txn rsp);
    my_txn exp;
    if (!$cast(exp, req.clone())) `uvm_fatal("SCB/CLONE", "clone() failed")
    exp.data = ~req.data;               // predict into a copy, never into req
    if (exp.compare(rsp)) n_match++;    // by value, and the result is checked
    else begin
      n_mismatch++;
      `uvm_error("SCB/MISMATCH", $sformatf("expected %s, got %s",
                 exp.convert2string(), rsp.convert2string()))
    end
  endfunction

  virtual function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    if (n_match + n_mismatch == 0)
      `uvm_error("SCB/NO_TRAFFIC", "no response was compared: this run proves nothing")
  endfunction

  virtual function void report_phase(uvm_phase phase);
    super.report_phase(phase);
    `uvm_info("SCB_SUMMARY", $sformatf("SCB_SUMMARY matches=%0d mismatches=%0d pending=0",
                                       n_match, n_mismatch), UVM_NONE)
  endfunction
endclass
