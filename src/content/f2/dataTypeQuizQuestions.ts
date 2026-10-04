import type { DataTypeQuizQuestion } from '@/components/curriculum/f2/DataTypeQuiz';

/**
 * F2A data-type quiz. Every option carries feedback that names the
 * misconception behind it. Clause numbers were checked against IEEE 1800-2023.
 */
export const dataTypeQuizQuestions: DataTypeQuizQuestion[] = [
  {
    question:
      'Several IP blocks drive a shared tri-state bus in different cycles, each through its own continuous assignment. Which declaration accepts all of those drivers and reads z when nobody drives?',
    options: ['bit [31:0] shared_bus;', 'logic [31:0] shared_bus;', 'wire [31:0] shared_bus;', 'int shared_bus;'],
    correctAnswerIndex: 2,
    optionFeedback: [
      'bit is a 2-state variable: it cannot hold z, and a variable may have only one continuous driver (§6.5).',
      'logic is a variable. A second continuous assignment to it is a compile error, not a resolved bus (§6.5).',
      'A net resolves any number of continuous drivers by strength (§6.5, §6.6.1) and reads z when every driver is off (§6.7.1).',
      'int is a 2-state variable: it cannot hold z and accepts only one continuous driver (§6.5).',
    ],
    explanation:
      'Only nets resolve multiple continuous drivers. wire/tri combine them by strength, and with every driver off the net floats at z, so an idle bus is visible in simulation.',
  },
  {
    question:
      'You are writing a synthesizable counter in RTL. Which declaration lets simulation expose a missing reset instead of hiding it?',
    options: ['logic [15:0] count;', 'bit [15:0] count;', 'int count;', 'byte count;'],
    correctAnswerIndex: 0,
    optionFeedback: [
      "logic is 4-state and starts at 'x (Table 6-7). If no reset ever assigns count, the x shows up in waveforms and checks.",
      'bit starts at 0 (Table 6-7), so a counter without reset looks perfectly initialized in simulation while silicon powers up random. 2-state RTL hides the bug.',
      'int is 2-state (starts at 0) and fixed at 32 bits, so it both hides a missing reset and ignores the width you meant.',
      'byte is 2-state, signed and only 8 bits: it hides a missing reset and cannot count to 16 bits.',
    ],
    explanation:
      "Use 4-state logic in RTL. A 2-state type starts at 0 and turns any x it receives into 0 (§6.11.2), which masks missing resets and creates simulation/silicon mismatches.",
  },
  {
    question: 'A logic signal reads x long after reset deasserts. Which explanation is consistent with the standard?',
    options: [
      'Two always blocks write it with different values, and the conflict resolves to x.',
      'Nothing in the reset branch assigns it, so it still holds its starting value of x.',
      'It is declared bit, which turns 1s into x.',
      'Two continuous assignments drive it with opposite values, and the variable resolves the fight to x.',
    ],
    correctAnswerIndex: 1,
    optionFeedback: [
      'Procedural writes to a variable never resolve: the last write wins (§6.5). Two always blocks give a race between 0 and 1, not an x.',
      "A 4-state variable starts at 'x (Table 6-7) and keeps it until something assigns it. A missing reset assignment, or an x arriving from an input, is the usual cause.",
      'bit is 2-state: it cannot hold x at all. Writing x into it gives 0 (§6.11.2).',
      'A variable has no resolution function: two continuous assignments to it are a compile error (§6.5). Only nets resolve equal-strength 0 vs 1 to x.',
    ],
    explanation:
      'A variable stuck at x usually was never assigned (its default is x) or received x from an input. An x from a fight between drivers only happens on nets, at equal strength.',
  },
  {
    question: 'You need to accumulate positive and negative latency deltas in a scoreboard. Which declaration avoids accidental wrap-around?',
    options: ['logic [7:0] latency_delta;', 'int latency_delta;', 'bit [7:0] latency_delta;', 'wire [7:0] latency_delta;'],
    correctAnswerIndex: 1,
    optionFeedback: [
      'logic [7:0] is unsigned and 8 bits wide: -1 is stored as 255 and large sums wrap.',
      'int is a signed 32-bit 2-state integer (Table 6-8): negative deltas and large totals fit, and scoreboard math has no reason to carry x.',
      'bit [7:0] is unsigned and 8 bits wide: negative values wrap to large positive ones.',
      'wire is a net: a scoreboard cannot assign it procedurally (§6.5), and it is unsigned and 8 bits wide.',
    ],
    explanation:
      'int is a 2-state, 32-bit, signed integer (Table 6-8). For testbench arithmetic that never needs x, its range and sign are what you want.',
  },
  {
    question:
      'You want a flag to start unknown until reset logic assigns it, so any path that forgets to drive it stands out. Which declaration does that?',
    options: ['bit ready;', 'logic ready;', 'int ready;', 'byte ready;'],
    correctAnswerIndex: 1,
    optionFeedback: [
      'bit is 2-state and starts at 0 (Table 6-7): the forgotten path looks like a legitimate 0.',
      "logic is 4-state and starts at 'x (Table 6-7). Until something assigns it, the x stays visible.",
      'int is 2-state and starts at 0 (Table 6-7), so it cannot show "unassigned".',
      'byte is 2-state and starts at 0 (Table 6-7), so it cannot show "unassigned".',
    ],
    explanation: "4-state integral variables start at 'x and 2-state ones at 0 (IEEE 1800-2023 §6.8, Table 6-7).",
  },
];

export type { DataTypeQuizQuestion };
