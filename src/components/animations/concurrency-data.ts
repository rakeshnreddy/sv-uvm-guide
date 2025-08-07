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
  {
    name: 'Race Condition',
    code: 'initial_value = 0;\nfork\n  proc_a();\n  proc_b();\njoin',
    steps: [
      'Two processes update a shared variable without synchronization.',
      'The final value depends on the interleaving of operations.',
      'Use a mutex or semaphore to prevent the race condition.',
    ],
    processes: ['proc_a', 'proc_b'],
  },
  {
    name: 'Deadlock',
    code: 'fork\n  proc_a(); // waits for res_b\n  proc_b(); // waits for res_a\njoin',
    steps: [
      'Process A holds resource A and waits for resource B.',
      'Process B holds resource B and waits for resource A.',
      'Neither process can proceed, resulting in deadlock.',
    ],
    processes: ['proc_a', 'proc_b'],
  },
  {
    name: 'Livelock',
    code: 'fork\n  proc_a();\n  proc_b();\njoin',
    steps: [
      'Processes respond to each other and keep changing state.',
      'They remain active but make no real progress (livelock).',
      'Adjust priorities or coordination to resolve the livelock.',
    ],
    processes: ['proc_a', 'proc_b'],
  },
];
