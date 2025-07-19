import React from 'react';
import TopicPage from '@/components/templates/TopicPage';
import UvmVirtualSequencerDiagram from '@/components/diagrams/UvmVirtualSequencerDiagram';
import InteractiveCode, { ExplanationStep } from '@/components/ui/InteractiveCode';

interface TopicData {
  title: string;
  description: string;
  level1: string;
}

const UvmVirtualSequencerPage: React.FC = () => {
  const topicData: TopicData = {
    title: "UVM Virtual Sequencer",
    description: "Learn how to coordinate multiple sequencers using a virtual sequencer.",
    level1: "A UVM virtual sequencer is a powerful component used to coordinate and synchronize stimulus across multiple agents in a testbench. It doesn't connect to a driver directly but instead contains handles to other sequencers in the environment.",
  };

  const level2Content = (
    <section className="my-8">
      <h2 className="text-2xl font-semibold mb-4">The Role of a Virtual Sequencer</h2>
      <p className="mb-4">
        In complex testbenches with multiple independent agents (e.g., for different interfaces like PCIe, Ethernet, I2C), there is often a need to synchronize their activities. For instance, you might want to send an Ethernet packet and, at the same time, stimulate an I2C device. A virtual sequencer orchestrates these multi-agent scenarios.
      </p>
      <div className="flex justify-center items-center my-8 p-4 border rounded-lg shadow-sm bg-white">
        <UvmVirtualSequencerDiagram />
      </div>
      <p>
        Key characteristics of a virtual sequencer:
      </p>
      <ul className="list-disc list-inside my-4">
        <li>It is a standard UVM sequencer (`uvm_sequencer`) that is not connected to a driver.</li>
        <li>It holds handles (pointers) to the actual sequencers in the various agents.</li>
        <li>A virtual sequence, running on the virtual sequencer, can start other sequences on the agent-specific sequencers.</li>
        <li>This allows for centralized control and synchronization of stimulus across the entire testbench.</li>
      </ul>
    </section>
  );

  const virtualSequencerCode = 
'// virtual_sequencer.sv\n' +
'class virtual_sequencer extends uvm_sequencer;\n' +
'  `uvm_component_utils(virtual_sequencer)\n' +
'\n' +
'  // Handles to the agent sequencers\n' +
'  pci_sequencer  m_pci_sequencer;\n' +
'  eth_sequencer  m_eth_sequencer;\n' +
'\n' +
'  function new(string name="virtual_sequencer", uvm_component parent=null);\n' +
'    super.new(name, parent);\n' +
'  endfunction\n' +
'endclass\n' +
'\n' +
'// virtual_sequence.sv\n' +
'class virtual_sequence extends uvm_sequence;\n' +
'  `uvm_object_utils(virtual_sequence)\n' +
'\n' +
'  // Pointer to the virtual sequencer\n' +
'  protected virtual_sequencer p_sequencer;\n' +
'\n' +
'  function new(string name="virtual_sequence", uvm_object parent=null);\n' +
'    super.new(name, parent);\n' +
'  endfunction\n' +
'\n' +
'  virtual task body();\n' +
'    // Downcast the sequencer handle\n' +
'    if (!$cast(p_sequencer, m_sequencer)) begin\n' +
'      `uvm_fatal("VSEQ", "Failed to get virtual sequencer handle")\n' +
'    end\n' +
'\n' +
'    // Create agent-specific sequences\n' +
'    pci_sequence  pci_seq = pci_sequence::type_id::create("pci_seq");\n' +
'    eth_sequence  eth_seq = eth_sequence::type_id::create("eth_seq");\n' +
'\n' +
'    // Start the sequences on their respective sequencers\n' +
'    fork\n' +
'      pci_seq.start(p_sequencer.m_pci_sequencer);\n' +
'      eth_seq.start(p_sequencer.m_eth_sequencer);\n' +
'    join\n' +
'  endtask\n' +
'endclass'.trim();

  const virtualSequencerExplanationSteps: ExplanationStep[] = [
    { target: "2-12", title: "Virtual Sequencer Class", explanation: "The `virtual_sequencer` is a standard `uvm_sequencer`. It doesn't have a type parameter because it doesn't handle a specific transaction type." },
    { target: "5-6", title: "Sequencer Handles", explanation: "It contains handles to the real sequencers in the testbench, in this case, `m_pci_sequencer` and `m_eth_sequencer`. These handles are typically assigned using `uvm_config_db` in the environment." },
    { target: "15-39", title: "Virtual Sequence Class", explanation: "The `virtual_sequence` runs on the `virtual_sequencer`. Its purpose is to start and coordinate other sequences on the agent-specific sequencers." },
    { target: "18", title: "Sequencer Pointer", explanation: "It's good practice to have a typed pointer `p_sequencer` to the virtual sequencer for easier access to its members." },
    { target: "25-27", title: "Getting the Sequencer Handle", explanation: "In the `body` task, we get the typed pointer to the virtual sequencer using `$cast`. The `m_sequencer` handle is a generic `uvm_sequencer` handle available in all sequences." },
    { target: "30-31", title: "Creating Agent Sequences", explanation: "The virtual sequence creates the sequences that will run on the individual agents." },
    { target: "34-37", title: "Starting Agent Sequences", explanation: "The `fork...join` block starts the `pci_seq` and `eth_seq` concurrently on their respective sequencers, which are accessed through the `p_sequencer` handle. This is the core of the coordination mechanism." }
  ];

  const level3Content = (
    <>
      <h3 className="text-2xl font-semibold my-4">Interactive Code Walkthrough: Virtual Sequencer and Sequence</h3>
      <p className="mb-4">
        Step through the code to understand how a virtual sequencer and a virtual sequence are implemented and how they work together.
      </p>
      <InteractiveCode
        code={virtualSequencerCode}
        language="systemverilog"
        explanationSteps={virtualSequencerExplanationSteps}
        fileName="virtual_sequencer_example.sv"
      />
    </>
  );

  return (
    <TopicPage
      title={topicData.title}
      level1Content={<p>{topicData.level1}</p>}
      level2Content={level2Content}
      level3Content={level3Content}
      topicId="uvm-virtual-sequencer"
    />
  );
};

export default UvmVirtualSequencerPage;

const pageTitleForMetadata = "UVM Virtual Sequencer";
const level1PitchForMetadata = "A UVM virtual sequencer is a powerful component used to coordinate and synchronize stimulus across multiple agents in a testbench. It doesn't connect to a driver directly but instead contains handles to other sequencers in the environment.";

export async function generateMetadata() {
  return {
    title: `${pageTitleForMetadata} | SystemVerilog & UVM Mastery`,
    description: level1PitchForMetadata,
  };
}
