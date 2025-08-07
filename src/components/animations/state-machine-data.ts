export interface State {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface Transition {
  source: string;
  target: string;
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
    name: 'Sequence Detector',
    states: [
      { id: 'q0', name: 'IDLE', x: 100, y: 100 },
      { id: 'q1', name: 'S1', x: 300, y: 100 },
      { id: 'q2', name: 'S10', x: 300, y: 300 },
      { id: 'q3', name: 'FOUND', x: 100, y: 300 },
    ],
    transitions: [
      { source: 'q0', target: 'q1' },
      { source: 'q1', target: 'q2' },
      { source: 'q2', target: 'q3' },
      { source: 'q3', target: 'q0' },
    ],
  },
];
