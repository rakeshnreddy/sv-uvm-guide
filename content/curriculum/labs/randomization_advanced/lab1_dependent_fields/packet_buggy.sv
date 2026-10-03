// =============================================================
// Read-only reference: the original, buggy generator in one file
// (packet.sv followed by test.sv), so you can run it on its own or
// diff your fixed files against it. Do not compile it together with
// packet.sv and test.sv: it declares the same class and program.
// =============================================================

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

program test;
  initial begin
    packet pkt;
    packet::protocol_t wanted;

    $display("--- Starting Randomization Test ---");

    // The test plan asks for every protocol in turn: IPV4, IPV6, RAW, IPV4, ...
    for (int i = 0; i < 6; i++) begin
      pkt = new();
      wanted = packet::protocol_t'(i % 3);

      // FIX ME: This is a silent failure! The return value is ignored.
      // 1. Check the return value of randomize().
      // 2. Stop the test with $fatal(1, ...) if it returns 0.

      // Triage tip: turn off one constraint block at a time, for example
      // pkt.c_hardware_limit.constraint_mode(0);

      void'(pkt.randomize() with { proto == wanted; });

      $display("Wanted: %s | Got proto: %s | Length: %0d | Payload Size: %0d",
               wanted.name(), pkt.proto.name(), pkt.length, pkt.payload.size());
    end

    $display("--- Test Completed ---");
  end
endprogram
