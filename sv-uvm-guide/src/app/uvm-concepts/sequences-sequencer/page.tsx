// app/uvm-concepts/sequences-sequencer/page.tsx
import TopicPage from "@/components/templates/TopicPage";
import CodeBlock from "@/components/ui/CodeBlock";
import { DiagramPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const UVMSequencesSequencerPage = () => {
  const pageTitle = "UVM Sequences & Sequencer Handshake";

  // Level 1: The Elevator Pitch
  const level1Content = (
    <>
      <p><strong>What is it?</strong> [Placeholder: Clear definition of UVM sequences for generating streams of transactions, and the sequencer's role as an arbiter and forwarder of these transactions to the driver, from blueprint].</p>
      <p><strong>The Analogy:</strong> [Placeholder: Analogy for sequences/sequencer, e.g., "Think of sequences as 'screenplays' for data generation, sequence items as 'lines of dialogue', and the sequencer as the 'director' choosing which actor (sequence) gets to deliver their lines to the driver (the main actor on stage)," from blueprint].</p>
      <p><strong>The "Why":</strong> [Placeholder: Core problem this solves – separating stimulus generation logic from driver's DUT interaction logic, enabling reusable stimulus scenarios, managing concurrent transaction streams, and supporting randomization of stimulus, from blueprint].</p>
    </>
  );

  // Level 2: The Practical Explanation
  const level2Content = (
    <>
      <p><strong>Core Mechanics of Sequences:</strong> [Placeholder: Detailed explanation of `uvm_sequence_item` (transactions), `uvm_sequence` (container for items and other sequences). `body()` task. Macros like `uvm_do`, `uvm_do_with`, `uvm_create`, `uvm_send`. Hierarchical sequences (virtual sequences), from blueprint].</p>
      <p><strong>Core Mechanics of Sequencer:</strong> [Placeholder: `uvm_sequencer` base class. `seq_item_export` for driver connection. Arbitration algorithms (e.g., FIFO, weighted). `grab`/`ungrab` mechanism. `get_next_item()`, `item_done()`, `put()` handshake with driver, from blueprint].</p>
      <h3 className="text-xl font-semibold mt-4 mb-2">Code Examples:</h3>
      <CodeBlock
        code={`// Placeholder: Example of a sequence item and a basic sequence from blueprint
import uvm_pkg::*;
\`include "uvm_macros.svh"

class my_transaction extends uvm_sequence_item;
  rand int data;
  \`uvm_object_utils_begin(my_transaction)
    \`uvm_field_int(data, UVM_DEFAULT)
  \`uvm_object_utils_end
  function new(string name = "my_transaction"); super.new(name); endfunction
endclass

class my_simple_sequence extends uvm_sequence #(my_transaction);
  \`uvm_object_utils(my_simple_sequence)
  function new(string name = "my_simple_sequence"); super.new(name); endfunction

  virtual task body();
    my_transaction req;
    repeat (5) begin
      // \`uvm_do(req) // Creates, randomizes, sends, and waits for item_done
      req = my_transaction::type_id::create("req");
      start_item(req);
      assert(req.randomize());
      finish_item(req);
    end
  endtask
endclass

// Placeholder: Driver interaction with sequencer from blueprint
class my_driver extends uvm_driver #(my_transaction);
  \`uvm_component_utils(my_driver)
  // ... new ...
  virtual task run_phase(uvm_phase phase);
    forever begin
      // my_transaction tr; // For uvm_driver #(my_transaction)
      seq_item_port.get_next_item(req); // Gets 'req' of type my_transaction
      // Drive req to DUT
      \`uvm_info("DRIVER", $sformatf("Driving transaction: %s", req.sprint()), UVM_MEDIUM)
      #10; // Simulate driving time
      seq_item_port.item_done(); // Indicate completion to sequencer
      // Or seq_item_port.put(rsp) if there's a response
    end
  endtask
endclass

// In test: my_simple_sequence_inst.start(env.agent.sequencer);`}
        language="systemverilog"
        fileName="uvm_sequence_sequencer_example.sv"
      />
      <p className="mt-2">[Placeholder: Detailed explanation of the sequence item, sequence `body` task, `uvm_do` macro (or its equivalent `start_item`/`finish_item`), and the driver's `get_next_item`/`item_done` handshake, from blueprint].</p>

      <h3 className="text-xl font-semibold mt-4 mb-2">Visualizations:</h3>
      <DiagramPlaceholder title="Sequence-Sequencer-Driver Handshake" />
      <p>[Placeholder: Description of a diagram illustrating the flow of transactions from a sequence, through the sequencer, to the driver, including the handshake signals/methods, from blueprint].</p>
    </>
  );

  // Level 3: The Deep Dive
  const level3Content = (
    <>
      <p><strong>Advanced Scenarios & Corner Cases:</strong> [Placeholder: Discussion of sequence layering, virtual sequences, sequence libraries, sequence priority and arbitration, locking/grabbing sequencer, sequence responses, `is_relevant()`/`wait_for_relevant()`, debugging sequence issues, from blueprint].</p>
      <p><strong>The 10-Year Experience View:</strong> [Placeholder: Senior engineer's strategies for creating reusable and powerful sequence libraries. Managing complex stimulus scenarios. Best practices for sequencer arbitration and resource sharing. Debugging deadlocks between sequences and drivers, from blueprint].</p>
      <p><strong>Memory & Retention Tip:</strong> [Placeholder: Tip for remembering sequence/sequencer roles. E.g., "Sequence Item = The 'What' (data). Sequence = The 'Scenario' (how many, what order). Sequencer = The 'Traffic Cop' (who goes next). Driver = The 'Doer' (puts it on the bus)," from blueprint].</p>
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

export default UVMSequencesSequencerPage;
