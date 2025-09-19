import React from 'react';
import { InfoPage } from '@/components/templates/InfoPage';
import SequencerArbitrationSandbox from '@/components/exercises/SequencerArbitrationSandbox';

export const metadata = {
  title: 'Sequencer Arbitration Sandbox | Interactive UVM Exercise',
  description:
    'Experiment with UVM sequencer arbitration—lock, grab, and priority modes—in an interactive sandbox.',
};

const SequencerArbitrationPage: React.FC = () => {
  return (
    <InfoPage title="Sequencer Arbitration Sandbox">
      <p className="mb-6 text-muted-foreground">
        Queue transactions, explore <code>lock()</code> and <code>grab()</code>, and compare arbitration modes. This sandbox mirrors the
        decision logic discussed in the Tier&nbsp;2 sequencing module so you can build intuition before coding.
      </p>
      <SequencerArbitrationSandbox />
    </InfoPage>
  );
};

export default SequencerArbitrationPage;

