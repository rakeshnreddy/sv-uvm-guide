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
