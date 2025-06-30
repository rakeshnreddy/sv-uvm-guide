// app/uvm-concepts/coding-guidelines-patterns/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage"; // Using this for conceptual "good vs bad" snippet display

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const UVMCodingGuidelinesPage = () => {
  const pageTitle = "UVM Coding Guidelines & Patterns";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Clear definition of UVM coding guidelines as best practices and common patterns that enhance readability, reusability, maintainability, and interoperability of UVM-based verification environments, from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Analogy for coding guidelines, e.g., "Think of UVM coding guidelines like a shared 'style guide' for a team of authors writing a collaborative novel; it ensures consistency and makes the final work coherent and easy to read for everyone," from blueprint].</p>
      <p><strong>The "Why":</strong> [Placeholder: Core problem guidelines solve – reducing complexity, preventing common errors, facilitating easier debugging, enabling effective team collaboration, and ensuring smoother integration of Verification IP (VIP), from blueprint].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Guidelines & Patterns:</strong> [Placeholder: Detailed explanation of key guidelines such as naming conventions (for classes, variables, phases, etc.), factory registration, proper use of objections, TLM connections, configuration database usage, sequence development patterns, component structure, message reporting (\`uvm_info, \`uvm_error), and code commenting, from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples (Illustrative Snippets):</h3>
      <CodeBlock
        code={`// Placeholder: GOOD Example - Clear Naming & Factory Registration from blueprint
class my_bus_driver extends uvm_driver #(my_bus_transaction);
  \`uvm_component_utils(my_bus_driver)
  // ...
endclass

// Placeholder: BAD Example - Unclear Naming / Missing Utils from blueprint
// class mbd extends uvm_driver; // Unclear name, missing param, missing utils
//   // ...
// endclass

// Placeholder: GOOD Example - Proper Objection Usage in a Sequence from blueprint
// task my_sequence::body();
//   phase.raise_objection(this, "Starting my_sequence stimulus");
//   // ... stimulus ...
//   phase.drop_objection(this, "Finished my_sequence stimulus");
// endtask

// Placeholder: GOOD Example - Using uvm_config_db for configuration from blueprint
// if (!uvm_config_db#(virtual my_bus_if)::get(this, "", "bus_vif", m_bus_vif)) begin
//   \`uvm_fatal("NOVIF", "Virtual interface for my_bus_if not found")
// end
`}
        language="systemverilog"
        fileName="uvm_guidelines_good_bad.sv"
      />
      <p className="mt-2">[Placeholder: Explanation of why the 'GOOD' examples are preferred and what issues the 'BAD' examples might cause, based on blueprint content].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations (Conceptual):</h3>
      <DiagramPlaceholder title="Clear vs. Confusing Code Snippet Comparison" />
      <p>[Placeholder: A conceptual side-by-side comparison or highlight of code snippets demonstrating good vs. poor adherence to guidelines, if the blueprint provides such visual cues or descriptions].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Patterns & Anti-Patterns:</strong> [Placeholder: Discussion of advanced UVM patterns (e.g., resource management, advanced sequence control, custom scoreboard design). Common anti-patterns to avoid (e.g., excessive use of `uvm_root`, direct inter-component communication bypassing TLM/config_db, overly complex inheritance hierarchies), from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: Senior engineer's perspective on the long-term benefits of adhering to guidelines. How guidelines evolve. Balancing strict adherence with practical project needs. Enforcing guidelines through code reviews and linting tools. Impact of guidelines on debuggability and team productivity, from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Tip for internalizing good UVM habits. E.g., "The 3 R's: Readability, Reusability, Robustness. Good UVM code serves all three. When in doubt, favor clarity and standard UVM mechanisms," from blueprint].</p>
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

export default UVMCodingGuidelinesPage;
