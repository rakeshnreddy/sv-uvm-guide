// app/uvm-concepts/phasing-hierarchy/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const UVMPhasingHierarchyPage = () => {
  const pageTitle = "UVM Phasing & Class Hierarchy";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Clear definition of UVM's phasing mechanism for synchronizing testbench execution, and the core UVM class hierarchy (uvm_object, uvm_component, etc.), from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Analogy for UVM phasing, e.g., "Think of UVM phases like the stages of a rocket launch: build, connect, run, cleanup, each with specific tasks." For class hierarchy, "It's like a family tree for UVM components, defining common ancestry and capabilities," from blueprint].</p>
      <p><strong>The "Why":</strong> [Placeholder: Core problem phasing solves – ordered testbench construction, execution, and cleanup. Why class hierarchy is important – code reuse, polymorphism, standardization of component behavior, from blueprint].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics of UVM Phasing:</strong> [Placeholder: Detailed explanation of build phases (build, connect, end_of_elaboration, start_of_simulation), run-time phases (pre_run, run, post_run, etc. and their parallel nature for uvm_components), cleanup phases (extract, check, report). Task-based vs. function-based phases. Phase synchronization (`sync()`, `wait_for_state()`), phase jumping, from blueprint].</p>
      <p><strong>Core UVM Class Hierarchy:</strong> [Placeholder: Overview of key base classes: `uvm_void`, `uvm_object` (transactions, sequences, configurations), `uvm_component` (drivers, monitors, agents, envs, tests). Key methods inherited (e.g., `new`, `build_phase`, `run_phase`, factory registration macros), from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples:</h3>
      <CodeBlock
        code={`// Placeholder: Example of a uvm_component with phase methods from blueprint
import uvm_pkg::*;
\`include "uvm_macros.svh"

class my_driver extends uvm_driver #(my_transaction);
  \`uvm_component_utils(my_driver)

  function new(string name = "my_driver", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual task build_phase(uvm_phase phase);
    super.build_phase(phase);
    // Get configuration, interface, etc.
    \`uvm_info("BUILD", "Driver build_phase called", UVM_MEDIUM)
  endtask

  virtual task run_phase(uvm_phase phase);
    phase.raise_objection(this, "Driver starting operation");
    \`uvm_info("RUN", "Driver run_phase starting", UVM_MEDIUM)
    // Drive transactions
    #100ns; // Simulate work
    \`uvm_info("RUN", "Driver run_phase ending", UVM_MEDIUM)
    phase.drop_objection(this, "Driver finished operation");
  endtask

  // Other phases like connect_phase, end_of_elaboration_phase etc.
endclass`}
        language="systemverilog"
        fileName="uvm_phasing_example.sv"
      />
      <p className="mt-2">[Placeholder: Detailed explanation of the component, its base class, phase methods, and objection mechanism, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="UVM Phasing Diagram" />
      <p>[Placeholder: Description of a diagram illustrating the sequence of UVM phases and their purpose, from blueprint].</p>
      <DiagramPlaceholder title="Simplified UVM Class Hierarchy" />
      <p>[Placeholder: Description of a tree diagram showing key UVM base classes and their relationships, from blueprint].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Scenarios & Corner Cases:</strong> [Placeholder: Discussion of user-defined phases, phase domains, runtime phase scheduling (e.g., `uvm_top.set_timeout`), objections (raising/dropping, drain times), debugging phase-related hangs, interaction of phasing with sequences, from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: Senior engineer's perspective on leveraging phasing for complex testbench synchronization. Common mistakes in phase implementations. How the UVM class hierarchy facilitates building robust and reusable verification IP (VIP), from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Tip for remembering phasing/hierarchy. E.g., "Phases: B.C.E.S.R.P.E.C.R (Build, Connect, Elaborate, Start, Run phases, Post-Run, Extract, Check, Report). Hierarchy: Object=Data, Component=Structure/Behavior," from blueprint].</p>
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

export default UVMPhasingHierarchyPage;
