`include "uvm_macros.svh"
import uvm_pkg::*;

// 1. the Event Payload
class debug_event extends uvm_object;
  `uvm_object_utils(debug_event)
  string tag;
  string detail;
  function new(string name="debug_event"); super.new(name); endfunction
endclass

// 2. The Central Bus
class debug_event_bus extends uvm_component;
  `uvm_component_utils(debug_event_bus)
  uvm_analysis_port#(debug_event) ap;

  function new(string name, uvm_component parent);
    super.new(name, parent);
    ap = new("ap", this);
  endfunction

  function void publish(string tag, string detail);
    debug_event evt = debug_event::type_id::create("evt");
    evt.tag     = tag;
    evt.detail  = detail;
    `uvm_info("BUS", $sformatf("Broadcasting Event: %s", tag), UVM_LOW)
    ap.write(evt);
  endfunction
endclass

// 3. Environment Component (Publisher)
class watchdog_timer extends uvm_component;
  `uvm_component_utils(watchdog_timer)
  
  debug_event_bus bus;
  
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  
  task run_phase(uvm_phase phase);
    // Simulate long traffic
    #5000ns;
    // Oh no, something hung! Warn the bus before crashing.
    bus.publish("WATCHDOG_TIMEOUT", "No activity seen on RX bus for 5000ns.");
    // Wait a tiny bit (the ring buffer window) then kill.
    #5ns;
    `uvm_fatal("WDG", "Simulation halted by watchdog.")
  endtask
endclass

// --- SOLUTION IMPLEMENTATION ---

class waveform_trigger_sub extends uvm_subscriber#(debug_event);
  `uvm_component_utils(waveform_trigger_sub)
  
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  
  virtual function void write(debug_event t);
    if (t.tag == "WATCHDOG_TIMEOUT") begin
      `uvm_info("WAVE_TRIG", $sformatf("Caught %s! Initiating selective waveform capture...", t.tag), UVM_NONE)
      // In a real environment, you might use $fsdbDumpvarsByFile
      $dumpfile("crash.vcd");
      $dumpvars(0, tb_top);
    end
  endfunction
endclass

// -----------------------------

// 4. Testbench Environment
class my_env extends uvm_env;
  `uvm_component_utils(my_env)
  
  debug_event_bus bus;
  watchdog_timer wdg;
  
  // Declare your subscriber handle here
  waveform_trigger_sub trig_sub;
  
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  
  function void build_phase(uvm_phase phase);
    bus = debug_event_bus::type_id::create("bus", this);
    wdg = watchdog_timer::type_id::create("wdg", this);
    
    // Create your subscriber here
    trig_sub = waveform_trigger_sub::type_id::create("trig_sub", this);
  endfunction
  
  function void connect_phase(uvm_phase phase);
    // Bind the publisher to the bus
    wdg.bus = bus;
    
    // Connect the bus.ap to your subscriber's analysis_export
    bus.ap.connect(trig_sub.analysis_export);
  endfunction
endclass

// 5. Test
class my_test extends uvm_test;
  `uvm_component_utils(my_test)
  my_env env;
  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction
  function void build_phase(uvm_phase phase);
    env = my_env::type_id::create("env", this);
  endfunction
  task run_phase(uvm_phase phase);
    phase.raise_objection(this);
    #6000ns;
    phase.drop_objection(this);
  endtask
endclass

// 6. Top
module tb_top;
  initial begin
    run_test("my_test");
  end
endmodule
