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
    // The hardware FIFO can only accept payloads that are powers of 2 (max 256)
    // There is a subtle bug here!
    payload.size() inside { 16, 32, 64, 128, 256 };
  }
  
  // --------------------------------------------------------------------------
  // HINT FOR TRIAGE: 
  // 1. Look at c_proto_len for IPV6
  // 2. Look at c_payload_size
  // 3. Look at c_hardware_limit
  // Can all three be true at the same time if proto == IPV6?
  // --------------------------------------------------------------------------

endclass
