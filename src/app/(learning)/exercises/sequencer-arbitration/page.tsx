import React from 'react';
import { InfoPage } from '@/components/templates/InfoPage';
import SequencerArbitrationSandbox from '@/components/exercises/SequencerArbitrationSandbox';

export const metadata = {
  title: 'Sequencer Arbitration Sandbox | Interactive UVM Exercise',
  description:
    'Predict UVM sequencer grants: the five arbitration modes, priorities, lock() and grab(), checked against a model of uvm-core 2020.3.1.',
};

const SequencerArbitrationPage: React.FC = () => {
  return (
    <InfoPage title="Sequencer Arbitration Sandbox">
      <p className="mb-6 text-muted-foreground">
        Three sequences share one driver. Choose a scenario or edit the sequences, predict which one the sequencer grants, then read the
        reason it gives for every candidate. The rules follow <code>uvm_sequencer_base</code> in uvm-core 2020.3.1: arbitration runs when the
        driver calls <code>get_next_item()</code>, a <code>lock()</code> is held until <code>unlock()</code>, and <code>grab()</code> jumps to
        the front of the queue.
      </p>
      <SequencerArbitrationSandbox />
    </InfoPage>
  );
};

export default SequencerArbitrationPage;

