export interface AssertionPattern {
  id: string;
  name: string;
  code: string;
  description: string;
}

export const assertionPatterns: AssertionPattern[] = [
  {
    id: '1',
    name: 'Handshake',
    code: 'req |-> ##1 gnt',
    description: 'Request must be followed by grant in the next cycle.',
  },
  {
    id: '2',
    name: 'Request Eventually Grant',
    code: 'req s_eventually gnt',
    description: 'Every request should eventually be granted.',
  },
];
