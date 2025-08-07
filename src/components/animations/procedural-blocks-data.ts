export interface ProceduralBlockExample {
  name: string;
  code: string;
  steps: string[];
}

export const proceduralBlocksData: ProceduralBlockExample[] = [
  {
    name: 'Blocking vs. Non-blocking',
    code: 'initial begin\n  a = b;\n  b = a;\nend\n\nalways @(posedge clk) begin\n  a <= b;\n  b <= a;\nend',
    steps: [
      't0: initial block executes with blocking assignments',
      't1: always block schedules non-blocking assignments',
      't2: non-blocking assignments take effect'
    ],
  },
  {
    name: 'Fork/Join',
    code: 'initial begin\n  fork\n    #5 a = 1;\n    #10 b = 2;\n  join\nend',
    steps: [
      't0: parallel threads start',
      't1',
      't2',
      't3',
      't4',
      't5: thread 1 assigns a',
      't6',
      't7',
      't8',
      't9',
      't10: thread 2 assigns b and join completes',
    ],
  },
  {
    name: 'Event Control',
    code: 'initial begin\n  @(posedge clk);\n  a = 1;\nend',
    steps: [
      'Waiting for posedge clk',
      'posedge clk detected',
      'a assigned'
    ],
  },
  {
    name: 'Wait Statement',
    code: 'initial begin\n  wait(done);\n  a = 1;\nend',
    steps: [
      'Waiting for done',
      'done goes high',
      'a assigned'
    ],
  },
  {
    name: '#Delay',
    code: 'initial begin\n  a = 0;\n  #5 a = 1;\nend',
    steps: [
      't0: a = 0',
      'waiting 5 time units',
      't5: a = 1'
    ],
  },
  {
    name: 'Loop',
    code: 'initial begin\n  repeat (3) begin\n    #1 a = a + 1;\n  end\nend',
    steps: [
      'iteration 1',
      'iteration 2',
      'iteration 3',
      'loop complete'
    ],
  },
  {
    name: 'Task vs Function',
    code: 'task automatic t;\n  #1 a = a + 1;\nendtask\n\nfunction automatic int f;\n  return a + 1;\nendfunction\n\ninitial begin\n  a = f();\n  t();\nend',
    steps: [
      'Initial state',
      'Function f executes immediately',
      'Task t executes with delay',
      'Task t completed'
    ],
  },
];
