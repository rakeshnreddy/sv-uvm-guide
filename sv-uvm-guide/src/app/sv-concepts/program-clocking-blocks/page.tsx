// app/sv-concepts/program-clocking-blocks/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const ProgramClockingBlocksPage = () => {
  const pageTitle = "Program and Clocking Blocks in SystemVerilog";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Concise definition of `program` blocks and `clocking` blocks, and their primary purpose in testbenches, from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Analogy for program blocks, e.g., "Think of a `program` block as the testbench's main script, operating in a separate region from the DUT to avoid races." For clocking blocks, e.g., "A `clocking` block is like a synchronized lens for viewing and driving DUT signals," from blueprint].</p>
      <p><strong>The "Why":</strong> [Placeholder: Problems solved by these constructs – separating testbench from DUT, ensuring race-free interaction with DUT signals, defining timing for testbench operations, from blueprint].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics of Program Blocks:</strong> [Placeholder: Detailed explanation of `program` block execution regions (reactive region), interaction with `module`s, `initial` blocks within programs, test termination, from blueprint].</p>
      <p><strong>Core Mechanics of Clocking Blocks:</strong> [Placeholder: How `clocking` blocks specify clock signals, input/output skews for signal sampling and driving, default skews, usage with modports, from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples:</h3>
      <CodeBlock
        code={`// Placeholder: Example of a program block from blueprint
program automatic test(interface dut_if);
  initial begin
    // Testbench stimulus
    dut_if.cb.data <= 8'hA5; // Using clocking block
    @(dut_if.cb); // Wait for clocking event
    $display("Driven data A5");
    // ... more stimulus and checking
    $finish;
  end
endprogram

// Placeholder: Example of a clocking block from blueprint
interface my_interface(input logic clk);
  logic        req;
  logic [7:0]  data;
  logic        ack;

  clocking cb @(posedge clk);
    default input #1step output #2; // Default skews
    output req, data;
    input ack;
  endclocking

  modport DUT (input clk, req, data, output ack);
  modport TB (input clk, ack, clocking cb); // Testbench uses clocking block
endinterface`}
        language="systemverilog"
        fileName="program_clocking_examples.sv"
      />
      <p className="mt-2">[Placeholder: Detailed explanation of the program and clocking block examples, highlighting skews, modport usage, and race avoidance, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="Program Block vs. Module Execution Regions" />
      <p>[Placeholder: Description of a diagram illustrating simulation regions and how program blocks help avoid races, from blueprint].</p>
      <DiagramPlaceholder title="Clocking Block Skew Timing Diagram" />
      <p>[Placeholder: Description of a timing diagram showing input/output skews for a clocking block, from blueprint].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Scenarios & Corner Cases:</strong> [Placeholder: Discussion of multiple clocking blocks, clocking block usage with assertions, interactions with `fork-join` in program blocks, final blocks, potential pitfalls, from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: Senior engineer's perspective on when and why to use program blocks (or when not to, e.g., in UVM testbenches where classes are primary). Best practices for defining clocking blocks for robust testbenches. Debugging timing issues related to clocking blocks, from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Tip for remembering the purpose of these blocks. E.g., "Program blocks = Testbench's 'safe zone'. Clocking blocks = 'Synchronized goggles' for DUT signals," from blueprint].</p>
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

export default ProgramClockingBlocksPage;
