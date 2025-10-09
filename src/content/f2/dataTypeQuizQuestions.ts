import type { DataTypeQuizQuestion } from '@/components/curriculum/f2/DataTypeQuiz';

export const dataTypeQuizQuestions: DataTypeQuizQuestion[] = [
  {
    question:
      'You are wiring a shared tri-state bus that several IP blocks can drive in different cycles. Which declaration keeps the bus observable when nobody is actively driving it?',
    options: [
      'bit [31:0] shared_bus;',
      'logic [31:0] shared_bus;',
      'wire [31:0] shared_bus;',
      'int shared_bus;',
    ],
    correctAnswerIndex: 2,
    explanation:
      "A net such as wire preserves 0/1/X/Z and resolves multiple continuous drivers (§6.7). It defaults to 'z when undriven, so floating buses are obvious in simulation.",
  },
  {
    question:
      'You are writing a synthesizable counter that increments every clock. Which declaration keeps the toolchain in the fast 2-state value system?',
    options: ['logic [15:0] count;', 'bit [15:0] count;', 'reg [15:0] count;', 'byte count;'],
    correctAnswerIndex: 1,
    explanation:
      'bit packed arrays are 2-state (§6.4) yet synthesise cleanly to flip-flops. They avoid unnecessary X-propagation while keeping arithmetic simple.',
  },
  {
    question: 'Your simulation shows a signal stuck at X after reset deasserts. What is the most likely root cause?',
    options: [
      'The variable was declared as bit and therefore lost precision.',
      'Two procedural blocks are driving the same signal with different values.',
      'The net was declared as wire, so it cannot settle to 0 or 1.',
      'The signal is using a signed type and needs casting.',
    ],
    correctAnswerIndex: 1,
    explanation:
      'Concurrent drivers with conflicting strengths resolve to X (§6.1). Either consolidate the drivers or convert the signal to a net with deterministic arbitration.',
  },
  {
    question: 'You need to accumulate positive and negative latency deltas in a scoreboard. Which declaration avoids accidental wrap-around?',
    options: [
      'logic [7:0] latency_delta;',
      'int latency_delta;',
      'bit [7:0] latency_delta;',
      'wire [7:0] latency_delta;',
    ],
    correctAnswerIndex: 1,
    explanation:
      'int is a signed 32-bit 2-state integer (§6.10). It natively represents negative values without manual sign-extension, making arithmetic predictable.',
  },
  {
    question:
      'You want a register to power up unknown until reset logic assigns it, catching any paths that forget to drive it. Which declaration makes the simulator shout at you?',
    options: ['bit ready;', 'logic ready;', 'int ready;', 'byte ready;'],
    correctAnswerIndex: 1,
    explanation:
      "logic is four-state and initialises to 'x (§6.8). Leaving it unassigned after reset keeps the X visible so you cannot miss the missing assignment.",
  },
];

export type { DataTypeQuizQuestion };
