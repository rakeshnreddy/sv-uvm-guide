export interface ProceduralBlockExample {
  name: string;
  code: string;
  steps: string[];
}

export const proceduralBlocksData: ProceduralBlockExample[] = [
  {
    name: 'Initial Block',
    code: 'initial begin\n  a = 1;\n  #10;\n  b = 2;\nend',
    steps: [
      'The initial block starts execution at time 0.',
      'Variable `a` is assigned the value 1.',
      'The simulation waits for 10 time units.',
      'Variable `b` is assigned the value 2.',
      'The initial block finishes execution.',
    ],
  },
  {
    name: 'Always Block',
    code: 'always @(posedge clk) begin\n  q <= d;\nend',
    steps: [
      'The always block is sensitive to the positive edge of `clk`.',
      'When `clk` has a positive edge, the block is triggered.',
      'The value of `d` is assigned to `q` using a non-blocking assignment.',
      'The assignment happens at the end of the current time step.',
    ],
  },
  {
    name: 'Blocking vs. Non-blocking',
    code: 'always @(posedge clk) begin\n  a = b;\n  b = a;\nend\n\nalways @(posedge clk) begin\n  a <= b;\n  b <= a;\nend',
    steps: [
      'The first always block uses blocking assignments (`=`). The assignments are executed sequentially in the order they appear. `b` gets the new value of `a`.',
      'The second always block uses non-blocking assignments (`<=`). The assignments are scheduled to happen at the end of the time step. `a` and `b` are swapped correctly.',
    ],
  },
  {
    name: 'Fork/Join',
    code: 'initial begin\n  fork\n    #5 a = 1;\n    #10 b = 2;\n  join\nend',
    steps: [
      'Two parallel threads are launched with `fork`.',
      'Thread 1 waits 5 time units then assigns `a`.',
      'Thread 2 waits 10 time units then assigns `b`.',
      'The `join` waits for both threads to complete before continuing.',
    ],
  },
];
