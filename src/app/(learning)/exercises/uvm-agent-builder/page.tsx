import React from 'react';
import UvmAgentBuilderExercise from '@/components/exercises/UvmAgentBuilderExercise';
import { InfoPage } from '@/components/templates/InfoPage';
import LearnInLesson from '@/components/practice/LearnInLesson';
import { requirePracticePage } from '@/lib/practice-links';

// The back link and lesson list come from the practice map (src/lib/practice-links.ts).
const practice = requirePracticePage('/exercises/uvm-agent-builder');

const UvmAgentBuilderPage: React.FC = () => {
  const pageTitle = "Exercise: UVM Agent Builder";

  const content = (
    <>
      <LearnInLesson item={practice} />
      <section className="mb-6">
        <h2 className="text-2xl font-semibold text-primary mb-2">Build a UVM Agent</h2>
        <p className="text-muted-foreground mb-1">
          Choose whether the agent is active or passive, then place the components it should build. Use the buttons or drag and drop; order inside the agent does not matter.
        </p>
        <p className="text-muted-foreground">
          An active agent builds a sequencer, driver and monitor; a passive agent builds only the monitor, which is how block-level agents are reused at subsystem level.
        </p>
      </section>

      <div className="my-8 border-t border-b border-border py-8">
        <UvmAgentBuilderExercise />
      </div>

      <section className="mt-6">
        <h3 className="text-xl font-semibold text-primary mb-2">Learning objectives</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-1">
          <li>Identify the core components of a UVM agent.</li>
          <li>Explain what changes between active and passive agents, and why.</li>
          <li>Connect the choice to the get_is_active() check inside build_phase.</li>
        </ul>
        <p className="text-muted-foreground mt-4">Check your build and use Retry to start over.</p>
      </section>
    </>
  );

  return (
    <InfoPage title={pageTitle}>
      {content}
    </InfoPage>
  );
};

export default UvmAgentBuilderPage;

export async function generateMetadata() {
  return {
    title: "Exercise: UVM Agent Builder",
    description: "Interactive exercise: choose an active or passive UVM agent and build it from its components, sequencer, driver and monitor, with feedback on the get_is_active() rule.",
  };
}
