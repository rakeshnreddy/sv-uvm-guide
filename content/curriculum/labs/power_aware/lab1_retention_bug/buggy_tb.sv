`timescale 1ns/1ps

module cpu_pm_tb;
  // Signals
  logic clk;
  logic rst_n;
  logic [31:0] data_in;
  logic [31:0] data_out;
  
  // Power Intent / PMU signals
  logic iso_en;
  logic pwr_en;
  logic save_en;
  logic restore_en;
  
  // Buggy Wake-Up Sequence
  initial begin
    $display("--- Power-Aware Retention Lab: Buggy TB ---");
    // Initial state: Core is ON
    clk = 0;
    iso_en = 0;
    pwr_en = 1;
    save_en = 0;
    restore_en = 0;
    
    #10;
    
    // 1. Go to sleep
    $display("[SLEEP] Saving context...");
    save_en = 1;
    #10 save_en = 0;
    
    $display("[SLEEP] Engaging isolation...");
    iso_en = 1;
    
    $display("[SLEEP] Dropping main power...");
    pwr_en = 0; // CPU domain is now OFF
    
    #100; // Sleep duration
    
    // 2. Wake up (BUGGY SEQUENCE)
    $display("[WAKE] Core waking up...");
    
    // BUG: Releasing isolation before power is completely stable!
    $display("[WAKE] Releasing isolation...");
    iso_en = 0; 
    
    $display("[WAKE] Restoring main power...");
    pwr_en = 1;
    
    $display("[WAKE] Restoring context...");
    restore_en = 1;
    #10 restore_en = 0;
    
    $display("--- End Sequence ---");
    $display("Check the waveform. The CPU output glitch caused downstream X-propagation.");
    $finish;
  end
  
  always #5 clk = ~clk;

endmodule
