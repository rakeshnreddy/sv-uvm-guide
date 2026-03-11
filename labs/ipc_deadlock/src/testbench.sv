module testbench;
  semaphore shared_bus;
  
  initial begin
    // Initialize the semaphore with exactly 1 key
    shared_bus = new(1);
    
    fork
      producer_thread();
      consumer_thread();
    join
    
    $display("@%0t [TB] Test finished successfully!", $time);
    $finish;
  end
  
  task producer_thread();
    int data;
    for (int i = 0; i < 5; i++) begin
      #10;
      $display("@%0t [PROD] Requesting bus access for iteration %0d...", $time, i);
      shared_bus.get(1);
      $display("@%0t [PROD] Bus access GRANTED. Starting transmission.", $time);
      
      data = $urandom_range(0, 10);
      #20; // Simulate transmission time
      
      // DELIBERATE BUG: An unexpected error condition causes an early return 
      // without putting the key back into the semaphore!
      if (data == 5) begin
        $display("@%0t [PROD] FATAL DATA ERROR (data=5). Bailing out early!", $time);
        return; 
      end
      
      $display("@%0t [PROD] Transmission complete. Returning key.", $time);
      shared_bus.put(1);
    end
  endtask
  
  task consumer_thread();
    for (int i = 0; i < 5; i++) begin
      #15;
      $display("@%0t [CONS] Waiting for bus access for iteration %0d...", $time, i);
      shared_bus.get(1);
      $display("@%0t [CONS] Bus access GRANTED. Reading data.", $time);
      #15; // Simulate read time
      $display("@%0t [CONS] Read complete. Returning key.", $time);
      shared_bus.put(1);
    end
  endtask
  
  // Watchdog timer to kill the test if it hangs
  initial begin
    #500;
    $display("@%0t [WATCHDOG] Simulation completely HUNG. A thread is deadlocked!", $time);
    $finish;
  end

endmodule
