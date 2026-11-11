import React from 'react';
import { PracticeInfoPage } from '@/components/practice/PracticeInfoPage';
import LearnInLesson from '@/components/practice/LearnInLesson';
import { requirePracticePage } from '@/lib/practice-links';
import SequencerArbitrationSandbox from '@/components/exercises/SequencerArbitrationSandbox';

// The back link and lesson list come from the practice map (src/lib/practice-links.ts).
const HREF = '/exercises/sequencer-arbitration';
const practice = requirePracticePage(HREF);

export const metadata = {
  title: practice.title,
  description:
    'Predict UVM sequencer grants: the five arbitration modes, priorities, lock() and grab(), checked against a model of uvm-core 2020.3.1.',
};

const SequencerArbitrationPage: React.FC = () => {
  return (
    <PracticeInfoPage href={HREF} title={practice.title}>
      <LearnInLesson item={practice} variant="row" />
      <p className="mb-6 max-w-[30em] text-muted-foreground">
        Three sequences share one driver. Choose a scenario or edit the sequences, predict which one the sequencer grants, then read the
        reason it gives for every candidate. The rules follow <code>uvm_sequencer_base</code> in uvm-core 2020.3.1: arbitration runs when the
        driver calls <code>get_next_item()</code>, a <code>lock()</code> is held until <code>unlock()</code>, and <code>grab()</code> jumps to
        the front of the queue.
      </p>
      <div className="not-prose">
        <SequencerArbitrationSandbox />
      </div>
    </PracticeInfoPage>
  );
};

export default SequencerArbitrationPage;

