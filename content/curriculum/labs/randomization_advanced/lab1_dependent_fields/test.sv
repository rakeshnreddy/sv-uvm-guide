program test;
  initial begin
    packet pkt;
    
    $display("--- Starting Randomization Test ---");
    
    repeat (10) begin
      pkt = new();
      
      // FIX ME: This is a silent failure! The return value is ignored.
      // 1. You should assert or check the return value of randomize().
      // 2. Add $fatal(1, "Randomization failed") if it returns 0.
      
      // Triage tip: Try turning off the hardware limit to see if it fixes it
      // pkt.c_hardware_limit.constraint_mode(0);
      
      void'(pkt.randomize());
      
      $display("Proto: %s | Length: %0d | Payload Size: %0d", 
               pkt.proto.name(), pkt.length, pkt.payload.size());
    end
    
    $display("--- Test Completed ---");
  end
endprogram
