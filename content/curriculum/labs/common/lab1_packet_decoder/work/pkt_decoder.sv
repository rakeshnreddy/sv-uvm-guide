// pkt_decoder: a combinational packet-header decoder (lab common-1 DUT).
// Write your reference model from the README's specification (rules D1 to D5),
// not from this RTL. BUG plants a known bug for step 7; leave it at 0 until then.
//   BUG = 1: the length limit is off by one (a 17-byte payload is accepted)
//   BUG = 2: the checksum is checked before the kind (wrong error priority)
//   BUG = 3: dest is taken from the wrong header bits
module pkt_decoder #(
  parameter int BUG = 0
) (
  input  logic [15:0] hdr,
  output logic        accept,
  output logic [1:0]  err,
  output logic [3:0]  dest,
  output logic [4:0]  len
);
  timeunit 1ns;
  timeprecision 1ps;

  logic [2:0] kind;
  logic [3:0] f_dest;
  logic [4:0] f_len;
  logic       kind_ok;
  logic       chk_ok;
  logic       len_ok;
  logic [3:0] dest_bits;

  assign kind   = hdr[15:13];
  assign f_dest = hdr[12:9];
  assign f_len  = hdr[8:4];

  always_comb begin
    kind_ok   = (kind == 3'd0) || (kind == 3'd1) || (kind == 3'd2) || (kind == 3'd4);
    chk_ok    = (hdr[3:0] == (hdr[15:12] ^ hdr[11:8] ^ hdr[7:4]));
    len_ok    = (BUG == 1) ? (f_len <= 5'd17) : (f_len <= 5'd16);
    dest_bits = (BUG == 3) ? hdr[11:8] : f_dest;

    if (BUG == 2) begin
      if (!chk_ok)       err = 2'd2;
      else if (!kind_ok) err = 2'd1;
      else if (!len_ok)  err = 2'd3;
      else               err = 2'd0;
    end else begin
      if (!kind_ok)      err = 2'd1;
      else if (!chk_ok)  err = 2'd2;
      else if (!len_ok)  err = 2'd3;
      else               err = 2'd0;
    end

    accept = (err == 2'd0) && (kind != 3'd0);
    dest   = accept ? dest_bits : 4'd0;
    len    = accept ? f_len : 5'd0;
  end
endmodule
