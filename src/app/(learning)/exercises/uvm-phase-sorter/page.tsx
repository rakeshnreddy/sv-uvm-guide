import React from 'react';
import UvmPhaseSorterExercise from '@/components/exercises/UvmPhaseSorterExercise';
import { InfoPage } from '@/components/templates/InfoPage';
import LearnInLesson from '@/components/practice/LearnInLesson';
import { requirePracticePage } from '@/lib/practice-links';

// The back link and lesson list come from the practice map (src/lib/practice-links.ts).
const practice = requirePracticePage('/exercises/uvm-phase-sorter');

const UvmPhaseSorterPage: React.FC = () => {
  const pageTitle = "Exercise: UVM Phase Sorter";

  const content = (
    <>
      <LearnInLesson item={practice} />
      <section className="mb-6">
        <h2 className="text-2xl font-semibold text-primary mb-2">Order the UVM Phases</h2>
        <p className="text-muted-foreground mb-1">
          Put each lane in execution order: the common phases from build to final, and the twelve run-time phases that run beside run_phase.
          Then mark every function phase top-down or bottom-up.
        </p>
        <p className="text-muted-foreground">
          The order decides when each component is built, connected and checked, so a phase in the wrong place is a real testbench bug.
        </p>
      </section>

      <div className="my-8 flex justify-center">
        <UvmPhaseSorterExercise />
      </div>

      <section className="mt-6">
        <h3 className="text-xl font-semibold text-primary mb-2">Learning objectives</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-1">
          <li>Recall the standard UVM runtime phases.</li>
          <li>See that run_phase runs alongside the twelve runtime phases, while function phases run top-down or bottom-up.</li>
          <li>Practice organizing a key aspect of UVM testbench flow.</li>
        </ul>
        <p className="text-muted-foreground mt-4">Use Check Order to grade both lanes and Shuffle Again to start over.</p>
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
    title: "Exercise: UVM Phase Sorter",
    description: practice.description,
  };
}
