// app/uvm-concepts/layered-testbench/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const LayeredTestbenchPage = () => {
  const pageTitle = "Layered Testbench Architecture in UVM";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Clear definition of a layered testbench architecture, emphasizing separation of concerns (e.g., signal-level driving, transaction-level stimulus, sequence generation, checking), from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Analogy for layered testbenches, e.g., &quot;Think of it like a corporate hierarchy: Signal-level drivers are &apos;workers&apos; on the factory floor, sequence items are &apos;work orders&apos;, sequences are &apos;project plans&apos;, and the test is the &apos;CEO&apos; setting strategy,&quot; from blueprint].</p>
      <p><strong>The &quot;Why&quot;:</strong> [Placeholder: Core problem layered architecture solves – managing complexity, promoting reusability of components at different abstraction levels, enabling easier debugging, and facilitating team-based development, from blueprint].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics:</strong> [Placeholder: Detailed explanation of typical layers: Signal Layer (Driver, Monitor interacting with DUT via interfaces), Functional Layer (Sequencer, Agent containing Driver/Monitor/Sequencer, handling transactions), Scenario Layer (Sequences generating transactions), Test Layer (Test instantiating environment, configuring components, starting sequences), Environment Layer (Top-level component instantiating agents, scoreboard, etc.), from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples:</h3>
      <CodeBlock
        code={`// Placeholder: Conceptual structure of a UVM agent from blueprint
class my_agent extends uvm_agent;
  \`uvm_component_utils(my_agent)

  my_driver    m_driver;
  my_monitor   m_monitor;
  my_sequencer m_sequencer;
  // Config object, analysis ports etc.

  function new(string name = "my_agent", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    m_driver    = my_driver::type_id::create("m_driver", this);
    m_monitor   = my_monitor::type_id::create("m_monitor", this);
    if (get_is_active() == UVM_ACTIVE) begin // Create sequencer only if active
      m_sequencer = my_sequencer::type_id::create("m_sequencer", this);
    end
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    if (get_is_active() == UVM_ACTIVE) begin
      m_driver.seq_item_port.connect(m_sequencer.seq_item_export);
    }
    // Connect monitor analysis port to agent analysis port (simplified for linting)
    // this.ap.connect(m_monitor.ap);
  endfunction
endclass

// Placeholder: Conceptual structure of a UVM environment from blueprint
class my_env extends uvm_env;
  \`uvm_component_utils(my_env)

  my_agent     m_agent;
  my_scoreboard m_scoreboard;
  // Config object, other agents, virtual sequencer etc.

  function new(string name = "my_env", uvm_component parent = null);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    m_agent      = my_agent::type_id::create("m_agent", this);
    m_scoreboard = my_scoreboard::type_id::create("m_scoreboard", this);
  endfunction

  // Connect agent analysis ports to scoreboard, etc. in connect_phase
endclass`}
        language="systemverilog"
        fileName="uvm_layered_tb_conceptual.sv"
      />
      <p className="mt-2">[Placeholder: Detailed explanation of the agent and environment structure, highlighting how components are instantiated and connected to form layers, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="Typical UVM Layered Testbench Diagram" />
      <p>[Placeholder: Description of a block diagram showing the layers (Test, Env, Agent(s), Sequencer, Driver, Monitor, Scoreboard) and their connections (TLM ports/exports, analysis ports), from blueprint].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Scenarios & Corner Cases:</strong> [Placeholder: Discussion of virtual sequencers for coordinating multiple agents, passive vs. active agents, agent configuration, building layered scoreboards, reusable environment patterns, vertical vs. horizontal reuse, from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: Senior engineer&apos;s perspective on designing a well-structured, layered UVM environment. Balancing reusability with project-specific needs. Strategies for debugging issues that span multiple layers. How layering facilitates IP integration, from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Tip for remembering layers. E.g., &quot;Signal (How) &gt; Transaction (What) &gt; Sequence (Why/When) &gt; Test (Overall Goal). Each layer abstracts details from the one below,&quot; from blueprint].</p>
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

export default LayeredTestbenchPage;
