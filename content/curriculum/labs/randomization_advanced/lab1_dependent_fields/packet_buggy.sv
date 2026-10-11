// =============================================================
// Read-only reference: the original, buggy generator in one file
// (packet.sv followed by test.sv), so you can run it on its own or
// diff your fixed files against it. Do not compile it together with
// packet.sv and test.sv: it declares the same package and module.
// =============================================================

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

// Generator: asks for every protocol in turn. Compile after packet.sv.
module tb_top;
  import pkt_pkg::*;

  initial begin
    packet             pkt;
    packet::protocol_t wanted;

    $display("--- Starting Randomization Test ---");

    // The test plan asks for every protocol in turn: IPV4, IPV6, RAW, IPV4, ...
    for (int i = 0; i < 6; i++) begin
      pkt = new();
      wanted = packet::protocol_t'(i % 3);

      // FIX ME: This is a silent failure! The return value is ignored.
      // 1. Check the return value of randomize().
      // 2. Stop the test with $fatal(1, ...) if it returns 0.

      // Triage tip (step 2): switch off one constraint block at a time, only for
      // the row you are triaging, for example
      //   if (wanted == packet::IPV6) pkt.c_hardware_limit.constraint_mode(0);
      // Switching c_hardware_limit off for every row would leave RAW lengths
      // unbounded, and a RAW payload could be billions of bytes long.

      void'(pkt.randomize() with { proto == wanted; });

      $display("Wanted: %s | Got proto: %s | Length: %0d | Payload Size: %0d",
               wanted.name(), pkt.proto.name(), pkt.length, pkt.payload.size());
    end

    $display("--- Test Completed ---");
    $finish;
  end
endmodule
