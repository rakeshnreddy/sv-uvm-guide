export interface RandomizationExample {
  name: string;
  code: string;
  steps: string[];
  variables: string[];
}

export const randomizationData: RandomizationExample[] = [
  {
    name: 'Simple Randomization',
    code: 'class Packet;\n  rand bit [7:0] data;\nendclass',
    steps: [
      'The `rand` keyword declares `data` as a random variable.',
      'When `randomize()` is called on an object of this class, the solver assigns a random value to `data`.',
      'The value will be between 0 and 255, inclusive.',
    ],
    variables: ['data'],
  },
  {
    name: 'Constraint Block',
    code: 'class Packet;\n  rand bit [7:0] data;\n  constraint c_data { data > 100; }\nendclass',
    steps: [
      'A constraint block `c_data` is added to limit the possible values of `data`.',
      'The constraint `data > 100` tells the solver to only pick values greater than 100.',
      'The solver will now generate a random value for `data` between 101 and 255.',
    ],
    variables: ['data'],
  },
  {
    name: 'Multiple Constraints',
    code: 'class Packet;\n  rand bit [7:0] data;\n  rand bit [3:0] len;\n  constraint c_len { len < 5; }\n  constraint c_data { data < len * 10; }\nendclass',
    steps: [
      'There are two random variables, `data` and `len`.',
      'The constraint `c_len` limits `len` to be less than 5.',
      'The constraint `c_data` creates a relationship between `data` and `len`.',
      'The solver will first pick a value for `len` (0-4), and then pick a value for `data` that satisfies the second constraint.',
    ],
    variables: ['data', 'len'],
  },
];
