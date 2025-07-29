// Test file for F2_SystemVerilog_Basics examples

module data_type_example;
  logic my_variable; // A single bit 4-state variable
  logic [7:0] my_vector; // An 8-bit vector (from bit 7 down to 0)

  initial begin
    my_variable = 'z; // Assign high-impedance
    $display("my_variable is %b", my_variable);

    my_vector = 8'b1010_XXXX; // Assign a value with unknown bits
    $display("my_vector is %h", my_vector);
  end
endmodule

module integer_example;
  initial begin
    int cycle_count = 0;
    for (cycle_count = 0; cycle_count < 5; cycle_count++) begin
      $display("Cycle: %0d", cycle_count);
    end
  end
endmodule

module array_example;
  logic [7:0] fixed_array [4]; // A fixed-size array of 4 8-bit logic vectors
  int         dynamic_array[]; // A dynamic array of integers

  initial begin
    // Initialize fixed-size array
    fixed_array[0] = 8'hAA;
    fixed_array[3] = 8'h55;
    $display("fixed_array[0] = %h", fixed_array[0]);

    // Initialize and use dynamic array
    dynamic_array = new[3]; // Allocate space for 3 integers
    dynamic_array = '{10, 20, 30};
    $display("Dynamic array size: %0d, contents: %p", dynamic_array.size(), dynamic_array);
  end
endmodule

module operator_example;
  logic [3:0] a = 4'b1010;
  logic [3:0] b = 4'b0101;

  initial begin
    // Logical AND: (a is non-zero, b is non-zero) -> TRUE
    if (a && b) $display("Logical AND is TRUE");

    // Bitwise AND: 1010 & 0101 -> 0000
    $display("Bitwise AND: %b", a & b);
  end
endmodule

module equality_example;
  logic [3:0] a = 4'b101X;
  logic [3:0] b = 4'b101X;
  logic [3:0] c = 4'b1010;

  initial begin
    // Standard equality with X results in X (unknown)
    $display("a == b: %b", a == b);

    // Case equality checks for an exact bit-for-bit match
    $display("a === b: %b", a === b);
    $display("a === c: %b", a === c);
  end
endmodule

module my_module;
  // Your code goes here
endmodule

`timescale 1ns/1ps

module display_example;
  initial begin
    $write("Time: %0t: ", $time);
    $display("Starting simulation...");
    #10;
    $write("Time: %0t: ", $time);
    $display("Finished after 10ns.");
  end
endmodule
