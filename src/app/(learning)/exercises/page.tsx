import React from 'react';
import { InfoPage } from '@/components/templates/InfoPage';
import ExerciseList from '@/components/exercises/ExerciseList'; // Import the new client component

interface ExerciseLink { // This interface can be moved to a shared types file if used elsewhere
  href: string;
  title: string;
  description: string;
  status: 'completed' | 'wip' | 'planned';
}

const exercises: ExerciseLink[] = [
  {
    href: '/exercises/uvm-agent-builder',
    title: 'UVM Agent Builder',
    description: 'Drag and drop components to build a complete UVM agent (Sequencer, Driver, Monitor).',
    status: 'completed',
  },
  {
    href: '/exercises/uvm-phase-sorter',
    title: 'UVM Phase Sorter',
    description: 'Correctly order the UVM runtime phases in a dynamic, sortable list.',
    status: 'completed',
  },
  {
    href: '/exercises/scoreboard-connector',
    title: 'Scoreboard Connector',
    description: 'Visually connect monitor analysis ports to scoreboard and coverage collector import ports.',
    status: 'completed',
  },
  {
    href: '/exercises/sequencer-arbitration',
    title: 'Sequencer Arbitration Sandbox',
    description: 'Play with lock(), grab(), and arbitration settings to see which sequence the sequencer grants next.',
    status: 'completed',
  },
  // Add more exercises as they are conceptualized
];

const ExercisesLandingPage: React.FC = () => {
  const pageTitle = "Interactive Learning Exercises";

  const content = (
    <>
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-primary mb-3">Test Your Knowledge!</h2>
        <p className="mb-4">
          Put your SystemVerilog and UVM knowledge to the test with these interactive exercises. Each exercise is designed to be engaging and provide instant feedback to help reinforce key concepts. Your scores will be saved to track your progress.
        </p>
        <p>
          Select an exercise below to get started. More exercises will be added over time!
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-primary mb-4">Available Exercises</h2>
        <ExerciseList exercises={exercises} />
      </section>
    </>
  );

  return (
    <InfoPage title={pageTitle}>
      {content}
    </InfoPage>
  );
};

export default ExercisesLandingPage;

export async function generateMetadata() {
  return {
    title: "Learning Exercises | SystemVerilog & UVM Mastery",
    description: "Engage with interactive exercises to test and reinforce your SystemVerilog and UVM knowledge. Build UVM components, sort phases, and more!",
  };
}
