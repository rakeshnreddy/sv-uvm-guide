export interface SvaOperator {
  id: string;
  name: string;
  symbol: string;
  type: 'temporal' | 'logical' | 'repetition';
  description: string;
}

export const svaOperators: SvaOperator[] = [
  {
    id: '1',
    name: 'Implication',
    symbol: '|->',
    type: 'temporal',
    description: 'If the antecedent is true, then the consequent must be true.',
  },
  {
    id: '2',
    name: 'Nexttime',
    symbol: '##1',
    type: 'temporal',
    description: 'The expression will be evaluated on the next clock cycle.',
  },
  {
    id: '3',
    name: 'Eventually',
    symbol: 's_eventually',
    type: 'temporal',
    description: 'The expression must be true at some point in the future.',
  },
  {
    id: '4',
    name: 'And',
    symbol: 'and',
    type: 'logical',
    description: 'Both expressions must be true.',
  },
  {
    id: '5',
    name: 'Or',
    symbol: 'or',
    type: 'logical',
    description: 'At least one of the expressions must be true.',
  },
  {
    id: '6',
    name: 'Not',
    symbol: 'not',
    type: 'logical',
    description: 'The expression must be false.',
  },
  {
    id: '7',
    name: 'Consecutive Repetition',
    symbol: '[*]',
    type: 'repetition',
    description: 'The expression must be true for a number of consecutive clock cycles.',
  },
];
