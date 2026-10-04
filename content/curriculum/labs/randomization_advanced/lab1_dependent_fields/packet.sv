// Packet model for the Ethernet MAC receive path.
// Spec excerpt:
//   - IPV4 packets carry 20 to 60 bytes.
//   - IPV6 packets carry exactly 40 bytes.
//   - The receive FIFO stores whole 8-byte words: a payload is a multiple
//     of 8 bytes, from 8 to 256 bytes.
class packet;
  typedef enum { IPV4=0, IPV6=1, RAW=2 } protocol_t;

  rand protocol_t proto;
  rand int unsigned length;
  rand bit [7:0] payload[];

  constraint c_proto_len {
    // If it's an IPV4 packet, the length must be between 20 and 60
    (proto == IPV4) -> length inside {[20:60]};
    // If it's an IPV6 packet, the length must be exactly 40
    (proto == IPV6) -> length == 40;
  }

  constraint c_payload_size {
    // The payload size must match the length field
    payload.size() == length;
  }

  constraint c_hardware_limit {
    // The receive FIFO limit. Compare this with the spec excerpt above.
    payload.size() inside { 16, 32, 64, 128, 256 };
  }
endclass
