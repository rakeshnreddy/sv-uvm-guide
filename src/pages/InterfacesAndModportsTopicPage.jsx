import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function InterfacesAndModportsTopicPage() {
  const pageContent = {
    title: "SystemVerilog Interfaces & Modports",
    elevatorPitch: {
      definition: "Interfaces in SystemVerilog are reusable bundles of signals, parameters, tasks, functions, and clocking blocks that encapsulate communication protocols or signal groups. Modports (mode ports) are defined within an interface to specify the directionality of these signals from the perspective of a connecting module (e.g., DUT or testbench).",
      analogy: "Think of an **interface** like a standardized multi-pin connector (e.g., a USB connector). Instead of connecting dozens of individual wires between two devices (modules), you just plug in the USB connector. It bundles power, data, and control signals. A **modport** is like looking at that USB connector from one device's point of view. From your laptop's perspective (one modport), certain pins are inputs (receiving data) and others are outputs (sending data). From a connected USB drive's perspective (a different modport), those directions are reversed.",
      why: "Interfaces exist to simplify module connections, enhance reusability, and improve code maintainability. They reduce the clutter of long port lists in module definitions, making it easier to connect complex components. Modports ensure that these connections are made correctly by enforcing directionality, preventing common errors like connecting an output to an output. This is crucial in professional settings for managing large designs and enabling Verification IP (VIP) reuse."
    },
    practicalExplanation: {
      coreMechanics: `
**Interfaces (\`interface ... endinterface\`):**
-   **Purpose:** To group related signals, constants, methods (tasks/functions), clocking blocks, and even other interfaces that define a communication channel or a standard set of connections.
-   **Contents:**
    -   **Signals:** \`logic\`, \`bit\`, \`wire\`, etc. These are the actual communication wires.
    -   **Parameters:** For configurability (e.g., bus width).
    -   **Tasks & Functions:** Can define protocol-specific operations directly within the interface (e.g., \`read_data()\`, \`write_data()\`).
    -   **Clocking Blocks:** Define synchronous sampling/driving behavior for testbenches or transactors.
    -   **Modports:** Define directional views of the interface.
    -   **Assertions (Properties & Sequences):** Can embed protocol checks directly.
-   **Instantiation:** An interface is instantiated like a module (e.g., \`my_bus_if bus_inst(clk);\`). This single instance can then be passed through module ports.
-   **Ports:** Modules connect to an interface instance via an interface port (e.g., \`module my_dut(my_bus_if bus_port);\`).

**Modports (\`modport <name> (...)\`):**
-   **Purpose:** To define a specific directional view (or 'mode') of the signals within an interface. This allows the same interface to be used by different components (e.g., a DUT, a testbench driver, a monitor) with appropriate signal directions.
-   **Definition:** Defined *inside* an interface.
    -   \`modport <modport_name> (input sig1, sig2, output sig3, clocking cb_name);\`
-   **Directionality:** Specifies if signals are \`input\`, \`output\`, or \`inout\` from the perspective of the module *using* that modport.
-   **Bundling Clocking Blocks:** Modports can also export clocking blocks, making them accessible to the connecting module.
-   **Usage in Module Ports:** When a module connects to an interface, it specifies which modport it's using.
    -   \`module my_dut(my_bus_if.DUT_MP bus);\` // DUT uses the 'DUT_MP' modport of my_bus_if
    -   \`program my_test(my_bus_if.TB_MP bus);\` // Testbench uses the 'TB_MP' modport

**Benefits:**
-   **Reduced Port Clutter:** Replaces long lists of individual signals with a single interface port.
-   **Encapsulation:** Groups all aspects of a protocol (signals, timing, methods) in one place.
-   **Reusability:** A defined interface can be reused across many designs and testbenches.
-   **Type Safety & Error Prevention:** Modports enforce correct signal directions at compile time, catching connection errors early.
-   **Abstraction:** Allows modules to interact with a protocol at a higher level of abstraction without needing to know every individual signal.
`,
      codeExamples: [
        {
          description: "Basic Interface with two modports (for a DUT and a Testbench):",
          code:
`interface simple_bus_if (input logic clk);
  // Signals in the interface
  logic [7:0] data;
  logic       valid;
  logic       ready;

  // Modport for the Design Under Test (DUT)
  modport DUT (
    input  clk, data, valid, // DUT receives data and valid
    output ready             // DUT drives ready
  );

  // Modport for the Testbench (TB)
  modport TB (
    input  clk, ready,      // TB receives ready
    output data, valid      // TB drives data and valid
  );

  // Example task within interface (accessible via interface instance)
  task write(input [7:0] val_to_write);
    @(posedge clk);
    // Assume TB modport context for driving
    // In a real scenario, you'd use clocking blocks for precise timing
    data  = val_to_write;
    valid = 1'b1;
    wait (ready == 1'b1); // Wait for DUT to be ready
    @(posedge clk);
    valid = 1'b0;
    data = 'x; // Stop driving
  endtask

endinterface

// DUT using the 'DUT' modport
module my_device (simple_bus_if.DUT bus); // Connects to the DUT modport
  always_ff @(posedge bus.clk) begin
    if (bus.valid && bus.ready) begin
      $display("@%0t: DUT received data: %h", $time, bus.data);
    end
  end

  // Simple ready logic: always ready for this example
  assign bus.ready = 1'b1;
endmodule

// Testbench (program block) using the 'TB' modport
program test (simple_bus_if.TB bus); // Connects to the TB modport
  initial begin
    $display("@%0t: Test started.", $time);
    #5;
    // Call task defined in the interface
    bus.write(8'hAA);
    bus.write(8'hBB);
    $display("@%0t: Test finished.", $time);
  end
endprogram

// Top module to connect everything
module top_interface_example;
  logic clk = 0;
  always #5 clk = ~clk; // Clock generator

  simple_bus_if s_bus_if_inst(clk); // Instantiate the interface

  my_device device_inst (.bus(s_bus_if_inst));  // Connect DUT using its modport
  test      tb_inst     (.bus(s_bus_if_inst));  // Connect Testbench using its modport
endmodule`
        },
        {
          description: "Interface with a Clocking Block and Modports exporting it:",
          code:
`interface apb_if (input logic pclk, input logic prst_n);
  // APB Signals
  logic [31:0] paddr;
  logic        psel;
  logic        penable;
  logic        pwrite;
  logic [31:0] pwdata;
  logic [31:0] prdata;
  logic        pready;
  logic        pslverr;

  // Clocking block for a testbench master
  clocking master_cb @(posedge pclk);
    default input #1step output #0ns; // Sensible defaults for a master
    output paddr, psel, penable, pwrite, pwdata;
    input  prdata, pready, pslverr;
  endclocking

  // Clocking block for a testbench monitor/slave (passive)
  clocking monitor_cb @(posedge pclk);
    default input #1step output #2ns; // Monitor might have different skews or be passive
    input paddr, psel, penable, pwrite, pwdata;
    input prdata, pready, pslverr;
  endclocking

  // Modport for the APB DUT (Slave)
  modport DUT (
    input pclk, prst_n, paddr, psel, penable, pwrite, pwdata,
    output prdata, pready, pslverr
  );

  // Modport for an active APB Testbench Master
  modport MasterTB (
    input pclk, prst_n,
    clocking master_cb // Export the master clocking block
  );

  // Modport for a passive APB Testbench Monitor
  modport MonitorTB (
    input pclk, prst_n,
    clocking monitor_cb // Export the monitor clocking block
  );
endinterface

// Example Program using the MasterTB modport
program apb_master_test(apb_if.MasterTB apb);
  initial begin
    // Reset sequence (simplified)
    @(posedge apb.pclk);
    apb.master_cb.psel <= 1'b0;
    apb.master_cb.penable <= 1'b0;
    // ...
    #20;
    $display("APB Master Test: Driving an APB write via clocking block master_cb");
    @(apb.master_cb); // Sync to clock
    apb.master_cb.paddr  <= 32'h1000;
    apb.master_cb.pwdata <= 32'hDEADBEEF;
    apb.master_cb.pwrite <= 1'b1;
    apb.master_cb.psel   <= 1'b1;
    @(apb.master_cb);
    apb.master_cb.penable <= 1'b1;
    // Wait for pready using clocking block sampling
    wait (apb.master_cb.pready == 1'b1);
    $display("APB Master Test: Write acknowledged by slave (pready=1)");
    @(apb.master_cb);
    apb.master_cb.psel    <= 1'b0;
    apb.master_cb.penable <= 1'b0;
    // ...
  end
endprogram
// DUT and Top module would be similar to previous examples, connecting to respective modports.
`
        }
      ],
      visualizations: [
        { description: "Diagram showing a module with many individual ports vs. a module using a single interface port.", altText: "Module Ports vs Interface Port" },
        { description: "Diagram illustrating an interface with two modports (DUT, TB) showing opposite signal directions.", altText: "Interface with DUT and TB Modports" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **Generic Interfaces with Parameters:** Interfaces can be parameterized (e.g., \`interface #(parameter DATA_WIDTH = 8) my_if (...)\`) making them highly reusable for different bus widths or configurations.
      - **Tasks/Functions in Interfaces:** These can encapsulate protocol-specific operations (e.g., \`read_transaction()\`, \`write_transaction()\`). They operate on the interface signals. Care must be taken with timing if they are called from different clock domains or contexts (e.g., from a module vs. a program block). Often, tasks in interfaces are blocking and intended for use by testbench components.
      - **Virtual Interfaces:** Used in class-based verification environments (like UVM) to allow classes (which cannot directly have interface ports) to access interface signals. A virtual interface is essentially a typed reference/pointer to an actual interface instance.
      - **`generate` blocks in Interfaces:** Can be used to conditionally include signals or logic within an interface based on parameters.
      - **Nested Interfaces:** An interface can instantiate other interfaces, though this is less common.
      - **Modport expressions:** Signal lists in modports can use expressions (e.g. \`output bus.req\`), though simple signal names are more common.
      - **Empty Modports or Modports with only a clocking block:** Useful for scenarios where only tasks/functions or clocking block access is needed.
      Common Pitfalls:
      - Connecting to the wrong modport or forgetting to specify a modport (compiler usually catches this).
      - Defining tasks/functions in an interface that have hidden timing assumptions which are violated when called from different contexts.
      - Overly complex interfaces that try to do too much, violating separation of concerns.
      - Forgetting to pass parameters correctly when instantiating parameterized interfaces.`,
      experienceView: `A senior engineer relies heavily on interfaces and modports for structuring complex verification environments.
      - **Standardization:** They are key for defining and using standard bus protocols (AMBA, Ethernet, etc.) and for internal IP communication.
      - **Verification IP (VIP):** Most commercial and internal VIP are delivered with SystemVerilog interfaces and modports to facilitate easy integration.
      - **Layered Approach:** Interfaces form the physical layer connection; classes using virtual interfaces then build protocol and transaction layers on top.
      - **Clarity and Maintainability:** Well-designed interfaces significantly improve the readability and maintainability of both RTL and testbench code.
      - **Configuration:** Parameters in interfaces are used extensively to configure bus widths, address sizes, presence of optional signals, etc.
      In code reviews: "Is this a standard protocol? If so, does the interface match the spec?", "Are the modport directions correct for each connected component?", "Could these signals be bundled into an existing interface or a new one?", "Are tasks/functions in the interface truly generic or tied to a specific component's behavior?", "Is the clocking block correctly defined and exported via the modport for testbench use?"`,
      retentionTip: "Remember: **Interface** = The 'Cable' (bundles many wires). **Modport** = The 'Socket View' (defines which pins are In/Out for *this* device). Always ask: 'From this module's point of view, are these signals coming in or going out?' – that defines your modport."
    }
  };

  return <TopicPage {...pageContent} />;
}
