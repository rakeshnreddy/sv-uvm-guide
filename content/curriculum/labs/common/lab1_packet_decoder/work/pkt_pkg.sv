// pkt_pkg: the testbench's types for one packet header (lab common-1 starter).
// The DUT has flat vector ports; these types give the same bits names.
//
// The four types below are placeholders: plain vectors of the right width, so
// that the starter compiles. Step 2 replaces each one with the type the README
// describes. Keep the names: the testbench uses them.
package pkt_pkg;
  timeunit 1ns;
  timeprecision 1ps;

  // TODO step 2: typedef enum logic [2:0] with the members K_IDLE = 0, K_READ = 1,
  // K_WRITE = 2 and K_RESP = 4 (rule D1). Values 3, 5, 6 and 7 stay non-members.
  typedef logic [2:0] kind_e;

  // TODO step 2: typedef enum logic [1:0] with the members E_NONE = 0, E_KIND = 1,
  // E_CHK = 2 and E_LEN = 3 (rule D3), in that order.
  typedef logic [1:0] err_e;

  localparam logic [4:0] MAX_LEN = 5'd16;  // the longest legal payload, in bytes

  // TODO step 2: typedef struct packed with the members kind (a kind_e), dest
  // (4 bits), len (5 bits) and chk (4 bits), so that kind is bits [15:13].
  typedef logic [15:0] hdr_t;

  // TODO step 2: typedef struct packed with the members accept (1 bit), err
  // (an err_e), dest (4 bits) and len (5 bits), in that order: 12 bits.
  typedef logic [11:0] dec_t;
endpackage
