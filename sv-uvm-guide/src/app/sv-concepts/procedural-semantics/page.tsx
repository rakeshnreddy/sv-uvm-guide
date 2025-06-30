// app/sv-concepts/procedural-semantics/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const ProceduralSemanticsPage = () => {
  const pageTitle = "Procedural Semantics in SystemVerilog";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Clear, concise definition of procedural semantics, focusing on always blocks, initial blocks, and the concept of procedural execution in SystemVerilog, from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Simple analogy for procedural blocks, e.g., "Think of an 'always' block like a recipe that continuously runs when its ingredients (sensitivity list) change," from blueprint].</p>
      <p><strong>The "Why":</strong> [Placeholder: Core problem procedural semantics solve – modeling behavior over time, reacting to events, creating sequential logic and combinational logic, from blueprint].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics:</strong> [Placeholder: Detailed explanation of `always`, `always_comb`, `always_ff`, `always_latch`, `initial` blocks. Sensitivity lists. Difference between blocking (`=`) and non-blocking (`&lt;=`) assignments and their implications in different types of always blocks, from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples:</h3>
      <CodeBlock
        code={
`// Example of always_ff
logic clk, reset, d_in, q_out;
always_ff @(posedge clk or posedge reset) begin
  if (reset) begin
    q_out <= 1'b0;
  end else begin
    q_out <= d_in;
  end
end

// Example of always_comb
logic a, b, c, y_comb;
always_comb begin
  y_comb = a & b | c;
end

// Example illustrating blocking vs. non-blocking
logic x, y, z;
// Non-blocking
always_ff @(posedge clk) begin
  x <= y;
  y <= x; // y gets old value of x
end

// Blocking
logic reg_a, reg_b, temp_var;
initial begin
  reg_a = 1;
  reg_b = 0;
  temp_var = reg_a;
  reg_a = reg_b;
  reg_b = temp_var;
end`
        }
        language="systemverilog"
        fileName="procedural_semantics_examples.sv"
      />
      <p className="mt-2">[Placeholder: Detailed explanation of the code examples, especially the blocking/non-blocking implications, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="Blocking vs. Non-blocking Assignment Timing" />
      <p>[Placeholder: Description of a diagram illustrating the difference in simulation or synthesis for blocking vs. non-blocking assignments, from blueprint].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Scenarios & Corner Cases:</strong> [Placeholder: Discussion of race conditions, simulation vs. synthesis differences, common mistakes with blocking/non-blocking, use of `fork-join`, event controls, implications of sensitivity lists (e.g., `*` vs explicit), from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: How a senior engineer debugs issues related to procedural blocks. Rules of thumb for choosing assignment types. Performance considerations. Readability and maintainability of complex procedural code, from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Specific tip for remembering when to use blocking vs. non-blocking. E.g., &quot;Non-blocking for &apos;always_ff&apos; (state registers), blocking for &apos;always_comb&apos; (temporary variables) and testbench procedural code,&quot; from blueprint].</p>
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

export default ProceduralSemanticsPage;
