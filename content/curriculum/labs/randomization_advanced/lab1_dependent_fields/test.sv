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
