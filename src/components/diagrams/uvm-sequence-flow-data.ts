export interface SequenceFlowStep {
  name: string;
  source: 'Sequence' | 'Sequencer' | 'Driver' | 'DUT';
  target: 'Sequence' | 'Sequencer' | 'Driver' | 'DUT';
  description: string;
}

export const uvmSequenceFlowData: SequenceFlowStep[] = [
  {
    name: 'start_item',
    source: 'Sequence',
    target: 'Sequencer',
    description: 'The sequence calls `start_item()` to request access to the sequencer.',
  },
  {
    name: 'grant',
    source: 'Sequencer',
    target: 'Sequence',
    description: 'The sequencer grants access to the sequence.',
  },
  {
    name: 'pre_do',
    source: 'Sequence',
    target: 'Sequence',
    description: 'The sequence calls the `pre_do` hook.',
  },
  {
    name: 'mid_do',
    source: 'Sequence',
    target: 'Sequence',
    description: 'The sequence calls the `mid_do` hook.',
  },
  {
    name: 'finish_item',
    source: 'Sequence',
    target: 'Sequencer',
    description: 'The sequence calls `finish_item()` to send the sequence item to the driver.',
  },
  {
    name: 'get_next_item',
    source: 'Driver',
    target: 'Sequencer',
    description: 'The driver calls `get_next_item()` to request a new sequence item.',
  },
  {
    name: 'item_done',
    source: 'Driver',
    target: 'Sequencer',
    description: 'The driver calls `item_done()` to indicate that it has finished processing the sequence item.',
  },
  {
    name: 'post_do',
    source: 'Sequence',
    target: 'Sequence',
    description: 'The sequence calls the `post_do` hook.',
  },
];
