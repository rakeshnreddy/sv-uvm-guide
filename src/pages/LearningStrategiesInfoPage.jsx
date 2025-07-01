import InfoPage from '../components/InfoPage';

export default function LearningStrategiesInfoPage() {
  const content = `
    <h2>Forging Knowledge That Lasts: A Memory-Science-Based Learning Strategy</h2>
    <p>The most common failure mode when learning a complex technical subject like UVM is focusing on memorizing syntax while neglecting the underlying concepts. This leads to brittle knowledge that cannot be applied to novel problems. The following strategies, drawn from cognitive science, are tailored to build robust, flexible mental models of hardware verification concepts, ensuring knowledge is not just acquired, but retained and readily applicable.</p>

    <h3>Technique 1: Spaced Repetition System (SRS) for Core Concepts</h3>
    <p>The human brain forgets information at a predictable rate (the "forgetting curve"). Spaced Repetition counters this by scheduling reviews of material at progressively increasing intervals (e.g., 1 day, 3 days, 7 days). Each review strengthens the memory trace, embedding information into long-term storage.</p>
    <p><strong>Recommended Tool:</strong> Anki (free, powerful, cross-platform SRS application).</p>
    <p><strong>Key Idea:</strong> Create flashcard prompts that test conceptual understanding, not just rote memorization.</p>
    {/* The InfoPage component will add a placeholder here based on the title "/learning-strategies" */}
    <h4>Sample 4-Week SRS Deck Outline (Flashcard Prompts):</h4>
    <ul>
      <li><strong>Week 1 (SV Fundamentals):</strong>
        <ul>
          <li>Prompt: What is the fundamental difference in purpose and usage between a <code>logic</code> type and a <code>wire</code> type in SystemVerilog?</li>
          <li>Answer: <code>logic</code> is a 4-state variable type for a single driver. <code>wire</code> is a 4-state net type for multiple drivers (e.g., tri-state bus).</li>
          <li>Prompt: What specific verification problem does a clocking block solve?</li>
          <li>Answer: Eliminates race conditions between testbench and DUT by defining deterministic sampling/driving times relative to a clock edge.</li>
        </ul>
      </li>
      <li><strong>Week 2 (SV Verification Constructs):</strong>
        <ul>
          <li>Prompt: What are the two main components of a concurrent assertion, and what is the role of each?</li>
          <li>Answer: A property (defines temporal behavior/rule) and a directive (<code>assert</code>, <code>cover</code>, or <code>assume</code>).</li>
          <li>Prompt: Explain the relationship between a <code>covergroup</code>, a <code>coverpoint</code>, and a <code>cross</code>.</li>
          <li>Answer: <code>covergroup</code> (container for metrics), <code>coverpoint</code> (samples a variable), <code>cross</code> (measures combinations of coverpoints).</li>
        </ul>
      </li>
      <li><strong>Week 3 (UVM Architecture):</strong>
        <ul>
          <li>Prompt: What is the primary motivation for using <code>uvm_factory::create()</code> instead of <code>new()</code>?</li>
          <li>Answer: To enable factory overrides for polymorphic replacement of components/objects at runtime.</li>
          <li>Prompt: In a UVM sequence, what is the purpose of the <code>p_sequencer</code> handle?</li>
          <li>Answer: Typed handle to the specific sequencer the sequence is running on, providing access to sequencer properties and potentially other testbench components.</li>
        </ul>
      </li>
      <li><strong>Week 4 (Advanced UVM):</strong>
        <ul>
          <li>Prompt: Contrast frontdoor and backdoor access in UVM RAL. What is the main trade-off?</li>
          <li>Answer: Frontdoor (physical bus): realistic but slow. Backdoor (DPI/direct memory): fast but doesn't test bus path. Trade-off: speed vs. realism.</li>
          <li>Prompt: What problem does a <code>uvm_virtual_sequence</code> solve?</li>
          <li>Answer: Coordinates and synchronizes stimulus across multiple, independent agents and their sequencers.</li>
        </ul>
      </li>
    </ul>

    <h3>Technique 2: The Feynman Notebook for Deconstruction</h3>
    <p>Developed by Richard Feynman, this technique helps develop deep understanding: you don't truly understand something until you can explain it simply. Articulating a concept in plain language exposes knowledge gaps.</p>
    <h4>Application Steps for each major UVM topic (e.g., UVM Phasing, TLM):</h4>
    <ol>
      <li><strong>Choose the Concept:</strong> Write its name at the top of a page.</li>
      <li><strong>Explain it to a Child:</strong> Write an explanation in simple language, using analogies, avoiding jargon.</li>
      <li><strong>Identify Gaps & Review:</strong> Where does the explanation feel weak or resort to jargon? These are your gaps. Return to authoritative sources to study these areas.</li>
      <li><strong>Refine and Simplify:</strong> Rewrite the explanation with new understanding. Read it aloud. Simplify further if still clunky or confusing. Aim for simple and accurate.</li>
    </ol>

    <h3>Technique 3: Active-Learning Coding Drills</h3>
    <p>Learning to write verification code requires hands-on practice. These drills reinforce specific concepts and build practical skills.</p>
    <ul>
      <li><strong>SV Drill - Assertion Deconstruction:</strong> Describe a complex SVA property in plain English. E.g., <code>@(posedge clk) req |-> ##[1:5] gnt;</code> translates to "after req is asserted, gnt must be asserted between 1 and 5 clock cycles later."</li>
      <li><strong>SV Drill - Data Structure Implementation:</strong> Implement a class with fixed-size array, dynamic array, and queue. Write tasks to populate and print them.</li>
      <li><strong>SV-to-UVM Drill - Componentization:</strong> Refactor a monolithic procedural testbench into a class-based SV testbench (generator, driver, monitor classes).</li>
      <li><strong>UVM Drill - Agent Creation:</strong> Convert the class-based SV testbench into a UVM agent (sequence, uvm_driver, uvm_monitor, TLM connections).</li>
      <li><strong>UVM Drill - Factory Override:</strong> Create a test using a factory override to replace a standard driver with an error-injecting driver.</li>
      <li><strong>UVM Drill - Virtual Sequence Coordination:</strong> Build a testbench with two agents. Write a virtual sequence to coordinate actions between them (e.g., configure via one agent, check result via another).</li>
    </ul>
  `;

  // Note: The InfoPage component is already set up to add
  // "[Spaced Repetition Visual Diagram Placeholder]" when the title is "/learning-strategies".

  return (
    <InfoPage
      title="/learning-strategies"
      content={content}
    />
  );
}
