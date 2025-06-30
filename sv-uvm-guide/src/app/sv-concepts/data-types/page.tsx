// app/sv-concepts/data-types/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage"; // For placeholder visuals

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const DataTypesPage = () => {
  const pageTitle = "SystemVerilog Data Types";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Clear, concise definition of SystemVerilog data types from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Simple, memorable analogy for data types from blueprint. E.g., &quot;Think of data types like different kinds of containers for information...&quot;].</p>
      <p><strong>The &quot;Why&quot;:</strong> [Placeholder: Core problem data types solve from blueprint. Why do they exist in hardware design and verification?].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics:</strong> [Placeholder: Detailed explanation of how different data types (logic, bit, byte, int, arrays, structs, enums, etc.) work, their differences, and typical usage from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples:</h3>
      <CodeBlock
        code={`// Placeholder: Example of 'logic' and 'bit' from blueprint
logic my_logic_var;
bit   my_bit_var;

// Placeholder: Example of arrays from blueprint
logic [7:0] data_bus [3:0]; // Array of 4, 8-bit logic vectors

// Placeholder: Example of structs from blueprint
typedef struct {
  logic [15:0] address;
  logic [31:0] data;
  bit          valid;
} memory_transaction_s;

memory_transaction_s transaction_q[$];`}
        language="systemverilog"
        fileName="data_types_examples.sv"
      />
      <p className="mt-2">[Placeholder: Explanation of the code examples above, detailing each part, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="Data Type Memory Representation (Conceptual)" />
      <p>[Placeholder: Description of a diagram illustrating how different data types might be represented or used, from blueprint].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Scenarios & Corner Cases:</strong> [Placeholder: Discussion of real-world complexities with data types, common bugs (e.g., 4-state vs 2-state issues, X-propagation), initialization, packed vs. unpacked arrays, dynamic arrays, associative arrays, queues, from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: How a senior engineer thinks about data type selection. Trade-offs (simulation performance, memory usage, synthesis implications, clarity). Patterns they use or avoid. Questions they ask in code reviews related to data types, from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Specific tip or mental model for remembering data types and their appropriate use, from blueprint. E.g., &quot;Relate 4-state &apos;logic&apos; to real hardware uncertainty, and 2-state &apos;bit&apos; to software-like variables or testbench state.&quot;].</p>
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

export default DataTypesPage;
