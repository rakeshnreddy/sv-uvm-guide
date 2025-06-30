// app/learning-strategies/page.tsx
import InfoPage, { DiagramPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const LearningStrategiesPage = () => {
  const pageTitle = "Effective Learning Strategies for SystemVerilog & UVM";

  const pageContent = (
    <>
      <p className="lead mb-6">[Placeholder: Introduction to the importance of effective learning strategies for mastering complex topics like SystemVerilog and UVM, from blueprint].</p>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">1. The Feynman Technique</h2>
        <p>[Placeholder: Detailed explanation of the Feynman Technique: Choose a concept, teach it to a child (or explain it simply), identify gaps in understanding, review and simplify. How to apply this to SV/UVM topics, from blueprint].</p>
        <p>[Placeholder: Benefits of using the Feynman Technique for deep understanding and retention, from blueprint].</p>
        {/* The FeynmanPromptWidget itself is part of TopicPage, but this page can explain the technique */}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">2. Spaced Repetition System (SRS)</h2>
        <p>[Placeholder: Explanation of SRS and the forgetting curve. How SRS optimizes learning by scheduling reviews at increasing intervals when knowledge is about to be forgotten, from blueprint].</p>
        <p>[Placeholder: Tools and techniques for implementing SRS (e.g., Anki, custom flashcard systems). How the platform&apos;s FlashcardWidget can be part of this strategy, from blueprint].</p>
        <DiagramPlaceholder title="The Forgetting Curve & Spaced Repetition Intervals" />
        <p className="text-sm text-foreground/70 mt-2">
          [Placeholder: Description of the diagram showing how spaced repetition combats the forgetting curve, from blueprint].
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">3. Active Recall</h2>
        <p>[Placeholder: Explanation of active recall (retrieval practice) versus passive review. Why it&apos;s more effective for strengthening memory traces, from blueprint].</p>
        <p>[Placeholder: Practical ways to implement active recall: self-testing, using flashcards (front-to-back), summarizing concepts from memory, from blueprint].</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">4. Deliberate Practice</h2>
        <p>[Placeholder: Definition of deliberate practice: focused, goal-oriented practice with feedback, aimed at improving specific skills. How this applies to coding, debugging, and problem-solving in SV/UVM, from blueprint].</p>
        <p>[Placeholder: Examples: working through exercises, contributing to small projects, seeking code reviews, from blueprint].</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">5. Building Mental Models</h2>
        <p>[Placeholder: Importance of not just memorizing syntax but understanding the &apos;why&apos; and &apos;how&apos; to build robust mental models of how language constructs and UVM components work and interact, from blueprint].</p>
        <p>[Placeholder: How analogies, visualizations, and explaining concepts to others help build these models. Reference to the platform&apos;s three-layer content structure, from blueprint].</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">Applying These Strategies on This Platform</h2>
        <p>[Placeholder: How users can leverage the platform's features (Feynman prompts, flashcards, exercises, structured content) in conjunction with these learning strategies for maximum effect, from blueprint].</p>
      </section>
    </>
  );

  return (
    <InfoPage title={pageTitle}>
      {pageContent}
    </InfoPage>
  );
};

export default LearningStrategiesPage;
