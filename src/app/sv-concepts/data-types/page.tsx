// app/sv-concepts/data-types/page.tsx
import TopicPage from "@/components/templates/TopicPage";
// import CodeBlock from "@/components/ui/CodeBlock"; // Will be replaced by InteractiveCode for one example
import InteractiveCode, { ExplanationStep } from "@/components/ui/InteractiveCode"; // Import new component
import { DiagramPlaceholder } from "@/components/templates/InfoPage"; // For placeholder visuals
import DataTypeComparisonChart from "@/components/charts/DataTypeComparisonChart"; // Import the new chart
import Quiz from "@/components/ui/Quiz";
import { ReactNode } from "react"; // For CardData type

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

// Define CardData interface (ideally this would be in a shared types file)
interface CardData {
  id: string | number;
  front: ReactNode;
  back: ReactNode;
}

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

  const dataTypesCode = `
// Example of 'logic' and 'bit'
logic my_logic_var; // 4-state: 0, 1, X, Z
bit   my_bit_var;   // 2-state: 0, 1

// Example of arrays
logic [7:0] data_bus [3:0]; // Array of 4 elements, each an 8-bit logic vector
int         dynamic_array[]; // Dynamic array (size can change)
string      assoc_array[string]; // Associative array (indexed by string)

// Example of structs and queues
typedef struct packed { // Packed struct
  logic [15:0] address;
  logic [31:0] data;
  bit          valid;
} memory_transaction_s;

memory_transaction_s transaction_q[$]; // Queue of memory_transaction_s structs
  `.trim();

  const dataTypeExplanationSteps: ExplanationStep[] = [
    { target: "2", title: "Logic Type", explanation: "`logic my_logic_var;` declares a 4-state variable (0, 1, X for unknown, Z for high-impedance). It's a general-purpose type for single-driver signals in SystemVerilog." },
    { target: "3", title: "Bit Type", explanation: "`bit my_bit_var;` declares a 2-state variable (0, 1). Use `bit` for memory efficiency and faster simulation when X or Z states are not needed, like software variables or testbench counters." },
    { target: "6", title: "Fixed-Size Unpacked Array", explanation: "`logic [7:0] data_bus [3:0];` declares a fixed-size unpacked array named `data_bus`. It has 4 elements (indexed 0 to 3). Each element is an 8-bit packed array (vector) of `logic`." },
    { target: "7", title: "Dynamic Array", explanation: "`int dynamic_array[];` declares a dynamic array. Its size is not fixed at compile time and can be changed during simulation using methods like `new[]` or by assignment." },
    { target: "8", title: "Associative Array", explanation: "`string assoc_array[string];` declares an associative array indexed by strings. Useful for sparse collections or when a non-integer index is needed, like a lookup table." },
    { target: "11-15", title: "Struct Definition", explanation: "`typedef struct packed { ... } memory_transaction_s;` defines a user-defined `struct`. `packed` means its members are stored contiguously, allowing it to be treated as a single vector. This `memory_transaction_s` groups related signals." },
    { target: "17", title: "Queue", explanation: "`memory_transaction_s transaction_q[$];` declares a queue named `transaction_q`. A queue is a dynamic, unpacked array that allows efficient addition/removal of elements from both ends (FIFO-like behavior). `[$]` denotes a queue." },
  ];

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics:</strong> [Placeholder: Detailed explanation of how different data types (logic, bit, byte, int, arrays, structs, enums, etc.) work, their differences, and typical usage from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Interactive Code Example: Common Data Types</h3>
      <p className="mb-2 text-sm text-muted-foreground">
        Step through this example to see various SystemVerilog data types in action, including `logic`, `bit`, arrays, structs, and queues.
      </p>
      <InteractiveCode
        code={dataTypesCode}
        language="systemverilog"
        explanationSteps={dataTypeExplanationSteps}
        fileName="data_types_examples.sv"
      />
      <p className="mt-2">[Placeholder: Further explanation of the code examples above, detailing each part, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="Data Type Memory Representation (Conceptual)" />
      <p>[Placeholder: Description of a diagram illustrating how different data types might be represented or used, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-6 mb-2">Data Type Feature Comparison</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        The following chart compares key characteristics of common SystemVerilog data types: <code>logic</code>, <code>wire</code>, <code>reg</code>, and <code>bit</code>.
        Understanding these differences is crucial for selecting the appropriate type for your design or testbench.
      </p>
      <DataTypeComparisonChart />

      <h3 className="text-xl font-semibold mt-6 mb-2">Check Your Understanding</h3>
      <Quiz
        questions={[
          {
            question: "Which data type is best suited for modeling a bus with multiple drivers?",
            options: ["bit", "logic", "wire", "int"],
            correctAnswer: "wire",
          },
          {
            question: "What is a key advantage of using 2-state data types like 'bit'?",
            options: ["Can represent 'X' and 'Z'", "Faster simulation speed", "Can be used in clocking blocks", "Are always signed"],
            correctAnswer: "Faster simulation speed",
          },
        ]}
      />
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

  const sampleFlashcards: CardData[] = [
    {
      id: 'dt1',
      front: "What's the key difference between `logic` and `wire` types in SystemVerilog?",
      back: "`logic` is a 4-state variable for single drivers (procedural/continuous). `wire` is a 4-state net for multiple drivers (e.g., tri-state buses).",
    },
    {
      id: 'dt2',
      front: "What problem does a `clocking block` primarily solve in testbenches?",
      back: "It eliminates testbench-DUT race conditions by defining deterministic signal sampling and driving times relative to a clock edge.",
    },
    {
      id: 'dt3',
      front: "Name two 2-state data types in SystemVerilog and their benefit.",
      back: "`bit` and `int`. They are more memory-efficient and faster for simulation compared to 4-state types when X/Z states aren't needed.",
    }
  ];

  return (
    <TopicPage
      title={pageTitle}
      level1Content={level1Content}
      level2Content={level2Content}
      level3Content={level3Content}
      flashcards={sampleFlashcards}
      topicId="sv-data-types" // Example topicId for Firestore
    />
  );
};

export default DataTypesPage;

// Metadata
const pageTitleForMetadata = "SystemVerilog Data Types";
const level1PitchForMetadata = "Understand SystemVerilog data types: the crucial difference between 2-state (bit, int) and 4-state (logic, wire, reg) types, and their application in modeling hardware signals and building verification testbenches.";

export async function generateMetadata() {
  return {
    title: `${pageTitleForMetadata} | SystemVerilog & UVM Mastery`,
    description: level1PitchForMetadata,
  };
}
