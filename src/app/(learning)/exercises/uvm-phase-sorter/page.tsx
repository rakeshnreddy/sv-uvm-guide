import React from 'react';
import UvmPhaseSorterExercise from '@/components/exercises/UvmPhaseSorterExercise';
import { PracticeInfoPage } from '@/components/practice/PracticeInfoPage';
import LearnInLesson from '@/components/practice/LearnInLesson';
import { requirePracticePage } from '@/lib/practice-links';

// The back link and lesson list come from the practice map (src/lib/practice-links.ts).
const HREF = '/exercises/uvm-phase-sorter';
const practice = requirePracticePage(HREF);

const UvmPhaseSorterPage: React.FC = () => {
  const pageTitle = practice.title;

  const content = (
    <>
      <LearnInLesson item={practice} />
      <section className="mb-6">
        <h2 className="text-h2 mb-2 text-foreground">Order the UVM phases</h2>
        <p className="text-muted-foreground mb-1">
          Put each lane in execution order: the common phases from build to final, and the twelve run-time phases that run beside run_phase.
          Then mark every function phase top-down or bottom-up.
        </p>
        <p className="text-muted-foreground">
          The order decides when each component is built, connected and checked, so a phase in the wrong place is a real testbench bug.
        </p>
      </section>

      <div className="not-prose my-8 flex justify-center">
        <UvmPhaseSorterExercise />
      </div>

      <section className="mt-6">
        <h3 className="text-h3 mb-2 text-foreground">Learning objectives</h3>
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
    <PracticeInfoPage href={HREF} title={pageTitle}>
      {content}
    </PracticeInfoPage>
  );
};

export default UvmPhaseSorterPage;

export async function generateMetadata() {
  return {
    title: practice.title,
    description: practice.description,
  };
}
