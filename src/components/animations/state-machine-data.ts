export interface State {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface Transition {
  source: string;
  target: string;
  /** Input bit that enables this edge (`in == 0` or `in == 1`). Omitted: unconditional. */
  input?: 0 | 1;
}

export interface StateMachineExample {
  name: string;
  states: State[];
  transitions: Transition[];
}

export const stateMachineData: StateMachineExample[] = [
  {
    name: 'Simple State Machine',
    states: [
      { id: 's1', name: 'IDLE', x: 100, y: 100 },
      { id: 's2', name: 'STATE_A', x: 300, y: 100 },
      { id: 's3', name: 'STATE_B', x: 200, y: 300 },
    ],
    transitions: [
      { source: 's1', target: 's2' },
      { source: 's2', target: 's3' },
      { source: 's3', target: 's1' },
    ],
  },
  {
    name: 'Traffic Light',
    states: [
      { id: 't1', name: 'RED', x: 100, y: 100 },
      { id: 't2', name: 'GREEN', x: 300, y: 100 },
      { id: 't3', name: 'YELLOW', x: 200, y: 300 },
    ],
    transitions: [
      { source: 't1', target: 't2' },
      { source: 't2', target: 't3' },
      { source: 't3', target: 't1' },
    ],
  },
  {
    // Moore detector for the serial pattern 1-0-1, overlapping: each state
    // records the longest suffix of the input seen so far that is a prefix of
    // "101". FOUND (output 1) means the last three bits were 1, 0, 1.
    name: 'Sequence Detector',
    states: [
      { id: 'q0', name: 'IDLE', x: 100, y: 100 },
      { id: 'q1', name: 'S1', x: 300, y: 100 },
      { id: 'q2', name: 'S10', x: 300, y: 300 },
      { id: 'q3', name: 'FOUND', x: 100, y: 300 },
    ],
    transitions: [
      { source: 'q0', target: 'q1', input: 1 }, // "1"
      { source: 'q0', target: 'q0', input: 0 }, // no prefix
      { source: 'q1', target: 'q2', input: 0 }, // "10"
      { source: 'q1', target: 'q1', input: 1 }, // "11": the last 1 may start a match
      { source: 'q2', target: 'q3', input: 1 }, // "101": detected
      { source: 'q2', target: 'q0', input: 0 }, // "100": no prefix left
      { source: 'q3', target: 'q2', input: 0 }, // "1010": overlapping, "10" again
      { source: 'q3', target: 'q1', input: 1 }, // "1011": the last 1 starts a match
    ],
  },
];
