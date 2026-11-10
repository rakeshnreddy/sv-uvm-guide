// pkt_pkg: the testbench's types for one packet header (lab common-1, reference solution).
// The DUT has flat vector ports; these types give the same bits names.
package pkt_pkg;
  timeunit 1ns;
  timeprecision 1ps;

  // Header field kind, bits [15:13]. Values 3, 5, 6 and 7 are not members:
  // the DUT must reject them. A 4-state base, so a kind never written reads x.
  typedef enum logic [2:0] {
    K_IDLE  = 3'd0,
    K_READ  = 3'd1,
    K_WRITE = 3'd2,
    K_RESP  = 3'd4
  } kind_e;

  // The DUT's err output, in priority order: the first rule that fails wins.
  typedef enum logic [1:0] {
    E_NONE = 2'd0,
    E_KIND = 2'd1,
    E_CHK  = 2'd2,
    E_LEN  = 2'd3
  } err_e;

  localparam logic [4:0] MAX_LEN = 5'd16;  // the longest legal payload, in bytes

  // One 16-bit header. The first member is the most significant end (§7.2.1).
  typedef struct packed {
    kind_e      kind;  // [15:13]
    logic [3:0] dest;  // [12:9]
    logic [4:0] len;   // [8:4]
    logic [3:0] chk;   // [3:0]
  } hdr_t;

  // What the DUT reports for one header, packed in the order of the concatenation
  // {accept, err, dest, len} that the testbench builds from the DUT's ports.
  typedef struct packed {
    logic       accept;  // [11]
    err_e       err;     // [10:9]
    logic [3:0] dest;    // [8:5]
    logic [4:0] len;     // [4:0]
  } dec_t;
endpackage
