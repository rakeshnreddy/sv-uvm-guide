import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function ClassBasedTestbenchesTopicPage() {
  const pageContent = {
    title: "SystemVerilog Class-Based Testbenches",
    elevatorPitch: {
      definition: "Class-based testbenches in SystemVerilog leverage Object-Oriented Programming (OOP) principles to create modular, reusable, and scalable verification environments. Components like stimulus generators, drivers, monitors, and scoreboards are encapsulated as classes, which can then be instantiated, configured, and connected dynamically at runtime.",
      analogy: "Think of building a complex LEGO model. A traditional, non-class-based testbench is like having a single, massive instruction sheet where every tiny step for every part is listed sequentially – very rigid and hard to change. A class-based testbench is like having pre-designed LEGO kits for different sections (e.g., 'engine kit,' 'wheel assembly kit,' 'chassis kit'). Each kit (class) is self-contained and can be built (instantiated) independently. You can then easily combine these kits, use multiple engine kits, or swap out one wheel assembly for another, more advanced one, to build many different models (test scenarios).",
      why: "Class-based testbenches exist to manage the immense complexity of verifying modern SoCs. As designs grow, purely procedural or module-based testbenches become unwieldy, difficult to maintain, and hard to reuse. OOP features like encapsulation (hiding internal details), inheritance (creating specialized components from base ones), and polymorphism (using different objects through a common interface) allow verification engineers to build sophisticated, layered testbenches that are easier to develop, debug, scale, and reuse across different projects and DUT versions."
    },
    practicalExplanation: {
      coreMechanics: `Key OOP concepts used in SystemVerilog class-based testbenches:
-   **Classes (\`class ... endclass\`):** Blueprints for creating objects. They encapsulate data (properties/members) and behavior (methods: tasks/functions).
    -   **Properties:** Variables that hold the state of an object (e.g., \`int pkt_count;\`, \`string name;\`).
    -   **Methods:** Tasks and functions that operate on the object's data or define its behavior (e.g., \`task send_packet();\`, \`function get_status();\`).
    -   **Constructor (\`function new(...);\`)**: A special method called when an object is created (\`my_obj = new();\`). Used for initialization.

-   **Objects:** Instances of classes. Each object has its own copy of class properties (unless static).
    -   Created using \`new()\`. Handle variables store references to objects.
    -   Example: \`my_driver_class driver_h; driver_h = new();\`

-   **Encapsulation:** Bundling data and methods within a class and controlling access to internal members.
    -   Access Modifiers: \`local\` (visible only within the class), \`protected\` (visible within the class and derived classes), \`public\` (default, visible everywhere).

-   **Inheritance (\`class DerivedClass extends BaseClass; ... endclass\`):**
    -   Allows a new class (derived/child) to inherit properties and methods from an existing class (base/parent).
    -   Promotes code reuse and creating specialized versions of components.
    -   \`super.method_name()\` can be used to call the base class version of a method.

-   **Polymorphism (\`virtual methods\`):**
    -   Allows objects of different derived classes to be treated as objects of a common base class, typically through a base class handle.
    -   If a method is declared \`virtual\` in the base class and overridden in derived classes, calling the method on a base class handle that points to a derived object will execute the derived class's version.
    -   This is fundamental for UVM's factory override mechanism and for creating flexible test environments.

-   **Handles and Casting:**
    -   Class variables are handles (pointers/references) to objects.
    -   \`$cast(dest_handle, source_handle)\`: Safely attempts to assign a base class handle to a derived class handle (or vice-versa if compatible).

-   **Static Members:** Properties or methods declared \`static\` belong to the class itself, not to instances. There's only one copy shared by all objects of that class. Accessed via class scope resolution operator (e.g., \`MyClass::static_var\`).

-   **Virtual Interfaces:** Used to provide class-based components (which cannot directly instantiate interfaces) access to the physical signals of an interface instance in the static module-based world.

**Typical Class-Based Testbench Components:**
-   **Transaction/Sequence Item:** A class representing a data item to be sent to/from the DUT (e.g., a network packet, a bus transaction). Often includes randomization capabilities.
-   **Generator/Sequencer:** Creates sequences of transactions.
-   **Driver:** Takes transactions from the generator and drives them onto the DUT's interface signals according to protocol timing.
-   **Monitor:** Observes DUT interface signals, captures activity, and converts it back into transactions. Broadcasts these observed transactions.
-   **Scoreboard/Checker:** Receives transactions from monitors (and possibly a reference model) and verifies DUT behavior (e.g., data integrity, protocol compliance).
-   **Environment:** A top-level class that instantiates and connects these components (generator, driver, monitor, scoreboard).
-   **Test:** Configures the environment and initiates stimulus generation for a specific test scenario.

These components communicate using mailboxes, events, or TLM (Transaction-Level Modeling) ports/exports, especially in UVM.
`,
      codeExamples: [
        {
          description: "Simple Transaction Class and a basic Driver Class:",
          code:
`// Transaction class
class simple_packet;
  rand bit [7:0] data;
  rand bit [3:0] addr;
  bit is_write;

  // Constraint for randomization (more in Randomization topic)
  constraint c_addr_align { addr[1:0] == 2'b00; }

  function new(bit is_write = 0);
    this.is_write = is_write;
  endfunction

  function void print(string prefix = "");
    $display("%sPacket: Addr=0x%h, Data=0x%h, Write=%b", prefix, addr, data, is_write);
  endfunction
endclass

// Basic Driver class (needs an interface to drive)
class basic_driver;
  string name;
  virtual my_bus_if vif; // Virtual interface handle

  mailbox #(simple_packet) mbx_to_driver; // Mailbox to get packets

  function new(string name = "basic_driver", virtual my_bus_if vif_handle);
    this.name = name;
    this.vif = vif_handle; // Get virtual interface from constructor
    this.mbx_to_driver = new(); // Create mailbox
  endfunction

  task run();
    $display("%s: Driver run task started.", name);
    forever begin
      simple_packet pkt_to_drive;
      mbx_to_driver.get(pkt_to_drive); // Blocking get from mailbox
      pkt_to_drive.print($sformatf("%s: Driving ", name));
      drive_to_bus(pkt_to_drive);
    end
  endtask

  // Task to drive packet onto the virtual interface (simplified)
  virtual task drive_to_bus(simple_packet pkt);
    if (vif == null) begin $error("VIF not set for driver %s", name); return; end
    // Assuming 'cb' is a clocking block in my_bus_if
    @(vif.cb);
    vif.cb.addr <= pkt.addr;
    vif.cb.data <= pkt.data;
    vif.cb.write_en <= pkt.is_write;
    vif.cb.valid <= 1'b1;
    @(vif.cb);
    vif.cb.valid <= 1'b0;
    $display("%s: Packet driven.", name);
  endtask
endclass

// Dummy interface for context
interface my_bus_if(input logic clk);
  logic [3:0] addr;
  logic [7:0] data;
  logic write_en;
  logic valid;
  clocking cb @(posedge clk); // Simplified clocking block
    output addr, data, write_en, valid;
  endclocking
endinterface

// Top module to set up and run (simplified test)
module top_class_tb;
  logic clk = 0;
  always #5 clk = ~clk;

  my_bus_if bus_if_inst(clk); // Instantiate physical interface

  initial begin
    basic_driver driver0;
    simple_packet pkt_sent;

    // Set the virtual interface for the testbench
    // In UVM, this is done via uvm_config_db
    // Here, we pass it to constructor
    driver0 = new("Driver0", bus_if_inst);

    // Fork off the driver's main execution loop
    fork
      driver0.run();
    join_none

    // Send a few packets
    for (int i=0; i<2; i++) begin
      #10;
      pkt_sent = new(.is_write(i%2));
      void'(pkt_sent.randomize() with { data == 8'hAA + i; }); // Randomize
      driver0.mbx_to_driver.put(pkt_sent); // Send to driver via mailbox
      pkt_sent.print("Test: Sent ");
    end
    #50;
    $finish;
  end
endmodule`
        },
        {
          description: "Inheritance and Polymorphism (Virtual Methods):",
          code:
`class base_generator;
  string name = "base_gen";
  virtual function simple_packet create_packet(); // Virtual method
    $display("%s: Creating a generic packet.", name);
    return new(); // Returns a base simple_packet
  endfunction

  virtual task run_stimulus(basic_driver drv_h);
    simple_packet pkt;
    for (int i=0; i<3; i++) begin
      pkt = create_packet(); // Calls virtual create_packet()
      void'(pkt.randomize());
      drv_h.mbx_to_driver.put(pkt);
      pkt.print($sformatf("%s: Generated ", name));
      #20;
    end
  endtask
endclass

class error_inject_generator extends base_generator;
  function new();
    name = "error_gen";
  endfunction

  // Override the virtual method
  virtual function simple_packet create_packet();
    simple_packet err_pkt;
    $display("%s: Creating a packet and forcing data to 0xEE.", name);
    err_pkt = new();
    void'(err_pkt.randomize() with {data == 8'hEE;});
    return err_pkt;
  endfunction
endclass

module top_polymorphism;
  // ... (clk, my_bus_if, basic_driver as before) ...
  my_bus_if bus_if_inst(clk);
  logic clk = 0;
  always #5 clk = ~clk;

  initial begin
    basic_driver my_driver = new("MyDriver", bus_if_inst);
    base_generator gen_h; // Base class handle
    error_inject_generator err_gen_obj = new();

    fork my_driver.run(); join_none

    // Test 1: Use base generator
    $display("--- Using Base Generator ---");
    gen_h = new(); // Points to base_generator object
    gen_h.run_stimulus(my_driver);
    #100;

    // Test 2: Use error_inject_generator via base handle
    $display("--- Using Error Inject Generator (via base handle) ---");
    gen_h = err_gen_obj; // Base handle points to derived object
    gen_h.run_stimulus(my_driver); // Calls error_inject_generator's create_packet()
    #100;
    $finish;
  end
endmodule`
        }
      ],
      visualizations: [
        { description: "Block diagram of a typical class-based testbench architecture (Generator, Driver, Monitor, Scoreboard, Environment).", altText: "Class-Based Testbench Architecture" },
        { description: "UML diagram showing class inheritance (e.g., base_driver -> specific_protocol_driver).", altText: "Class Inheritance Diagram" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **Parameterized Classes:** Classes can be parameterized with types or values (\`class my_class #(type T = int, int WIDTH = 8); ... endclass\`), increasing reusability.
      - **Abstract Classes and Pure Virtual Methods:** An abstract class (\`virtual class ...\`) cannot be instantiated directly. It may contain \`pure virtual\` methods, which *must* be implemented by derived concrete classes. This defines an interface contract.
      - **Singleton Classes:** Classes designed to have only one instance (e.g., a central configuration object or a report server). Often implemented using a static local instance and a static \`get_instance()\` method.
      - **Inter-component Communication:** Beyond mailboxes, UVM uses TLM (Transaction-Level Modeling) ports, exports, and imps for standardized, type-safe communication between components. Events and semaphores are also used for synchronization.
      - **Deep Copy vs. Shallow Copy:** When copying objects, understanding if it's a shallow copy (only handle copied) or a deep copy (new object created with members copied) is crucial. Classes often implement a \`copy()\` or \`clone()\` method.
      - **Memory Management:** SystemVerilog classes are dynamically allocated. While it has garbage collection, explicit cleanup (e.g., breaking circular references, nullifying handles) can be important in very long simulations to manage memory.
      - **Factories (as in UVM):** A central mechanism to create objects by type, allowing easy overriding of component types at runtime without changing the environment code.
      Common Pitfalls:
      - Null handle errors: Accessing methods or properties of an object handle that hasn't been \`new\`'d.
      - Forgetting to make methods \`virtual\` when polymorphism is intended.
      - Issues with \`super\` calls in constructors or overridden methods.
      - Complexity in managing virtual interface connections to numerous class instances.
      - Accidental shallow copies when a deep copy was needed for transaction objects.`,
      experienceView: `A senior engineer working with class-based testbenches (especially UVM) thinks in terms of:
      - **Modularity & Reusability:** "How can I design this component (e.g., driver, monitor) so it can be easily reused for other protocols or DUTs with minimal changes?" This involves using base classes, parameterization, and clear interfaces.
      - **Layering & Abstraction:** Building layers of abstraction (e.g., physical, transaction, command layers) to manage complexity.
      - **Configuration Management:** How are components configured for different tests? (e.g., UVM config_db, plusargs, parameters).
      - **Scalability:** Will this architecture scale as the DUT complexity or the number of interfaces grows?
      - **Debuggability:** Designing components to be easily debugged, with good logging, clear state representation, and hooks for transaction viewing.
      - **Standardization (UVM):** Adhering to UVM base classes and methodology ensures interoperability with VIP and standard tools.
      In code reviews: "Is this class well-encapsulated?", "Should this method be virtual?", "Is inheritance being used effectively here, or is composition better?", "How is this component configured and connected?", "Is this object's lifecycle (creation, usage, destruction) clear?", "Are there potential null handle issues?". They promote design patterns that lead to robust and maintainable verification environments.`,
      retentionTip: "Class-Based Testbenches = Building with smart, reusable 'Verification LEGO Kits.' Each 'Kit' (Class) has its own 'Parts' (Properties) and 'Instructions' (Methods). You can 'Extend' kits (Inheritance) or use different 'Specialized Kits' interchangeably if they fit the same 'Base Pegs' (Polymorphism via Virtual Methods)."
    }
  };

  return <TopicPage {...pageContent} />;
}
