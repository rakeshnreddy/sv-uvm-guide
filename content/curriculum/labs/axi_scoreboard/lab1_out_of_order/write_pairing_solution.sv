// write_pairing_solution.sv (reference solution for the stretch step).

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
  wr_txn       aw_q[$];
  wr_txn       w_bursts[$];
  wr_txn       w_cur;
  wr_txn       open_b[int unsigned][$];
  int unsigned n_errors;

  function void on_aw(wr_txn aw);
    if (w_bursts.size() > 0) pair(aw, w_bursts.pop_front());   // W came first
    else aw_q.push_back(aw);
  endfunction

  function void on_w_beat(string data, bit last);
    if (w_cur == null) w_cur = new("w");
    w_cur.data.push_back(data);
    if (!last) return;
    if (aw_q.size() > 0) pair(aw_q.pop_front(), w_cur);   // oldest AW (A5.4.1)
    else w_bursts.push_back(w_cur);                       // W before AW (A3.3)
    w_cur = null;
  endfunction

  function void pair(wr_txn aw, wr_txn w);
    aw.data = w.data;
    if (w.data.size() != aw.len + 1) begin       // deferred WLAST check
      n_errors++;
      $display("ERROR: %s (AWID %0d): WLAST on beat %0d of %0d",
               aw.name, aw.id, w.data.size(), aw.len + 1);
    end
    open_b[aw.id].push_back(aw);                 // same AWID may repeat
  endfunction

  function wr_txn on_b(int unsigned bid);
    if (!open_b.exists(bid) || open_b[bid].size() == 0) begin
      n_errors++;
      $display("ERROR: BID %0d with no completed write", bid);
      return null;
    end
    return open_b[bid].pop_front();              // in order per ID (A6.4)
  endfunction
endclass
