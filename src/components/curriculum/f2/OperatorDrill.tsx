'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

type TruthValue = 0 | 1 | 'X' | 'Z';

interface DrillScenario {
  id: string;
  title: string;
  description: string;
  a: TruthValue;
  b: TruthValue;
  op: string;
  evaluate: (a: TruthValue, b: TruthValue) => string;
  tip: string;
}

const scenarios: DrillScenario[] = [
  {
    id: 'bitwise-vs-logical',
    title: 'Bitwise vs Logical',
    description: 'Same operands, different intent: mask bits or check truthiness.',
    a: 1,
    b: 0,
    op: '& vs &&',
    evaluate: (a, b) => `a & b = ${Number(a) & Number(b)}, a && b = ${(Number(a) && Number(b)) ? 1 : 0}`,
    tip: 'Use logical operators in control flow, bitwise for vector math.',
  },
  {
    id: 'case-equality',
    title: 'Case Equality',
    description: 'Treat X/Z as data, not “don’t care”.',
    a: 'X',
    b: 0,
    op: '=== vs ==',
    evaluate: (a, b) => `a === b → ${a === b ? 1 : 0}, a == b → X`,
    tip: 'Use === when resets or X-propagation matter.',
  },
  {
    id: 'inside',
    title: 'Set Membership',
    description: 'Find whether a value is in a set or range.',
    a: 'X',
    b: 0,
    op: 'inside {1,3,[4:6]}',
    evaluate: () => '4 inside {1,3,[4:6]} → 1 (match range)',
    tip: 'Great for guarding opcodes and constraints without long case statements.',
  },
  {
    id: 'streaming',
    title: 'Streaming Concatenation',
    description: 'Reshape buses while keeping bit order explicit.',
    a: 0,
    b: 0,
    op: '{<<{payload}}',
    evaluate: () => "{<<{16'hA55A}} → 0b1010_0101_0101_1010",
    tip: 'Streaming concatenations avoid manual bit slicing mistakes.',
  },
];

export const OperatorDrill: React.FC = () => {
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const scenario = useMemo(() => scenarios.find(s => s.id === activeId) ?? scenarios[0], [activeId]);

  return (
    <Card className="my-8 border-primary/30 bg-background/80 shadow-lg" data-testid="operator-drill">
      <CardHeader>
        <CardTitle className="text-lg">Operator Drill Station</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare SystemVerilog operators side-by-side. Each scenario highlights why precedence and value systems matter.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist">
          {scenarios.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => setActiveId(option.id)}
              className={`rounded-full px-3 py-2 text-sm font-semibold shadow ${option.id === scenario.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              role="tab"
              aria-selected={option.id === scenario.id}
            >
              {option.title}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="drill-expression">
          <p className="text-sm font-semibold">{scenario.title}</p>
          <p className="text-xs text-muted-foreground">{scenario.description}</p>
          <p className="mt-2 text-sm font-mono" data-testid="drill-operator">
            Operands: a={scenario.a} b={scenario.b} | Operator: {scenario.op}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div
            className="flex-1 rounded-lg border border-dashed border-primary/30 bg-background p-3 text-sm"
            data-testid="drill-result"
          >
            <p className="font-semibold">Evaluation</p>
            <p className="text-muted-foreground">{scenario.evaluate(scenario.a, scenario.b)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Tip: {scenario.tip}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="drill-table">
            <p className="font-semibold text-foreground">Quick truth table</p>
            <ul className="mt-2 space-y-1">
              <li>Bitwise treats every bit; logical collapses to 1 bit.</li>
              <li>`===`/`!==` keep X/Z; `==`/`!=` return X on unknowns.</li>
              <li>`inside` uses case equality semantics.</li>
              <li>Streaming concatenations define direction explicitly.</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OperatorDrill;
