import React from 'react';
import TopicPage from '@/components/templates/TopicPage';
import AnimatedUvmSequenceDriverHandshakeDiagram from '@/components/diagrams/AnimatedUvmSequenceDriverHandshakeDiagram';

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

  const level3Content = (
     <p>Advanced sequence control, virtual sequences for multi-agent coordination, sequence layering, and response handling will be detailed here. We&apos;ll also explore common pitfalls and debugging techniques related to sequence execution.</p>
  );

  return (
    <TopicPage
      title={topicData.title}
      level1Content={<p>{topicData.level1}</p>}
      level2Content={level2Content}
      level3Content={level3Content}
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
