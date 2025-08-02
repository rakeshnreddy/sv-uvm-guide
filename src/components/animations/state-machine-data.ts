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
];
