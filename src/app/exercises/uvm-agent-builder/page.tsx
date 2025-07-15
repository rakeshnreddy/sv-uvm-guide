import React from 'react';
import UvmAgentBuilderExercise from '@/components/exercises/UvmAgentBuilderExercise';
import InfoPage from '@/components/templates/InfoPage'; // Using InfoPage for layout

const UvmAgentBuilderPage: React.FC = () => {
  const pageTitle = "Exercise: UVM Agent Builder";

  const content = (
    <>
      <section className="mb-6">
        <h2 className="text-2xl font-semibold text-primary mb-2">Build a UVM Agent</h2>
        <p className="text-muted-foreground mb-1">
          Drag and drop the essential components (Sequencer, Driver, Monitor) from the &quot;Available Components&quot; pool into the &quot;UVM Agent&quot; area.
        </p>
        <p className="text-muted-foreground">
          Correctly assembling these core pieces is fundamental to creating any UVM verification environment.
        </p>
      </section>

      <div className="my-8 border-t border-b border-border py-8">
        <UvmAgentBuilderExercise />
      </div>

      <section className="mt-6">
        <h3 className="text-xl font-semibold text-primary mb-2">Learning Objectives:</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-1">
          <li>Identify the core components of a UVM agent.</li>
          <li>Understand the typical internal structure of an agent.</li>
          <li>Practice visual assembly of a key UVM architectural pattern.</li>
        </ul>
        {/* TODO: Add Scoring, Feedback, and Retry button integration in later steps */}
      </section>
    </>
  );

  return (
    // Using InfoPage provides a consistent layout with a title and content area
    <InfoPage title={pageTitle}>
      {content}
    </InfoPage>
  );
};

export default UvmAgentBuilderPage;

export async function generateMetadata() {
  return {
    title: "Exercise: UVM Agent Builder | SystemVerilog & UVM Mastery",
    description: "Interactive exercise to build a UVM agent by dragging and dropping its core components: sequencer, driver, and monitor.",
  };
}
