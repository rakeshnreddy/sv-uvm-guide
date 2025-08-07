export interface SequenceFlowStep {
  name: string;
  source: string;
  target: string;
  description: string;
  /** Optional name of the step this action acknowledges. */
  ackFor?: string;
}

export interface SequenceDefinition {
  id: string;
  name: string;
  steps: SequenceFlowStep[];
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

export const sequenceLibrary: SequenceDefinition[] = [
  {
    id: 'basic',
    name: 'Basic Sequence Flow',
    steps: uvmSequenceFlowData,
  },
  {
    id: 'handshake',
    name: 'Driver Handshake',
    steps: [
      {
        name: 'request_item',
        source: 'Driver',
        target: 'Sequencer',
        description: 'Driver requests a sequence item from the sequencer.',
      },
      {
        name: 'ack_item',
        source: 'Sequencer',
        target: 'Driver',
        description: 'Sequencer acknowledges the request.',
        ackFor: 'request_item',
      },
      {
        name: 'drive_item',
        source: 'Driver',
        target: 'DUT',
        description: 'Driver drives the item to the DUT.',
      },
      {
        name: 'response',
        source: 'DUT',
        target: 'Driver',
        description: 'DUT provides a response.',
      },
    ],
  },
  {
    id: 'virtual',
    name: 'Virtual Sequence Arbitration',
    steps: [
      {
        name: 'start_seq_a',
        source: 'VirtualSequence',
        target: 'SequenceA',
        description: 'Virtual sequence starts Sequence A.',
      },
      {
        name: 'start_seq_b',
        source: 'VirtualSequence',
        target: 'SequenceB',
        description: 'Virtual sequence starts Sequence B.',
      },
      {
        name: 'request_a',
        source: 'SequenceA',
        target: 'Sequencer',
        description: 'Sequence A requests the sequencer.',
      },
      {
        name: 'request_b',
        source: 'SequenceB',
        target: 'Sequencer',
        description: 'Sequence B requests the sequencer.',
      },
      {
        name: 'grant_a',
        source: 'Sequencer',
        target: 'SequenceA',
        description: 'Sequencer grants Sequence A access (arbitration).',
      },
      {
        name: 'send_a',
        source: 'SequenceA',
        target: 'Driver',
        description: 'Sequence A sends item to driver.',
      },
      {
        name: 'grant_b',
        source: 'Sequencer',
        target: 'SequenceB',
        description: 'Sequencer then grants Sequence B access.',
      },
      {
        name: 'send_b',
        source: 'SequenceB',
        target: 'Driver',
        description: 'Sequence B sends item to driver.',
      },
    ],
  },
];
