// A synthetic traffic source. It stands in for a DUT and its two monitors, so
// the lab needs no RTL: req_ap publishes each request, and rsp_ap publishes
// the "DUT's" answer, ~data, rsp_latency later. Because it plays the DUT, it
// generates data; a real monitor only observes.

class traffic_gen extends uvm_component;
  `uvm_component_utils(traffic_gen)

  uvm_analysis_port #(my_txn) req_ap;   // stands in for the input monitor
  uvm_analysis_port #(my_txn) rsp_ap;   // stands in for the output monitor
  decoupling_lab_config cfg;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    req_ap = new("req_ap", this);
    rsp_ap = new("rsp_ap", this);
    if (!uvm_config_db#(decoupling_lab_config)::get(this, "", "cfg", cfg))
      `uvm_fatal("NO_CFG", "decoupling_lab_config is not configured")
  endfunction

  // One request every 10 ns; returns when the last response has been published.
  task send();
    for (int unsigned i = 0; i < cfg.transaction_count; i++) begin
      my_txn req = my_txn::type_id::create("req");   // a new object every time
      #10ns;
      if (!req.randomize()) `uvm_fatal("RAND", "my_txn randomization failed")
      req.seq = i;
      req_ap.write(req);
      fork
        respond(req);
      join_none
    end
    wait fork;                                      // every response is out
  endtask

  protected task respond(my_txn req);
    my_txn rsp = my_txn::type_id::create("rsp");
    #(cfg.rsp_latency);
    rsp.seq  = req.seq;
    rsp.data = ~req.data;                           // the "DUT's" rule
    if (int'(req.seq) == cfg.corrupt_index)
      rsp.data[0] = ~rsp.data[0];                   // planted bug, when enabled
    rsp_ap.write(rsp);
  endtask
endclass
