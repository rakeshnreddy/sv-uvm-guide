// Test file for F5_Intro_to_OOP_in_SV examples

// Define the blueprint for a simple packet
class MyPacket;
  int data;
endclass

module test_oop;
  initial begin
    // 1. Declare a handle for a MyPacket object.
    // At this point, the handle is 'null', it doesn't point to any object.
    MyPacket pkt_h;

    // 2. Create a MyPacket object in memory and assign its address to the handle.
    pkt_h = new();

    // 3. Use the handle to access the object's properties.
    pkt_h.data = 100;
    $display("Packet data is: %0d", pkt_h.data);
  end
endmodule

class AluTransaction;

  // --- Properties (the data) ---
  rand logic [3:0] a;
  rand logic [3:0] b;
  rand enum {ADD, SUB} opcode;

  // --- Constraint (the rules for randomization) ---
  constraint c_a_not_zero { a != 0; }

  // --- Methods (the behavior) ---

  // The constructor: called when we do "new()"
  function new();
    // We can set default values here if we want
    this.opcode = ADD;
  endfunction

  // A display method
  function void print();
    $display("Transaction: a=%h, b=%h, opcode=%s", a, b, opcode.name());
  endfunction

endclass

module test_randomization;
  initial begin
    AluTransaction tx = new();
    for (int i = 0; i < 5; i++) begin
      if (tx.randomize()) begin
        tx.print();
      end
    end
  end
endmodule

// 2. Use the class in a module
module test_oop_flow;
  initial begin
    // Create a handle
    AluTransaction tx;

    // Create an object
    tx = new();

    // Randomize the object
    if (tx.randomize()) begin
      // Use the object's methods
      tx.print();
    end else begin
      $display("Randomization failed!");
    end
  end
endmodule
