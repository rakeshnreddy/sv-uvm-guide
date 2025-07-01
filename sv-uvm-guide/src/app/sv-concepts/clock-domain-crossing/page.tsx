import React from 'react';
import TopicPage from '@/components/templates/TopicPage';
import InteractiveCdcSketches from '@/components/diagrams/InteractiveCdcSketches';

interface TopicData {
  title: string;
  description: string;
  level1: string;
}

const ClockDomainCrossingPage: React.FC = () => {
  const topicData: TopicData = {
    title: "Clock Domain Crossing (CDC)",
    description: "Understand the challenges and solutions for passing signals between different clock domains in digital design.",
    level1: "Clock Domain Crossing (CDC) is a critical aspect of modern SoC design where signals must reliably pass between parts of the chip operating on different or asynchronous clocks. Incorrect CDC handling can lead to metastability and design failure.",
  };

  const level2Content = (
    <section className="my-8">
      <h2 className="text-2xl font-semibold mb-4">Interactive CDC Technique Sketches</h2>
      <p className="mb-4">
        Properly handling Clock Domain Crossings is vital for design stability. The interactive diagrams below illustrate common techniques used to mitigate metastability and ensure reliable data transfer between asynchronous clock domains. Select a technique from the list to view its structure and description.
      </p>
      <div className="my-8 p-4 border rounded-lg shadow-sm bg-white">
        <InteractiveCdcSketches />
      </div>
      <p>
        Common CDC strategies include:
      </p>
      <ul className="list-disc list-inside my-4">
        <li><strong>Two-Flop Synchronizer:</strong> Used for single-bit control signals. It reduces the probability of metastability but doesn't eliminate it. The Mean Time Between Failures (MTBF) must be acceptably high.</li>
        <li><strong>Handshake Synchronizers:</strong> For multi-bit data, a request/acknowledge protocol ensures data is stable when captured by the receiving domain. This adds latency but is safer for data buses.</li>
        <li><strong>Asynchronous FIFO:</strong> A robust method for transferring blocks of data between clock domains. It uses dual-port memory and synchronized (often Gray-coded) pointers to manage read and write operations independently.</li>
      </ul>
      <p>
        The choice of CDC technique depends on factors like the number of signals crossing, data rate, latency requirements, and the relationship between the clock frequencies.
      </p>
    </section>
  );

  const level3Content = (
    <p>Further deep dive into CDC analysis, formal verification methods for CDC, and advanced techniques like using qualifier signals and data encoding for robust multi-bit CDC will be covered here.</p>
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

export default ClockDomainCrossingPage;

export async function generateMetadata() {
  const topicData: TopicData = {
    title: "Clock Domain Crossing (CDC) Techniques",
    description: "Explore interactive sketches of Clock Domain Crossing (CDC) techniques like 2-flop synchronizers, MUX handshake, and asynchronous FIFOs.",
    level1: "Clock Domain Crossing (CDC) is a critical aspect of modern SoC design..."
  };
  return {
    title: `${topicData.title} | SystemVerilog & UVM Mastery`,
    description: topicData.description,
  };
}
