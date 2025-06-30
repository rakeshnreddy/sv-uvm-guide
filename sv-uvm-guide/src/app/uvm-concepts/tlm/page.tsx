// app/uvm-concepts/tlm/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const TLMPage = () => {
  const pageTitle = "Transaction-Level Modeling (TLM) in UVM";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Clear definition of TLM as a high-level approach for communication between verification components using transaction objects, abstracting away pin-level details, from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Analogy for TLM, e.g., "Think of TLM ports and exports like standardized mail slots and mailboxes; components send/receive 'packages' (transactions) without needing to know the exact delivery route or hand-off mechanism," from blueprint].</p>
      <p><strong>The "Why":</strong> [Placeholder: Core problem TLM solves – enabling component interoperability and reuse, simplifying communication paths, improving simulation performance by reducing signal-level activity for high-level communication, from blueprint].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics:</strong> [Placeholder: Detailed explanation of TLM1 (unidirectional, blocking/non-blocking puts, gets, peeks) and TLM2 (bidirectional, transport interfaces with request/response phases). `uvm_tlm_fifo`, ports (`uvm_*_port`), exports (`uvm_*_export`), imps (`uvm_*_imp`). Connecting ports and exports. Analysis ports and FIFOs, from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples:</h3>
      <CodeBlock
        code={`// Placeholder: Example of TLM1 put port/export from blueprint
import uvm_pkg::*;
\`include "uvm_macros.svh"

class my_transaction extends uvm_sequence_item; /* ... */ endclass

class producer extends uvm_component;
  \`uvm_component_utils(producer)
  uvm_blocking_put_port #(my_transaction) put_port;
  function new(string name="producer", uvm_component parent=null);
    super.new(name,parent);
    put_port = new("put_port", this);
  endfunction
  task run_phase(uvm_phase phase);
    my_transaction tr = new();
    // ... randomize tr ...
    put_port.put(tr); // Blocking put
  endtask
endclass

class consumer extends uvm_component;
  \`uvm_component_utils(consumer)
  uvm_blocking_put_imp #(my_transaction, consumer) put_export; // Imp port
  function new(string name="consumer", uvm_component parent=null);
    super.new(name,parent);
    put_export = new("put_export", this);
  endfunction
  task put(my_transaction tr); // Implementation of the put method
    \`uvm_info("CONSUMER", $sformatf("Received transaction: %s", tr.sprint()), UVM_MEDIUM)
    // Process transaction
  endtask
endclass

// In environment: producer_inst.put_port.connect(consumer_inst.put_export);

// Placeholder: Example of Analysis Port from blueprint
class my_monitor extends uvm_monitor;
  \`uvm_component_utils(my_monitor)
  uvm_analysis_port #(my_transaction) ap;
  function new(string name="my_monitor", uvm_component parent=null);
    super.new(name,parent);
    ap = new("ap", this);
  endfunction
  virtual task run_phase(uvm_phase phase);
    // ... capture bus activity and create transaction tr ...
    ap.write(tr); // Broadcast transaction
  endtask
endclass

class my_scoreboard extends uvm_scoreboard;
  \`uvm_component_utils(my_scoreboard)
  uvm_analysis_imp #(my_transaction, my_scoreboard) analysis_export;
  // ...
  function void write(my_transaction tr); // Implementation of write
    // Scoreboard logic
  endfunction
endclass

// In environment: monitor_inst.ap.connect(scoreboard_inst.analysis_export);`}
        language="systemverilog"
        fileName="uvm_tlm_examples.sv"
      />
      <p className="mt-2">[Placeholder: Detailed explanation of TLM1 ports/exports, imp ports, analysis ports, and their connections, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="TLM Port/Export Connection" />
      <p>[Placeholder: Description of a diagram showing how different TLM ports (put, get, analysis) connect components like producers, consumers, monitors, and scoreboards, from blueprint].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Scenarios & Corner Cases:</strong> [Placeholder: Discussion of TLM2 sockets (initiator/target), generic payload, transport debug interface. Blocking vs. non-blocking transport. Analysis FIFOs for multiple subscribers. Custom TLM interface implementations. Performance considerations of different TLM types, from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: Senior engineer's perspective on choosing appropriate TLM interfaces. Designing reusable components with flexible TLM connections. Debugging TLM connectivity and transaction flow issues. Strategies for integrating non-UVM models using TLM adapters, from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Tip for remembering TLM. E.g., "Port = 'I need service'. Export = 'I provide service'. Imp = 'I implement the service method'. AnalysisPort = 'Broadcasting news', AnalysisExport/Imp = 'Subscribing to news'," from blueprint].</p>
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

export default TLMPage;
