// Packet model for the Ethernet MAC receive path.
// Spec excerpt:
//   - IPV4 packets carry 20 to 60 bytes.
//   - IPV6 packets carry exactly 40 bytes.
//   - The receive FIFO stores whole 8-byte words: a payload is a multiple
//     of 8 bytes, from 8 to 256 bytes.
//
// The class lives in a package so that test.sv can import it on any
// simulator (whether separate files share one compilation unit is
// tool-specific, IEEE 1800-2023 §3.12.1). Compile this file first.
package pkt_pkg;

  class packet;
    typedef enum { IPV4=0, IPV6=1, RAW=2 } protocol_t;

    rand protocol_t   proto;
    rand int unsigned length;
    rand bit [7:0]    payload[];

    constraint c_proto_len {
      // An IPV4 packet carries 20 to 60 bytes.
      (proto == IPV4) -> length inside {[20:60]};
      // An IPV6 packet carries exactly 40 bytes.
      (proto == IPV6) -> length == 40;
    }

    constraint c_payload_size {
      // The payload size must match the length field.
      payload.size() == length;
    }

    constraint c_hardware_limit {
      // The receive FIFO limit. Compare this with the spec excerpt above.
      payload.size() inside { 16, 32, 64, 128, 256 };
    }
  endclass

endpackage
