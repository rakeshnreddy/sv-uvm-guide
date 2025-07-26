import React from 'react';
import UvmPhaseSorterExercise from '@/components/exercises/UvmPhaseSorterExercise';
import { InfoPage } from '@/components/templates/InfoPage';

const UvmPhaseSorterPage: React.FC = () => {
  const pageTitle = "Exercise: UVM Phase Sorter";

  const content = (
    <>
      <section className="mb-6">
        <h2 className="text-2xl font-semibold text-primary mb-2">Order the UVM Phases</h2>
        <p className="text-muted-foreground mb-1">
          Drag and drop the UVM phases into their correct order of execution.
        </p>
        <p className="text-muted-foreground">
          Understanding the UVM phasing mechanism is crucial for controlling the behavior and synchronization of your testbench components throughout a simulation.
        </p>
      </section>

      <div className="my-8 flex justify-center">
        <UvmPhaseSorterExercise />
      </div>

      <section className="mt-6">
        <h3 className="text-xl font-semibold text-primary mb-2">Learning Objectives:</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-1">
          <li>Recall the standard UVM runtime phases.</li>
          <li>Understand the sequential nature of UVM phasing.</li>
          <li>Practice organizing a key aspect of UVM testbench flow.</li>
        </ul>
        {/* TODO: Add Scoring, Feedback, and Retry button integration in later steps */}
      </section>
    </>
  );

  return (
    <InfoPage title={pageTitle}>
      {content}
    </InfoPage>
  );
};

export default UvmPhaseSorterPage;

export async function generateMetadata() {
  return {
    title: "Exercise: UVM Phase Sorter | SystemVerilog & UVM Mastery",
    description: "Interactive exercise to sort UVM phases into their correct order of execution. Test your knowledge of the UVM phasing mechanism.",
  };
}
