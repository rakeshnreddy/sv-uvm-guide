export interface CoverageExample {
  name: string;
  code: string;
  steps: string[];
  coverpoints: { name: string; bins: { name: string; isCovered: boolean }[] }[];
}

export const coverageData: CoverageExample[] = [
  {
    name: 'Simple Coverpoint',
    code: 'covergroup cg;\n  cp_data: coverpoint data;\nendgroup',
    steps: [
      'A covergroup `cg` is defined to collect coverage.',
      'A coverpoint `cp_data` is created to track the values of the `data` variable.',
      'By default, the simulator will create automatic bins for the possible values of `data`.',
    ],
    coverpoints: [
      {
        name: 'cp_data',
        bins: [
          { name: 'auto[0]', isCovered: false },
          { name: 'auto[1]', isCovered: true },
          { name: 'auto[2]', isCovered: false },
        ],
      },
    ],
  },
  {
    name: 'Custom Bins',
    code: 'covergroup cg;\n  cp_data: coverpoint data {\n    bins low = {0, 1};\n    bins high = {2, 3};\n  }\nendgroup',
    steps: [
      'Custom bins `low` and `high` are defined for the coverpoint `cp_data`.',
      'The `low` bin covers the values 0 and 1.',
      'The `high` bin covers the values 2 and 3.',
    ],
    coverpoints: [
      {
        name: 'cp_data',
        bins: [
          { name: 'low', isCovered: true },
          { name: 'high', isCovered: false },
        ],
      },
    ],
  },
  {
    name: 'Cross Coverage',
    code: 'covergroup cg;\n  cp_a: coverpoint a;\n  cp_b: coverpoint b;\n  cross cp_a, cp_b;\nendgroup',
    steps: [
      'A cross coverage `cross cp_a, cp_b` is defined to track the combined values of `a` and `b`.',
      'This creates a cross product of the bins of `cp_a` and `cp_b`.',
      'Coverage is collected when each combination of values is observed.',
    ],
    coverpoints: [
      {
        name: 'cross cp_a, cp_b',
        bins: [
          { name: '(a=0,b=0)', isCovered: true },
          { name: '(a=0,b=1)', isCovered: false },
          { name: '(a=1,b=0)', isCovered: false },
          { name: '(a=1,b=1)', isCovered: true },
        ],
      },
    ],
  },
];
