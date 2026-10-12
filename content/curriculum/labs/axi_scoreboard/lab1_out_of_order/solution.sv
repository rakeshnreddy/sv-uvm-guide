// solution.sv (reference solution): the completed axi_monitor.sv and
// axi_scoreboard.sv in one file. testbench.sv includes it instead of your two
// files when you compile with +define+AXI_LAB_SOLUTION.

`uvm_analysis_imp_decl(_exp)
`uvm_analysis_imp_decl(_act)

class axi_rd_monitor extends uvm_monitor;
  `uvm_component_utils(axi_rd_monitor)
  virtual axi_rd_if vif;
  uvm_analysis_port #(axi_rd_item) req_ap;   // each AR, at its handshake
  uvm_analysis_port #(axi_rd_item) ap;       // each completed read
  axi_rd_item open_q[int unsigned][$];       // per ARID: a queue, never a slot

  function new(string name, uvm_component parent);
    super.new(name, parent);
    req_ap = new("req_ap", this);
    ap     = new("ap", this);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    if (!uvm_config_db#(virtual axi_rd_if)::get(this, "", "vif", vif))
      `uvm_fatal("NO_VIF", "virtual interface not set")
  endfunction

  task run_phase(uvm_phase phase);
    forever begin
      @(vif.mon_cb);
      if (!vif.mon_cb.ARESETn) open_q.delete();
      else begin
        if (vif.mon_cb.RVALID && vif.mon_cb.RREADY)   on_r_beat();
        if (vif.mon_cb.ARVALID && vif.mon_cb.ARREADY) on_ar();
      end
    end
  endtask

  function void on_ar();
    axi_rd_item t  = axi_rd_item::type_id::create("t");
    axi_rd_item rq = axi_rd_item::type_id::create("rq");
    t.id    = vif.mon_cb.ARID;
    t.addr  = vif.mon_cb.ARADDR;
    t.len   = vif.mon_cb.ARLEN;
    open_q[t.id].push_back(t);        // behind older reads with this ID
    rq.id   = t.id;                   // a separate object for the predictor
    rq.addr = t.addr;
    rq.len  = t.len;
    req_ap.write(rq);
  endfunction

  function void on_r_beat();
    int unsigned id = vif.mon_cb.RID;
    axi_rd_item  t;
    bit          last_expected;
    if (!open_q.exists(id) || open_q[id].size() == 0) begin
      `uvm_error("UNEXPECTED_R",
                 $sformatf("RID %0d with no outstanding read (A5.3.1)", id))
      return;
    end
    t = open_q[id][0];                // same-ID data returns in order (A5.3.1)
    t.data.push_back(vif.mon_cb.RDATA);
    t.resp.push_back(vif.mon_cb.RRESP);       // recorded, never judged here
    last_expected = (t.data.size() == t.len + 1);
    if (vif.mon_cb.RLAST != last_expected)
      `uvm_error("RLAST", $sformatf("RID %0d: RLAST=%0b on beat %0d of %0d (A3.2.2)",
                 id, vif.mon_cb.RLAST, t.data.size(), t.len + 1))
    if (vif.mon_cb.RLAST || last_expected) begin   // one fault, one error
      void'(open_q[id].pop_front());
      ap.write(t);
    end
  endfunction
endclass

class axi_rd_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(axi_rd_scoreboard)
  uvm_analysis_imp_exp #(axi_rd_item, axi_rd_scoreboard) exp_imp;
  uvm_analysis_imp_act #(axi_rd_item, axi_rd_scoreboard) act_imp;
  axi_rd_item  exp_q[int unsigned][$];
  int unsigned n_match, n_mismatch, n_pending;

  function new(string name, uvm_component parent);
    super.new(name, parent);
    exp_imp = new("exp_imp", this);
    act_imp = new("act_imp", this);
  endfunction

  function void write_exp(axi_rd_item e);
    exp_q[e.id].push_back(e);
    n_pending++;
  endfunction

  function void write_act(axi_rd_item a);
    axi_rd_item e;
    string      d;
    if (!exp_q.exists(a.id) || exp_q[a.id].size() == 0) begin
      `uvm_error("SCB_UNEXPECTED", $sformatf("no expected read for %s",
                                             a.convert2string()))
      return;
    end
    e = exp_q[a.id].pop_front();      // the oldest read with this ID
    n_pending--;
    d = e.diff(a);
    if (d == "") n_match++;
    else begin
      n_mismatch++;
      `uvm_error("SCB_MISMATCH", $sformatf("ID %0d addr 0x%08h: %s",
                                           e.id, e.addr, d))
    end
  endfunction

  function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    foreach (exp_q[id])
      if (exp_q[id].size() != 0)
        `uvm_error("SCB_PENDING", $sformatf("ID %0d: %0d read(s) never completed",
                                            id, exp_q[id].size()))
  endfunction

  function void report_phase(uvm_phase phase);
    super.report_phase(phase);
    `uvm_info("SCB_SUMMARY", $sformatf("matches=%0d mismatches=%0d pending=%0d",
              n_match, n_mismatch, n_pending), UVM_NONE)
  endfunction
endclass
