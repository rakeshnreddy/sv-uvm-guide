import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock'; // Assuming CodeBlock is in its own file

export default function DataTypesTopicPage() {
  const pageContent = {
    title: "SystemVerilog Data Types",
    elevatorPitch: {
      definition: "SystemVerilog data types define the kind of data a variable, net, or parameter can hold, including its size and whether it can represent unknown (X) or high-impedance (Z) states. They are fundamental for modeling hardware behavior and constructing testbench components.",
      analogy: "Think of SystemVerilog data types like different kinds of containers. Some containers (like `bit`) are simple and only hold '0' or '1', like a light switch. Others (like `logic`) are more complex and can hold '0', '1', 'X' (unknown), or 'Z' (high-impedance), like a dimmer switch with an 'off' and 'disconnected' state. Arrays are like a shelf of these containers, and structs are like a custom box with labeled compartments for different types of items.",
      why: "Data types exist to accurately model the behavior of digital hardware, which involves various signal states (0, 1, X, Z) and different ways of organizing data (single bits, vectors, arrays, complex structures). In a professional setting, choosing the correct data type is crucial for creating efficient, accurate simulations, writing synthesizable RTL code, and building robust testbenches that can handle real-world hardware ambiguities."
    },
    practicalExplanation: {
      coreMechanics: `SystemVerilog offers a rich set of data types, broadly categorized into 2-state and 4-state types.
      - **4-State Types (logic, reg, integer, wire, etc.):** These can represent '0' (logic low), '1' (logic high), 'X' (unknown value, e.g., uninitialized or contention), and 'Z' (high-impedance, e.g., a tri-stated bus). 'logic' is a general-purpose 4-state type that can be driven by continuous assignments, procedural blocks, or gates. 'reg' is an older Verilog type, largely superseded by 'logic' in SystemVerilog for variable declaration. 'integer' is a 32-bit signed 4-state variable. 'wire' is a net type used to connect components and must be used for multiple drivers.
      - **2-State Types (bit, int, byte, shortint, longint):** These can only represent '0' or '1'. They are generally more memory-efficient and simulate faster than 4-state types. 'bit' is an unsigned single-bit type. 'int' is a 32-bit signed 2-state variable. These are often preferred for testbench data manipulation, loop counters, or when modeling parts of the design known not to require X or Z states (e.g., high-level models or testbench internal variables).

      SystemVerilog also provides powerful ways to structure data:
      - **Arrays:**
        - **Packed Arrays:** Treated as a single vector of bits with a defined MSB and LSB. Example: \`logic [7:0] packed_array;\` defines an 8-bit vector. Dimensions before the name are packed.
        - **Unpacked Arrays:** An array of elements, where each element can be of any data type (including other arrays or structs). Example: \`int unpacked_array[4];\` defines an array of 4 integers. Dimensions after the name are unpacked.
        - **Dynamic Arrays:** Unpacked arrays whose size can be changed at runtime. Example: \`int dyn_array[]; dyn_array = new[10];\`
        - **Associative Arrays:** Unpacked arrays that use a specific data type as an index (key) rather than an integer, useful for sparse collections or look-up tables. Example: \`int assoc_array[string]; assoc_array["error_count"] = 5;\`
        - **Queues:** Unpacked arrays that provide FIFO (First-In, First-Out) semantics, allowing easy addition and removal of elements from either end. Example: \`int q[$]; q.push_back(10);\`
      - **Structs (Structures):** Allow grouping of different data types under a single name, similar to C structs. They can be 'packed' (bits laid out contiguously in memory, allowing treatment as a single vector) or 'unpacked' (elements stored independently).
      - **Unions:** Allow a single piece of memory to be interpreted in multiple ways, using different data types. Can be 'packed' or 'tagged' (includes a tag field to indicate which member is active).
      - **Enums (Enumerations):** Define a set of named constants, improving code readability and maintainability. Example: \`typedef enum {IDLE, SEND, DONE} state_t;\`
      - **Type Aliases (typedef):** Allow creating custom names for data types, enhancing code clarity and reusability. Example: \`typedef logic [31:0] address_t;\``,
      codeExamples: [
        {
          description: "4-state vs 2-state types and basic vector declaration:",
          code:
`module data_type_examples;
  logic [3:0] four_state_vec; // Can be 0, 1, X, Z
  bit   [3:0] two_state_vec;  // Can only be 0, 1

  initial begin
    four_state_vec = 4'bX01Z;
    two_state_vec  = four_state_vec; // X and Z will be converted to 0
    $display("4-state: %b, 2-state: %b", four_state_vec, two_state_vec); // 4-state: x01z, 2-state: 0010

    logic my_logic_var; // Defaults to X
    bit   my_bit_var;   // Defaults to 0
    $display("Initial logic: %b, Initial bit: %b", my_logic_var, my_bit_var); // Initial logic: x, Initial bit: 0
  end
endmodule`
        },
        {
          description: "Packed vs. Unpacked Arrays and Dynamic Array:",
          code:
`module array_examples;
  logic [3:0][7:0] packed_array_2d; // A 4-element array, each element is an 8-bit packed vector. Total 32 bits.
                                    // Can be assigned as a whole: packed_array_2d = 32'h12345678;
  int unpacked_array[2][3];       // An unpacked array of 2 elements, each element is an unpacked array of 3 ints.

  logic [7:0] fixed_unpacked_array[4]; // Array of 4 bytes

  int dynamic_int_array[];          // Dynamic array of ints

  initial begin
    fixed_unpacked_array[0] = 8'hAA;
    $display("Fixed unpacked[0]: %h", fixed_unpacked_array[0]);

    dynamic_int_array = new[5]; // Allocate space for 5 integers
    foreach(dynamic_int_array[i]) dynamic_int_array[i] = i * 10;
    $display("Dynamic array size: %0d, contents: %p", dynamic_int_array.size(), dynamic_int_array);
    // Dynamic array size: 5, contents: '{10, 20, 30, 40, 50}

    dynamic_int_array = new[10](dynamic_int_array); // Resize, copy old contents
    $display("Resized Dynamic array size: %0d, contents: %p", dynamic_int_array.size(), dynamic_int_array);
    // Resized Dynamic array size: 10, contents: '{10, 20, 30, 40, 50, 0, 0, 0, 0, 0}

    dynamic_int_array.delete(); // Deallocate
    $display("Deleted Dynamic array size: %0d", dynamic_int_array.size()); // Deleted Dynamic array size: 0
  end
endmodule`
        },
        {
          description: "Associative Array and Queue:",
          code:
`module collection_examples;
  // Associative array: string index, int data
  int error_counts[string];
  // Queue of bytes
  byte my_queue[$];

  initial begin
    error_counts["CRC_ERROR"] = 5;
    error_counts["PACKET_TOO_SHORT"] = 2;
    if (error_counts.exists("CRC_ERROR")) begin
      $display("CRC Errors: %0d", error_counts["CRC_ERROR"]);
    end
    $display("Total error types: %0d", error_counts.num()); // Total error types: 2

    my_queue.push_back(8'hDE);
    my_queue.push_front(8'hAD);
    my_queue.push_back(8'hF0); // Queue: AD, DE, F0
    $display("Queue: %p", my_queue);

    byte item;
    item = my_queue.pop_front(); // item = AD, Queue: DE, F0
    $display("Popped: %h, Queue: %p", item, my_queue);
    my_queue.insert(1, 8'hBE); // Queue: DE, BE, F0
    $display("After insert: %p", my_queue);
  end
endmodule`
        },
        {
          description: "Struct (packed and unpacked) and Typedef:",
          code:
`module struct_typedef_examples;
  // Typedef for a pixel structure
  typedef struct packed {
    logic [7:0] r, g, b; // Packed: r,g,b are contiguous bits
  } pixel_packed_t;

  typedef struct {
    int x, y;
    pixel_packed_t color; // Unpacked struct contains a packed struct
  } pixel_location_t;

  pixel_packed_t red_pixel;
  pixel_location_t cursor_pos;

  initial begin
    red_pixel = '{r:8'hFF, g:8'h00, b:8'h00}; // Can also do red_pixel = 24'hFF0000;
    $display("Red pixel (packed): r=%h, g=%h, b=%h, as hex: %h", red_pixel.r, red_pixel.g, red_pixel.b, red_pixel);
    // Red pixel (packed): r=ff, g=00, b=00, as hex: ff0000

    cursor_pos = '{x:100, y:200, color:'{r:0, g:255, b:0}};
    $display("Cursor: x=%0d, y=%0d, color.g=%h", cursor_pos.x, cursor_pos.y, cursor_pos.color.g);
    // Cursor: x=100, y=200, color.g=ff
  end

  // Enum example
  typedef enum logic [1:0] { IDLE, FETCH, DECODE, EXECUTE } cpu_state_e;
  cpu_state_e current_state = IDLE;

  initial begin
    #10 current_state = FETCH;
    $display("Current CPU state: %s", current_state.name()); // Current CPU state: FETCH
  end
endmodule`
        }
      ],
      visualizations: [
        { description: "Conceptual difference between packed and unpacked arrays.", altText: "Packed vs Unpacked Array Diagram" },
        { description: "Memory layout of a packed struct vs an unpacked struct.", altText: "Packed vs Unpacked Struct Diagram" }
      ]
    },
    deepDive: {
      advancedScenarios: "Common bugs often arise from misunderstanding 4-state vs 2-state logic, especially during X-propagation in simulation or when interfacing with models that don't preserve X's. Forgetting to initialize 'logic' variables can lead to 'X' values propagating unexpectedly. With arrays, out-of-bounds access is a classic issue, though SystemVerilog's foreach and dynamic array methods help. Packed structs are great for type-safe access to bit-fields in registers, but care is needed with endianness if interfacing with external C models via DPI. Using 'logic' for synthesizable flip-flop outputs that should never be 'X' or 'Z' can sometimes hide design issues if not properly reset; 'bit' might be too optimistic here if reset is asynchronous or complex.",
      experienceView: `A senior engineer thinks about data types in terms of:
      1.  **Intent & Abstraction:** Does this variable represent hardware signals (likely 'logic'), or is it purely for testbench computation (often 'int' or 'bit' for speed and memory)? Typedefs and structs are heavily used to create higher-level abstractions like 'packet_t', 'config_t'.
      2.  **Performance & Memory:** For large data sets in testbenches (e.g., millions of transactions), 2-state types and dynamic arrays/queues are preferred. Associative arrays are used for sparse data or when lookup speed is critical.
      3.  **Synthesis:** Only certain types and constructs are synthesizable. 'logic' is generally fine, 'integer' might be, but 'real', 'string', dynamic arrays, associative arrays, and queues are primarily for verification. Packed arrays and structs are synthesizable.
      4.  **Debuggability:** Well-named types and structs make waveforms and debug output much easier to understand.
      5.  **X-Safety:** How should 'X's and 'Z's propagate? For DUT models, 4-state is often necessary. For testbenches, it's a balance. Sometimes you want X's to propagate to catch issues; other times, you want to convert them to known values to avoid test failures on unrelated logic.
      In code reviews, questions related to data types include: "Is this the most appropriate type for its purpose?", "Could this 'logic' be a 'bit' for performance?", "Is this array sized appropriately, or should it be dynamic?", "Does this struct need to be packed for register modeling?", "How are uninitialized values handled?"`,
      retentionTip: "To remember data types, categorize them: **Signal Nature** (2-state vs 4-state: 'bit' for clean, 'logic' for messy reality), **Structure** (Scalar, Array, Struct, Union: single item, list, custom box, multi-tool), and **Flexibility** (Fixed, Dynamic, Associative: set size, resizable, smart lookup). Regularly ask 'Why this type here?' when reading SV code."
    }
  };

  return <TopicPage {...pageContent} />;
}
