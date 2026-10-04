import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { InfoPage } from '@/components/templates/InfoPage';
import { PracticeCardGrid } from '@/components/practice/PracticeHub';
import { getPracticePages } from '@/lib/practice-links';

export const metadata: Metadata = {
  title: 'Learning Exercises',
  description:
    'Interactive SystemVerilog and UVM exercises with instant feedback: sort the UVM phases, build an agent, wire a scoreboard and predict sequencer arbitration.',
};

const ExercisesLandingPage: React.FC = () => {
  // Same registry as the Practice Hub, in curriculum order.
  const exercises = getPracticePages().filter((item) => item.kind === 'exercise');

  return (
    <InfoPage title="Interactive Learning Exercises">
      <section className="mb-8">
        <p className="mb-4">
          Each exercise checks your answer straight away and explains what is wrong. Your best score is kept in this browser.
          They are listed in curriculum order, and each card names the lesson that teaches the idea.
        </p>
        <p>
          For guided labs, interactive models and interview questions, see the{' '}
          <Link href="/practice">Practice Hub</Link>.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold text-primary">Available exercises</h2>
        <PracticeCardGrid items={exercises} />
      </section>
    </InfoPage>
  );
};

export default ExercisesLandingPage;
