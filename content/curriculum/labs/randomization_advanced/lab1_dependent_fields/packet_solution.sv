// =============================================================
// Solution: fixed packet model and a test that cannot fail silently.
// Self-contained (class + program) so it runs on its own.
// =============================================================

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
    (proto == IPV4) -> length inside {[20:60]};
    (proto == IPV6) -> length == 40;
  }

  constraint c_payload_size {
    payload.size() == length;
  }

  // FIX: the old rule (powers of two only) did not match the spec and
  // excluded 40, so IPV6 had no solution. The FIFO stores 8-byte words.
  constraint c_hardware_limit {
    payload.size() % 8 == 0;
    payload.size() inside {[8:256]};
  }
endclass

program test;
  initial begin
    packet pkt;
    packet::protocol_t wanted;

    $display("--- Starting Randomization Test ---");

    for (int i = 0; i < 6; i++) begin
      pkt = new();
      wanted = packet::protocol_t'(i % 3);

      // FIX: never ignore randomize(). On failure the fields keep their old
      // values (here the defaults of a new object), which looks like data.
      if (!pkt.randomize() with { proto == wanted; })
        $fatal(1, "Randomization failed for proto=%s", wanted.name());

      $display("Wanted: %s | Got proto: %s | Length: %0d | Payload Size: %0d",
               wanted.name(), pkt.proto.name(), pkt.length, pkt.payload.size());
    end

    $display("--- Test Completed ---");
  end
endprogram
