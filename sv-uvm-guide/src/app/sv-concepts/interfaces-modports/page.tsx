// app/sv-concepts/interfaces-modports/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const InterfacesModportsPage = () => {
  const pageTitle = "Interfaces and Modports in SystemVerilog";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Clear definition of SystemVerilog `interface`s as bundles of signals and `modport`s as defining directionality and views into an interface, from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Analogy for interfaces, e.g., "Think of an interface like a multi-pin connector (e.g., USB) that groups related wires." For modports, "Modports are like specifying which pins on the connector are for input, output, or bidirectional from the perspective of the connected device," from blueprint].</p>
      <p><strong>The "Why":</strong> [Placeholder: Core problem interfaces solve – reducing port connection complexity in complex designs, promoting reusable verification IP, simplifying connections between DUT and testbench, from blueprint].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics of Interfaces:</strong> [Placeholder: Detailed explanation of defining an interface, including signals, parameters, tasks, functions, and clocking blocks within interfaces. Instantiating interfaces, from blueprint].</p>
      <p><strong>Core Mechanics of Modports:</strong> [Placeholder: How modports specify signal directions (`input`, `output`, `inout`) from the perspective of the module/program using the interface. Defining modports for DUT and Testbench. Connecting modules using interfaces and modports, from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples:</h3>
      <CodeBlock
        code={`// Placeholder: Example of an interface definition from blueprint
interface bus_if (input logic clk, input logic reset);
  logic [7:0] data;
  logic valid;
  logic ready;

  // Modport for the DUT (master)
  modport DUT (
    input clk, reset, ready,
    output data, valid
  );

  // Modport for the Testbench (slave/monitor)
  modport TB (
    input clk, reset, data, valid,
    output ready
  );

  // Clocking block for testbench synchronization (optional, often good practice)
  clocking monitor_cb @(posedge clk);
    input data, valid, ready;
  endclocking

  modport Monitor (input clk, clocking monitor_cb);

endinterface

// Placeholder: Instantiating and connecting using the interface from blueprint
module my_dut (bus_if.DUT bus);
  // DUT logic using bus.data, bus.valid, bus.ready
endmodule

module testbench_top;
  logic clk = 0;
  logic reset;

  always #5 clk = ~clk; // Simple clock generator

  bus_if main_bus(clk, reset); // Instantiate the interface

  my_dut dut (.bus(main_bus)); // Connect DUT using DUT modport

  test my_test (main_bus.TB); // Connect test program block using TB modport
  // Or: my_monitor mon (main_bus.Monitor);

initial begin
    reset = 1; #20; reset = 0;
    // ...
  end
endmodule`}
        language="systemverilog"
        fileName="interfaces_modports_examples.sv"
      />
      <p className="mt-2">[Placeholder: Detailed explanation of the interface, modports, instantiation, and connection, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="Interface Connection Diagram" />
      <p>[Placeholder: Description of a block diagram showing a DUT and Testbench connected via an interface, highlighting modport perspectives, from blueprint].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Scenarios & Corner Cases:</strong> [Placeholder: Discussion of generic interfaces using parameters, tasks/functions in interfaces, virtual interfaces for class-based testbenches, `export`/`import` with interfaces, common connection errors, from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: Senior engineer's perspective on designing robust and reusable interfaces. How interface design impacts UVM environment development. When to use tasks/functions in interfaces vs. in classes. Debugging connectivity issues, from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Tip for remembering interface/modport concepts. E.g., "Interface = The Cable. Modport = The Socket (labeled for 'this side's' connections)," from blueprint].</p>
    </>
  );

  return (
    <TopicPage
      title={pageTitle}
      level1Content={level1Content}
      level2Content={level2Content}
      level3Content={level3Content}
    />
  );
};

export default InterfacesModportsPage;
