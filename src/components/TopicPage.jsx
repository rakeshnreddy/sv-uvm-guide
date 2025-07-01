// Basic TopicPage Template
// We'll need to import an Accordion and CodeBlock component later.
// For now, we'll use divs as placeholders.

// Placeholder for an AccordionItem component
const AccordionItem = ({ title, children }) => (
  <div>
    <h3>{title}</h3>
    <div>{children}</div>
  </div>
);

// Placeholder for CodeBlock component
const CodeBlock = ({ code }) => (
  <pre>
    <code>{code}</code>
  </pre>
);

export default function TopicPage({ title, elevatorPitch, practicalExplanation, deepDive }) {
  return (
    <div>
      <h1>{title}</h1>

      <AccordionItem title="Level 1: The Elevator Pitch">
        <h4>What is it?</h4>
        <p>{elevatorPitch?.definition}</p>
        <h4>The Analogy:</h4>
        <p>{elevatorPitch?.analogy}</p>
        <h4>The "Why":</h4>
        <p>{elevatorPitch?.why}</p>
      </AccordionItem>

      <AccordionItem title="Level 2: The Practical Explanation">
        <h4>Core Mechanics:</h4>
        <p>{practicalExplanation?.coreMechanics}</p>
        <h4>Code Examples:</h4>
        {practicalExplanation?.codeExamples?.map((example, index) => (
          <div key={index}>
            <p>{example.description}</p>
            <CodeBlock code={example.code} />
          </div>
        ))}
        {practicalExplanation?.codeExamples?.length === 0 && <p>No code examples provided.</p>}
        <h4>Visualizations:</h4>
        {/* Placeholder for visualizations. Will be actual images/charts later. */}
        {practicalExplanation?.visualizations?.map((viz, index) => (
          <div key={index}>
            <p>{viz.description}</p>
            {/* <img src={viz.url} alt={viz.altText} /> */}
            <p>[Visualization: {viz.altText}]</p>
          </div>
        ))}
        {practicalExplanation?.visualizations?.length === 0 && <p>No visualizations provided.</p>}
      </AccordionItem>

      <AccordionItem title="Level 3: The Deep Dive (The Senior Engineer's Perspective)">
        <h4>Advanced Scenarios & Corner Cases:</h4>
        <p>{deepDive?.advancedScenarios}</p>
        <h4>The 10-Year Experience View:</h4>
        <p>{deepDive?.experienceView}</p>
        <h4>Memory & Retention Tip:</h4>
        <p>{deepDive?.retentionTip}</p>
      </AccordionItem>
    </div>
  );
}

// Example Usage (will be removed from here and used in actual page files)
/*
<TopicPage
  title="Sample Topic"
  elevatorPitch={{
    definition: "This is what it is.",
    analogy: "Think of it like a thing that does stuff.",
    why: "It exists to solve a very important problem."
  }}
  practicalExplanation={{
    coreMechanics: "This is how it works in detail. It involves several steps and components...",
    codeExamples: [
      { description: "Example 1: Basic usage", code: "sample_code_here();" },
      { description: "Example 2: Advanced feature", code: "another_sample_code(true);" }
    ],
    visualizations: [
      { description: "Diagram of core components", url: "/path/to/diagram.png", altText: "Core Component Diagram" }
    ]
  }}
  deepDive={{
    advancedScenarios: "In complex situations, you might encounter X, Y, and Z. Common bugs include A and B.",
    experienceView: "A senior engineer considers trade-offs like performance vs. readability. They use patterns P and Q, and avoid R. In code reviews, they ask about S and T.",
    retentionTip: "To remember this, think about [mental model/tip]."
  }}
/>
*/
