// write_pairing_tb.sv (reference, read-only): replays the B-AXI-6 kata trace.
// Compile with +define+WR_PAIRING_SOLUTION to use write_pairing_solution.sv.
`ifdef WR_PAIRING_SOLUTION
  `include "write_pairing_solution.sv"
`else
  `include "write_pairing.sv"
`endif

module tb_wr_pairing;
  axi_wr_pairer p;
  int unsigned  pass, fail;

  function automatic wr_txn aw(string name, int unsigned id, int unsigned len);
    aw = new(name, id, len);
  endfunction

  // A B handshake must complete the named write, with the given beat count.
  task automatic expect_b(int unsigned bid, string name, int unsigned beats);
    wr_txn done = p.on_b(bid);
    if (done != null && done.name == name && done.data.size() == beats) begin
      pass++;
      $display("PASS: BID %0d completes %s (%0d beats)", bid, name, beats);
    end else begin
      fail++;
      $display("FAIL: BID %0d should complete %s (%0d beats)", bid, name, beats);
    end
  endtask

  initial begin
    p = new();
    p.on_w_beat("d0", 0);            // edge 1: W before any AW (legal, A3.3)
    p.on_w_beat("d1", 1);            // edge 2: WLAST
    p.on_aw(aw("P", 0, 1));          // edge 3
    p.on_aw(aw("Q", 0, 3));          // edge 4
    p.on_w_beat("e0", 0);            // edges 5-7: WLAST on beat 3 of 4
    p.on_w_beat("e1", 0);
    p.on_w_beat("e2", 1);
    p.on_aw(aw("R", 1, 0));          // edge 8
    expect_b(0, "P", 2);             // edge 9
    p.on_w_beat("f0", 1);            // edge 10
    expect_b(1, "R", 1);             // edge 11
    expect_b(0, "Q", 3);             // edge 12
    if (p.n_errors == 1) begin
      pass++;
      $display("PASS: exactly one WLAST error (Q)");
    end else begin
      fail++;
      $display("FAIL: expected 1 error, counted %0d", p.n_errors);
    end
    $display("PASS=%0d FAIL=%0d", pass, fail);
    $finish;
  end
endmodule
