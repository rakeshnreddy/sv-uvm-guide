// tb_top: a self-checking bench for pkt_decoder (lab common-1 starter).
// Compile work/pkt_pkg.sv first, then work/pkt_decoder.sv, then this file.
// It compiles and runs as given, but checks nothing yet. Each "TODO step N"
// marks code you write in step N of the README.
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
    // TODO step 2: once your four types compile, delete the /* and */ lines
    // so that these checks run. A wrong width or field order stops the run.
    /*
    hdr_t probe;
    if ($bits(hdr_t) != 16 || $bits(dec_t) != 12)
      $fatal(1, "TYPES $bits(hdr_t)=%0d (want 16), $bits(dec_t)=%0d (want 12)", $bits(hdr_t), $bits(dec_t));
    probe = '{kind: K_WRITE, dest: 4'hA, len: 5'd17, chk: 4'h5};
    if (probe !== 16'h5515)
      $fatal(1, "TYPES hdr_t fields are in the wrong order: %h, want 5515", probe);
    */
  endfunction

  // ---- Step 3: the reference model, written from rules D1 to D5 ------------
  // D2: the checksum of a header.
  function automatic logic [3:0] hdr_chk(hdr_t h);
    // TODO step 3: return the XOR of bits [15:12], [11:8] and [7:4] of h.
    return 4'h0;
  endfunction

  // D1: is this 3-bit value one of kind_e's members?
  function automatic bit kind_is_member(logic [2:0] raw);
    // TODO step 3: declare a kind_e variable and return whether $cast,
    // called as a function, accepts raw into it.
    return 1'b0;
  endfunction

  // A legal header: the members by name, then the right checksum.
  function automatic hdr_t make_hdr(kind_e k, logic [3:0] d, logic [4:0] l);
    // TODO step 3: build h with an assignment pattern by member name
    // (chk: 4'h0), then set h.chk = hdr_chk(h) and return h.
    return '0;
  endfunction

  // Any header, from raw bits, with a right (good_chk = 1) or wrong checksum.
  function automatic hdr_t raw_hdr(logic [2:0] kind, logic [3:0] d, logic [4:0] l, bit good_chk);
    // TODO step 3: assign the concatenation {kind, d, l, 4'h0} to an hdr_t,
    // then set its chk to hdr_chk(h) or to the inverse of it.
    return '0;
  endfunction

  // D3 to D5: what the DUT must report for one header.
  function automatic dec_t model_decode(hdr_t h);
    // TODO step 3: start from accept 0, E_NONE, dest 0, len 0; set err from
    // rule D3 in priority order; accept from D4; dest and len from D5.
    return '0;
  endfunction

  // ---- Step 4: the stimulus list -------------------------------------------
  function automatic void build_stimulus();
    // TODO step 4: size stim with new[6] and fill entries 0 to 5 with make_hdr,
    // grow it to 10 entries without losing them, and fill 6 to 9 from the
    // README's plan table (raw_hdr for 6, 7 and 8).
  endfunction

  // ---- Step 5: the checks ---------------------------------------------------
  // One decode result as text, such as "accept=1 err=E_NONE dest=3 len=4".
  function automatic string dec_str(dec_t d);
    // TODO step 5: use $sformatf, and d.err.name() for the error's name.
    return "";
  endfunction

  // Compare the DUT's outputs for header number idx with the model's answer,
  // and add both answers to the per-destination tables.
  function automatic void check_packet(int idx, hdr_t h);
    // TODO step 5: act = {accept, err, dest, len}; exp = model_decode(h);
    // count exp.err in seen_err; compare act !== exp and count pass_cnt or
    // fail_cnt (with an $error that prints both); add exp.len to exp_bytes when
    // the model accepts, and act.len to act_bytes and h.kind to count_by_kind
    // when the DUT accepts (act.accept === 1'b1).
  endfunction

  // ---- Step 6: tables, plan and verdict -------------------------------------
  // Print count_by_kind (KIND lines) and exp_bytes (DEST lines).
  function automatic void print_traffic();
    // TODO step 6: walk count_by_kind with first() and next(); foreach over exp_bytes.
  endfunction

  // Compare act_bytes with exp_bytes, key by key, in both directions.
  function automatic void compare_tables();
    // TODO step 6
  endfunction

  // Every err_e member must have been predicted at least once.
  function automatic void check_plan();
    // TODO step 6: walk err_e from first() to last() with next(), and look
    // each member up in seen_err with exists().
  endfunction

  // One summary line.
  function automatic void report();
    // TODO step 6: a run that checked nothing is a failure, not a pass.
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
