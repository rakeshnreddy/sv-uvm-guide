// axi_monitor.sv (starter): included inside axi_rd_pkg by testbench.sv, so
// uvm_pkg, the macros and axi_rd_item are already visible. It compiles as
// given; complete the two TODO functions.
class axi_rd_monitor extends uvm_monitor;
  `uvm_component_utils(axi_rd_monitor)
  virtual axi_rd_if vif;
  uvm_analysis_port #(axi_rd_item) req_ap;   // each AR, at its handshake
  uvm_analysis_port #(axi_rd_item) ap;       // each completed read
  // One ordered queue of open reads per ARID. AXI allows several reads with
  // the same ID to be outstanding (IHI0022E A5.3), so one slot per ID loses
  // reads: never write open_q[id] = t.
  axi_rd_item open_q[int unsigned][$];

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
      @(vif.mon_cb);                  // sample through the clocking block
      if (!vif.mon_cb.ARESETn) open_q.delete();   // reset policy: drop open reads, never publish
      else begin
        // R first: a beat at this edge can only belong to a read whose AR
        // handshake came at an earlier edge (A3.3.1).
        if (vif.mon_cb.RVALID && vif.mon_cb.RREADY)   on_r_beat();
        if (vif.mon_cb.ARVALID && vif.mon_cb.ARREADY) on_ar();
      end
    end
  endtask

  // Called at each AR handshake.
  function void on_ar();
    // TODO 1: create a new axi_rd_item t (type_id::create) and copy ARID,
    //   ARADDR and ARLEN from vif.mon_cb into t.id, t.addr and t.len.
    // TODO 2: push_back t into open_q[t.id].
    // TODO 3: create a SECOND item rq with the same id, addr and len, and
    //   publish it with req_ap.write(rq). The predictor keeps rq, so it
    //   must not be t, which keeps changing as beats arrive.
  endfunction

  // Called at each R handshake.
  function void on_r_beat();
    // TODO 4: if open_q has no entry for vif.mon_cb.RID, or the entry is an
    //   empty queue, report `uvm_error("UNEXPECTED_R", ...) and return. Test
    //   exists() before reading the array (IEEE 1800-2023 7.8.6).
    // TODO 5: take t = open_q[RID][0], the oldest open read of that ID
    //   (same-ID data returns in issue order, A5.3.1). Append RDATA to
    //   t.data and RRESP to t.resp. Do not judge RRESP: SLVERR and DECERR
    //   are legal (A3.4.4); the scoreboard compares them with the prediction.
    // TODO 6: RLAST must be HIGH exactly on beat t.len + 1 (A3.2.2). If it
    //   is not, report `uvm_error("RLAST", ...) with the beat number.
    // TODO 7: on RLAST, or on beat t.len + 1 even without RLAST, pop the
    //   read from the front of its queue and publish it with ap.write(t).
  endfunction
endclass
