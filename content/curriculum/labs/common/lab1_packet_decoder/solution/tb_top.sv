// tb_top: a self-checking bench for pkt_decoder (lab common-1, reference solution).
// Compile solution/pkt_pkg.sv first, then work/pkt_decoder.sv, then this file.
module tb_top;
  timeunit 1ns;
  timeprecision 1ps;
  import pkt_pkg::*;

  // Step 7: 1, 2 or 3 plants a known bug in the DUT. Leave it at 0 otherwise.
  localparam int DUT_BUG = 0;

  logic [15:0] hdr_word;
  logic        accept;
  logic [1:0]  err;
  logic [3:0]  dest;
  logic [4:0]  len;

  pkt_decoder #(.BUG(DUT_BUG)) dut (
    .hdr   (hdr_word),
    .accept(accept),
    .err   (err),
    .dest  (dest),
    .len   (len)
  );

  hdr_t        stim[];                // the stimulus list: a dynamic array (§7.5)
  int unsigned exp_bytes[bit [3:0]];  // model: payload bytes accepted per destination (§7.8)
  int unsigned act_bytes[bit [3:0]];  // DUT: the same table, built from its outputs
  int unsigned count_by_kind[kind_e]; // packets the DUT accepted, per kind
  int unsigned seen_err[err_e];       // packets the model predicted, per err value
  int          pass_cnt = 0;
  int          fail_cnt = 0;

  // ---- Step 2: the types are in pkt_pkg; this proves their layout ----------
  function automatic void check_types();
    hdr_t probe;
    if ($bits(hdr_t) != 16 || $bits(dec_t) != 12)
      $fatal(1, "TYPES $bits(hdr_t)=%0d (want 16), $bits(dec_t)=%0d (want 12)", $bits(hdr_t), $bits(dec_t));
    probe = '{kind: K_WRITE, dest: 4'hA, len: 5'd17, chk: 4'h5};
    if (probe !== 16'h5515)
      $fatal(1, "TYPES hdr_t fields are in the wrong order: %h, want 5515", probe);
  endfunction

  // ---- Step 3: the reference model, written from rules D1 to D5 ------------
  // D2: the checksum is the XOR of the three upper nibbles of the header.
  // A packed struct used as a primary is one vector (§7.2.1), so it can be part-selected.
  function automatic logic [3:0] hdr_chk(hdr_t h);
    return h[15:12] ^ h[11:8] ^ h[7:4];
  endfunction

  // D1: is this 3-bit value one of kind_e's members? $cast as a function
  // returns 0 instead of making an invalid assignment (§6.24.2).
  function automatic bit kind_is_member(logic [2:0] raw);
    kind_e k;
    return $cast(k, raw) != 0;
  endfunction

  // A legal header: the members by name, then the right checksum.
  function automatic hdr_t make_hdr(kind_e k, logic [3:0] d, logic [4:0] l);
    hdr_t h = '{kind: k, dest: d, len: l, chk: 4'h0};
    h.chk = hdr_chk(h);
    return h;
  endfunction

  // Any header, from raw bits. Writing the whole struct as a vector copies the
  // kind bits whether or not they are a member: nothing type-checks them.
  function automatic hdr_t raw_hdr(logic [2:0] kind, logic [3:0] d, logic [4:0] l, bit good_chk);
    hdr_t h = {kind, d, l, 4'h0};
    h.chk = good_chk ? hdr_chk(h) : ~hdr_chk(h);
    return h;
  endfunction

  // D3 to D5: what the DUT must report for one header.
  function automatic dec_t model_decode(hdr_t h);
    dec_t d = '{accept: 1'b0, err: E_NONE, dest: 4'd0, len: 5'd0};
    if (!kind_is_member(h.kind))   d.err = E_KIND;
    else if (h.chk !== hdr_chk(h)) d.err = E_CHK;
    else if (h.len > MAX_LEN)      d.err = E_LEN;
    d.accept = (d.err == E_NONE) && (h.kind != K_IDLE);
    if (d.accept) begin
      d.dest = h.dest;
      d.len  = h.len;
    end
    return d;
  endfunction

  // ---- Step 4: the stimulus list -------------------------------------------
  function automatic void build_stimulus();
    stim    = new[6];
    stim[0] = make_hdr(K_READ,  4'd3, 5'd4);
    stim[1] = make_hdr(K_WRITE, 4'd3, 5'd16);  // the longest legal payload
    stim[2] = make_hdr(K_WRITE, 4'd5, 5'd17);  // one byte too long
    stim[3] = make_hdr(K_RESP,  4'd9, 5'd0);   // legal, and carries no payload
    stim[4] = make_hdr(K_IDLE,  4'd0, 5'd0);   // legal, but never accepted
    stim[5] = make_hdr(K_READ,  4'd5, 5'd8);
    // Grow the list and keep the first six entries (§7.5.1).
    stim    = new[stim.size() + 4](stim);
    stim[6] = raw_hdr(3'd2, 4'd9, 5'd2,  1'b0);  // a WRITE with a wrong checksum
    stim[7] = raw_hdr(3'd5, 4'd3, 5'd1,  1'b1);  // kind 5 is not a member
    stim[8] = raw_hdr(3'd3, 4'd7, 5'd4,  1'b0);  // kind 3 and a wrong checksum: E_KIND wins
    stim[9] = make_hdr(K_WRITE, 4'd9, 5'd16);
  endfunction

  // ---- Step 5: the checks ---------------------------------------------------
  // One decode result as text. name() gives "" for a value that is not a member.
  function automatic string dec_str(dec_t d);
    return $sformatf("accept=%b err=%s dest=%0d len=%0d", d.accept, d.err.name(), d.dest, d.len);
  endfunction

  // Compare the DUT's outputs for header number idx with the model's answer,
  // and add both answers to the per-destination tables.
  function automatic void check_packet(int idx, hdr_t h);
    dec_t act;
    dec_t exp;
    act = {accept, err, dest, len};  // the ports, as one vector, into the struct
    exp = model_decode(h);
    seen_err[exp.err]++;
    if (act !== exp) begin
      fail_cnt++;
      $error("PKT %0d hdr=%h: got %s, expected %s", idx, h, dec_str(act), dec_str(exp));
    end else begin
      pass_cnt++;
    end
    // A read-modify-write allocates a missing key with its default, 0 (§7.8.7).
    if (exp.accept) exp_bytes[exp.dest] += int'(exp.len);
    if (act.accept === 1'b1) begin
      act_bytes[act.dest] += int'(act.len);
      count_by_kind[h.kind]++;
    end
  endfunction

  // Walk an associative array keyed by an enum, in key order (§7.9.4, §7.9.6).
  function automatic void print_traffic();
    kind_e k;
    if (count_by_kind.first(k) != 0) begin
      do $display("KIND %s accepted=%0d", k.name(), count_by_kind[k]);
      while (count_by_kind.next(k) != 0);
    end
    foreach (exp_bytes[d]) $display("DEST %0d bytes=%0d", d, exp_bytes[d]);
  endfunction

  // One check per destination the model expects, and a failure for every
  // destination the DUT used that the model never expected.
  function automatic void compare_tables();
    foreach (exp_bytes[d]) begin
      if (!act_bytes.exists(d)) begin
        fail_cnt++;
        $error("TABLE dest=%0d: expected %0d bytes, the DUT accepted none", d, exp_bytes[d]);
      end else if (act_bytes[d] != exp_bytes[d]) begin
        fail_cnt++;
        $error("TABLE dest=%0d: got %0d bytes, expected %0d", d, act_bytes[d], exp_bytes[d]);
      end else begin
        pass_cnt++;
      end
    end
    foreach (act_bytes[d]) begin
      if (!exp_bytes.exists(d)) begin
        fail_cnt++;
        $error("TABLE dest=%0d: the DUT accepted %0d bytes nobody expected", d, act_bytes[d]);
      end
    end
  endfunction

  // The plan needs every err value at least once. Walk err_e's members in
  // declaration order with the enum methods (§6.19.5) and look each one up.
  function automatic void check_plan();
    err_e e = e.first();
    forever begin
      if (!seen_err.exists(e)) begin
        fail_cnt++;
        $error("PLAN no packet in the list produces %s", e.name());
      end else begin
        pass_cnt++;
      end
      if (e == e.last()) break;
      e = e.next();
    end
  endfunction

  // One summary line. A run that checked nothing proves nothing: a failure.
  function automatic void report();
    if (pass_cnt == 0 && fail_cnt == 0) begin
      fail_cnt++;
      $error("CHK nothing was checked");
    end
    $display("PASS=%0d FAIL=%0d", pass_cnt, fail_cnt);
  endfunction

  initial begin
    check_types();
    build_stimulus();
    $display("TEST %0d packets", stim.size());
    foreach (stim[i]) begin
      hdr_word = stim[i];
      #1;  // let the combinational DUT settle before reading its outputs
      check_packet(i, stim[i]);
    end
    print_traffic();
    compare_tables();
    check_plan();
    report();
    $finish;
  end
endmodule
