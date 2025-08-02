export interface ConcurrencyExample {
  name: string;
  code: string;
  steps: string[];
  processes: string[];
}

export const concurrencyData: ConcurrencyExample[] = [
  {
    name: 'Fork-Join',
    code: 'fork\n  process_a();\n  process_b();\njoin',
    steps: [
      'The `fork` statement creates two parallel processes.',
      '`process_a()` and `process_b()` start executing concurrently.',
      'The `join` statement waits for both `process_a()` and `process_b()` to finish.',
      'Execution continues after the `join` statement.',
    ],
    processes: ['process_a', 'process_b'],
  },
  {
    name: 'Fork-Join_Any',
    code: 'fork\n  process_a();\n  process_b();\njoin_any',
    steps: [
      'The `fork` statement creates two parallel processes.',
      '`process_a()` and `process_b()` start executing concurrently.',
      'The `join_any` statement waits for either `process_a()` or `process_b()` to finish.',
      'Execution continues as soon as one of the processes finishes.',
    ],
    processes: ['process_a', 'process_b'],
  },
  {
    name: 'Fork-Join_None',
    code: 'fork\n  process_a();\n  process_b();\njoin_none',
    steps: [
      'The `fork` statement creates two parallel processes.',
      '`process_a()` and `process_b()` start executing concurrently.',
      'The `join_none` statement does not wait for the processes to finish.',
      'Execution continues immediately after the `fork` statement.',
    ],
    processes: ['process_a', 'process_b'],
  },
];
