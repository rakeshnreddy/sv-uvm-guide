// write_pairing.sv (starter, stretch step): AXI4 write reassembly without WID,
// in plain SystemVerilog. write_pairing_tb.sv replays a trace through it.
// It compiles as given; complete the three TODO functions.

class wr_txn;
  string       name;
  int unsigned id;          // AWID
  int unsigned len;         // AWLEN: the burst has len + 1 beats
  string       data[$];     // the W beats paired with this AW
  function new(string name = "", int unsigned id = 0, int unsigned len = 0);
    this.name = name;
    this.id   = id;
    this.len  = len;
  endfunction
endclass

class axi_wr_pairer;
  wr_txn       aw_q[$];                 // AWs waiting for their data
  wr_txn       w_bursts[$];             // complete W bursts waiting for an AW
  wr_txn       w_cur;                   // the W burst being collected
  wr_txn       open_b[int unsigned][$]; // per AWID: paired writes awaiting B
  int unsigned n_errors;

  // At each AW handshake.
  function void on_aw(wr_txn aw);
    // TODO 1: if a complete W burst is waiting (W came first, IHI0022E A3.3),
    //   pair it with this AW; otherwise queue the AW in aw_q.
  endfunction

  // At each W handshake. W carries no ID in AXI4 (A5.4.1).
  function void on_w_beat(string data, bit last);
    // TODO 2: append data to w_cur (create it if null). On the WLAST beat,
    //   pair w_cur with the OLDEST waiting AW if there is one, otherwise
    //   hold it in w_bursts; then start a new burst (w_cur = null).
  endfunction

  // Pairing: copy the beats into the AW, check the beat count against
  // len + 1 (only the AW knows AWLEN, so the WLAST check waits until now),
  // count a mismatch in n_errors with a $display("ERROR: ..."), and queue
  // the write in open_b[aw.id]. Write this helper yourself.

  // At each B handshake: return the write it completes, or null.
  function wr_txn on_b(int unsigned bid);
    // TODO 3: pop the OLDEST write in open_b[bid] (same-ID responses are in
    //   order, A6.4). If there is none, count an error and return null.
    return null;
  endfunction
endclass
