export interface Constraint {
  name: string;
  expression: string;
  dependsOn: string[];
  check: (
    values: { [key: string]: number },
    weight: number
  ) => { ok: boolean; reason?: string };
}

export interface RandomizationExample {
  name: string;
  code: string;
  steps: string[];
  variables: string[];
  constraints: Constraint[];
  preRandomize?: () => string;
  postRandomize?: (values: { [key: string]: number }) => string;
  distributionKey?: string;
  showWeightControl?: boolean;
  weightLabel?: string;
  weightDescription?: string;
  defaultWeight?: number;
  defaultSampleCount?: number;
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
      constraints: [],
      distributionKey: 'data',
      defaultWeight: 50,
      defaultSampleCount: 25,
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
      constraints: [
        {
          name: 'c_data',
          expression: 'data > 100 (override: 200)',
          dependsOn: ['data'],
          check: (values, w) => {
            const useOverride = Math.random() * 100 < w;
            const threshold = useOverride ? 200 : 100;
            if (values.data <= threshold) {
              return {
                ok: false,
                reason: `data (${values.data}) <= ${threshold} (${useOverride ? 'override' : 'base'})`,
              };
            }
            return { ok: true };
          },
        },
      ],
      preRandomize: () => 'pre_randomize called',
      postRandomize: values => `post_randomize: data=${values.data}`,
      distributionKey: 'data',
      showWeightControl: true,
      weightLabel: 'Override Weight',
      weightDescription: 'Increase to bias toward the override threshold; lower values let the base constraint win more often.',
      defaultWeight: 50,
      defaultSampleCount: 25,
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
      constraints: [
        {
          name: 'c_len',
          expression: 'len < 5',
          dependsOn: ['len'],
          check: values => {
            if (values.len >= 5) {
              return { ok: false, reason: `len (${values.len}) >= 5` };
            }
            return { ok: true };
          },
        },
        {
          name: 'c_data',
          expression: 'data < len * 10',
          dependsOn: ['data', 'len'],
          check: values => {
            if (values.data >= values.len * 10) {
              return {
                ok: false,
                reason: `data (${values.data}) >= len*10 (${values.len * 10})`,
              };
            }
            return { ok: true };
          },
        },
      ],
      preRandomize: () => 'pre_randomize called',
      postRandomize: values => `post_randomize: data=${values.data}, len=${values.len}`,
      distributionKey: 'data',
      defaultWeight: 50,
      defaultSampleCount: 25,
    },
    {
      name: 'Conflicting Constraints',
      code: 'class Packet;\n  rand bit [7:0] data;\n  constraint c_low { data inside {[0:15]}; }\n  constraint c_high { data >= 200; }\nendclass',
      steps: [
        'Two hard constraints intentionally pull `data` in opposite directions.',
        'With both enabled the solver exhausts its attempts—toggle one constraint off to let a solution through.',
        'Use batch sampling to watch the success rate recover once the conflict is resolved.',
      ],
      variables: ['data'],
      constraints: [
        {
          name: 'c_low',
          expression: 'data inside {[0:15]}',
          dependsOn: ['data'],
          check: values => {
            if (values.data <= 15) {
              return { ok: true };
            }
            return { ok: false, reason: `data (${values.data}) > 15` };
          },
        },
        {
          name: 'c_high',
          expression: 'data >= 200',
          dependsOn: ['data'],
          check: values => {
            if (values.data >= 200) {
              return { ok: true };
            }
            return { ok: false, reason: `data (${values.data}) < 200` };
          },
        },
      ],
      preRandomize: () => 'pre_randomize: conflicting constraint demo',
      postRandomize: values => `post_randomize: data=${values.data}`,
      distributionKey: 'data',
      defaultWeight: 50,
      defaultSampleCount: 25,
    },
];
