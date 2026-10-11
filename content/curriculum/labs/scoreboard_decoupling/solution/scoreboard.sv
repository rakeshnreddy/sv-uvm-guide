// SOLUTION: the decoupled scoreboard. req_in and rsp_in are now analysis
// exports. Each feeds a uvm_tlm_analysis_fifo, which accepts every write() at
// once (it is unbounded; its write() is a try_put that always succeeds), and
// the run_phase thread takes items out with get(), a task that may wait.
// The env is unchanged: it still connects to req_in and rsp_in.

class my_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(my_scoreboard)

  uvm_analysis_export #(my_txn) req_in;   // from gen.req_ap
  uvm_analysis_export #(my_txn) rsp_in;   // from gen.rsp_ap

  protected uvm_tlm_analysis_fifo #(my_txn) req_fifo, rsp_fifo;
  int unsigned n_match, n_mismatch;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    req_in   = new("req_in", this);
    rsp_in   = new("rsp_in", this);
    req_fifo = new("req_fifo", this);
    rsp_fifo = new("rsp_fifo", this);
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    req_in.connect(req_fifo.analysis_export);
    rsp_in.connect(rsp_fifo.analysis_export);
  endfunction

  // The thread may wait as long as it needs: here, for the response.
  virtual task run_phase(uvm_phase phase);
    my_txn req, rsp;
    forever begin
      req_fifo.peek(req);           // oldest request, left in the FIFO
      rsp_fifo.get(rsp);            // wait for its response
      void'(req_fifo.try_get(req)); // only now consume the request
      check(req, rsp);
    end
  endtask

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

  // After run_phase: anything left in a FIFO was never compared.
  virtual function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    if (req_fifo.used() != 0)
      `uvm_error("SCB/MISSING", $sformatf("%0d requests never answered", req_fifo.used()))
    if (rsp_fifo.used() != 0)
      `uvm_error("SCB/UNEXPECTED", $sformatf("%0d responses matched no request",
                                             rsp_fifo.used()))
    if (n_match + n_mismatch == 0)
      `uvm_error("SCB/NO_TRAFFIC", "no response was compared: this run proves nothing")
  endfunction

  virtual function void report_phase(uvm_phase phase);
    super.report_phase(phase);
    `uvm_info("SCB_SUMMARY", $sformatf("SCB_SUMMARY matches=%0d mismatches=%0d pending=%0d",
              n_match, n_mismatch, req_fifo.used() + rsp_fifo.used()), UVM_NONE)
  endfunction
endclass
