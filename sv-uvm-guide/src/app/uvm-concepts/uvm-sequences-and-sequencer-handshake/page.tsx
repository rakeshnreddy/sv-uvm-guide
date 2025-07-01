import React from 'react'; // Removed ReactNode
import TopicPage from '@/components/templates/TopicPage';
import AnimatedUvmSequenceDriverHandshakeDiagram from '@/components/diagrams/AnimatedUvmSequenceDriverHandshakeDiagram';
import InteractiveCode, { ExplanationStep } from '@/components/ui/InteractiveCode'; // Import new component

interface TopicData {
  title: string;
  description: string;
  level1: string;
}

const UvmSequencesAndHandshakePage: React.FC = () => {
  const topicData: TopicData = {
    title: "UVM Sequences and Sequencer-Driver Handshake",
    description: "Delve into UVM sequences for stimulus generation and the crucial handshake mechanism between sequencers and drivers.",
    level1: "UVM sequences are fundamental to generating targeted and random stimulus in a UVM testbench. They define series of transactions that are sent to the DUT through a well-defined handshake protocol involving the sequencer and the driver.",
  };

  const level2Content = (
    <section className="my-8">
      <h2 className="text-2xl font-semibold mb-4">Animated Sequencer-Driver Handshake</h2>
      <p className="mb-4">
        The interaction between a UVM sequence, sequencer, and driver is critical for stimulus delivery.
        The following diagram animates this handshake step-by-step. Click "Next" to walk through the process.
      </p>
      <div className="flex justify-center items-center my-8 p-4 border rounded-lg shadow-sm bg-white">
        <AnimatedUvmSequenceDriverHandshakeDiagram />
      </div>
      <p>
        Key steps in the handshake include:
      </p>
      <ul className="list-disc list-inside my-4">
        <li>A <strong>sequence</strong> generates transaction items (requests).</li>
        <li>The sequence uses `start_item()` to request arbitration from the <strong>sequencer</strong> and waits until granted.</li>
        <li>Once granted, the sequence can randomize and prepare the transaction item.</li>
        <li>`finish_item()` sends the transaction to the sequencer, which then forwards it to the <strong>driver</strong>.</li>
        <li>The driver calls `get_next_item()` to retrieve a transaction from the sequencer (blocking call).</li>
        <li>After driving the transaction to the DUT, the driver calls `item_done()` to signal completion to the sequencer.</li>
        <li>The sequencer then informs the originating sequence that the item processing is complete.</li>
      </ul>
      <p>
        This mechanism ensures synchronized communication and allows for complex stimulus scenarios, including layering of sequences and sequencer arbitration for multiple sequences.
      </p>
    </section>
  );

  // Duplicate level2Content removed. The first one (lines 18-42) is kept.

  const handshakeCode = `
// my_sequence.sv
class my_sequence extends uvm_sequence#(my_item);
  \`uvm_object_utils(my_sequence)

  function new(string name="my_sequence", uvm_object parent=null);
    super.new(name, parent);
  endfunction

  virtual task body();
    my_item item;
    \`uvm_info("SEQ", "Starting sequence body", UVM_MEDIUM)
    repeat (3) begin
      item = my_item::type_id::create("item");
      start_item(item); // Request to send item
      if (!item.randomize()) begin
        \`uvm_error("SEQ_RAND_FAIL", "Item randomization failed")
      end
      finish_item(item); // Send item to driver & wait
      \`uvm_info("SEQ", "Item sent", UVM_MEDIUM)
    end
  endtask
endclass

// my_driver.sv
class my_driver extends uvm_driver#(my_item);
  \`uvm_component_utils(my_driver)

  function new(string name="my_driver", uvm_component parent=null);
    super.new(name, parent);
  endfunction

  virtual task run_phase(uvm_phase phase);
    forever begin
      seq_item_port.get_next_item(req); // Get item from sequencer
      \`uvm_info("DRV", $sformatf("Driving item: %s", req.sprint()), UVM_MEDIUM)
      // Actually drive item to DUT interface here...
      #10ns; // Simulate time to drive
      seq_item_port.item_done(); // Signal completion
    end
  endtask
endclass
  `.trim();

  const handshakeExplanationSteps: ExplanationStep[] = [
    { target: "8-19", title: "Sequence Body Task", explanation: "The sequence's `body` task defines the transactions to be generated. This example creates and sends 3 `my_item` transactions in a loop." },
    { target: "13", title: "Start Item", explanation: "`start_item(item)`: The sequence sends a request to the sequencer to get permission to send the 'item'. The sequence execution blocks (waits) at this call until the sequencer grants access. This allows the sequencer to manage arbitration if multiple sequences are trying to send items." },
    { target: "14-16", title: "Randomize Item", explanation: "Once `start_item` returns (grant is received), the item's data fields are typically randomized using `item.randomize()`. Proper error checking for randomization failure is important." },
    { target: "17", title: "Finish Item", explanation: "`finish_item(item)`: After randomization, this call sends the actual item to the driver (via the sequencer). The sequence again blocks here, waiting for the driver to signal that it has completed processing this item (by calling `item_done()`)." },
    { target: "27-34", title: "Driver Run Phase", explanation: "The driver's `run_phase` typically contains an endless loop to continuously fetch and process items from the sequencer." },
    { target: "29", title: "Get Next Item", explanation: "`seq_item_port.get_next_item(req)`: This is a blocking call from the driver to its `seq_item_port`. The driver waits here until a transaction (item) is available from the sequencer." },
    { target: "30-32", title: "Drive Item", explanation: "Once an item is received (e.g., in `req`), the driver performs the necessary actions to drive the item's data onto the DUT's interface. `#10ns` simulates the time taken for this." },
    { target: "33", title: "Item Done", explanation: "`seq_item_port.item_done()`: After the driver has finished driving the current item, it calls `item_done()`. This signals completion back to the sequencer, which in turn unblocks the `finish_item` call in the sequence." },
  ];

  const level3Content = (
    <>
      <p className="mb-4">Advanced sequence control, virtual sequences for multi-agent coordination, sequence layering, and response handling will be detailed here. We&apos;ll also explore common pitfalls and debugging techniques related to sequence execution.</p>
      <h3 className="text-2xl font-semibold my-4">Interactive Code Walkthrough: Sequence-Driver Handshake</h3>
      <p className="mb-4">
        Step through the key parts of a typical UVM sequence and driver to understand the handshake mechanism in detail.
        Use the "Next" and "Previous" buttons to navigate the explanations.
      </p>
      <InteractiveCode
        code={handshakeCode}
        language="systemverilog"
        explanationSteps={handshakeExplanationSteps}
        fileName="sequence_driver_handshake.sv"
      />
    </>
  );

  return (
    <TopicPage
      title={topicData.title}
      level1Content={<p>{topicData.level1}</p>}
      level2Content={level2Content}
      level3Content={level3Content} // Updated with InteractiveCode
      topicId="uvm-sequences-handshake" // Added topicId
    />
  );
};

export default UvmSequencesAndHandshakePage;

export async function generateMetadata() {
  const topicData: TopicData = {
    title: "UVM Sequences & Sequencer Handshake",
    description: "Learn about UVM sequences, stimulus generation, and the detailed sequencer-driver handshake protocol with an interactive animated diagram.",
    level1: "UVM sequences are fundamental to generating targeted and random stimulus in a UVM testbench."
  };
  return {
    title: `${topicData.title} | SystemVerilog & UVM Mastery`,
    description: topicData.description,
  };
}
