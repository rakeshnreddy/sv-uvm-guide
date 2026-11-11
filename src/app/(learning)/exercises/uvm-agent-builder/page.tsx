import React from 'react';
import UvmAgentBuilderExercise from '@/components/exercises/UvmAgentBuilderExercise';
import { PracticeInfoPage } from '@/components/practice/PracticeInfoPage';
import LearnInLesson from '@/components/practice/LearnInLesson';
import { requirePracticePage } from '@/lib/practice-links';

// The back link and lesson list come from the practice map (src/lib/practice-links.ts).
const HREF = '/exercises/uvm-agent-builder';
const practice = requirePracticePage(HREF);

const UvmAgentBuilderPage: React.FC = () => {
  const pageTitle = practice.title;

  const content = (
    <>
      <LearnInLesson item={practice} variant="row" />
      <section className="mb-6 max-w-[30em]">
        <h2 className="text-h2 mb-2 text-foreground">Build a UVM agent</h2>
        <p className="text-muted-foreground mb-1">
          Choose whether the agent is active or passive, then place the components it should build. Use the buttons or drag and drop; order inside the agent does not matter.
        </p>
        <p className="text-muted-foreground">
          An active agent builds a sequencer, driver and monitor; a passive agent builds only the monitor, which is how block-level agents are reused at subsystem level.
        </p>
      </section>

      <div className="not-prose my-8 border-y border-border py-8">
        <UvmAgentBuilderExercise />
      </div>

      <section className="mt-6 max-w-[30em]">
        <h3 className="text-h3 mb-2 text-foreground">Learning objectives</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Identify the core components of a UVM agent.</li>
          <li>Explain what changes between active and passive agents, and why.</li>
          <li>Connect the choice to the get_is_active() check inside build_phase.</li>
        </ul>
        <p className="text-muted-foreground mt-4">Check your build and use Retry to start over.</p>
      </section>
    </>
  );

  return (
    <PracticeInfoPage href={HREF} title={pageTitle}>
      {content}
    </PracticeInfoPage>
  );
};

export default UvmAgentBuilderPage;

export async function generateMetadata() {
  return {
    title: practice.title,
    description: "Interactive exercise: choose an active or passive UVM agent and build it from its components, sequencer, driver and monitor, with feedback on the get_is_active() rule.",
  };
}
