'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface PackedScenario {
  id: string;
  title: string;
  declaration: string;
  accessOrder: string;
  legend: string;
  walk: string[];
  note: string;
}

const scenarios: PackedScenario[] = [
  {
    id: 'payload',
    title: 'Burst Payload Buffer',
    declaration: 'logic [7:0] payload [0:3];',
    accessOrder: 'payload[slot][bit]',
    legend: 'Unpacked slot is outer, packed byte bits toggle fastest.',
    walk: [
      'payload[0][7] → payload[0][0] before payload[1][7]',
      'payload[1][7] → payload[1][0] → payload[2][7]',
      'payload[3][7] … payload[3][0] closes the burst',
    ],
    note: 'Great mental model for register mirrors: the byte stays intact for each slot.',
  },
  {
    id: 'lane-matrix',
    title: 'Lane Matrix (2 packed dims)',
    declaration: 'bit [3:0][1:0] lane_matrix [0:1];',
    accessOrder: 'lane_matrix[channel][nibble][lane]',
    legend: 'Right-most packed [1:0] lane flips fastest, then nibble, then channel.',
    walk: [
      'lane_matrix[0][3][1:0] sweeps all packed bits',
      'lane_matrix[0][0][1:0] before lane_matrix[1][3][1:0]',
      'channel increments only after packed bits finish',
    ],
    note: 'Helps remember packed ordering when slicing for serializers.',
  },
  {
    id: 'scoreboard',
    title: 'Scoreboard Grid',
    declaration: 'logic [3:0] scoreboard [0:1][0:2];',
    accessOrder: 'scoreboard[row][col][bit]',
    legend: 'Right-most unpacked index (column) advances before row; packed nibble per cell.',
    walk: [
      'scoreboard[0][0][3:0] → scoreboard[0][1][3:0]',
      'scoreboard[0][2][3:0] before scoreboard[1][0][3:0]',
      'Row increments last, after all columns and packed bits',
    ],
    note: 'Maps nicely to coverage bins for row/column oriented checks.',
  },
];

function useScenario(initialId: string) {
  const [currentId, setCurrentId] = useState(initialId);
  const [step, setStep] = useState(0);

  const scenario = useMemo(() => scenarios.find(s => s.id === currentId) ?? scenarios[0], [currentId]);

  const nextStep = () => setStep(prev => (prev + 1) % scenario.walk.length);
  const previousStep = () => setStep(prev => (prev === 0 ? scenario.walk.length - 1 : prev - 1));

  return { scenario, step, setCurrentId, setStep, nextStep, previousStep };
}

export const PackedUnpackedPlayground: React.FC = () => {
  const { scenario, step, setCurrentId, setStep, nextStep, previousStep } = useScenario('payload');

  return (
    <Card className="my-8 border-primary/40 bg-background/80 shadow-lg" data-testid="packed-unpacked-playground">
      <CardHeader>
        <CardTitle className="text-lg">Packed vs. Unpacked Playground</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick a declaration, then walk the memory order. Right-most dimensions — packed or unpacked — always toggle fastest.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist">
          {scenarios.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setCurrentId(option.id);
                setStep(0);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold shadow ${scenario.id === option.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              data-testid={`packed-unpacked-${option.id}`}
              role="tab"
              aria-selected={scenario.id === option.id}
            >
              {option.title}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold" data-testid="packed-unpacked-scenario">
            {scenario.title}
          </p>
          <p className="text-xs text-muted-foreground" data-testid="packed-unpacked-declaration">
            {scenario.declaration}
          </p>
          <p className="mt-2 text-sm" data-testid="packed-unpacked-order">
            Access order: <span className="font-semibold">{scenario.accessOrder}</span>
          </p>
          <p className="text-xs text-muted-foreground">{scenario.legend}</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={previousStep}
            className="rounded-md border px-3 py-2 text-sm font-semibold"
            data-testid="packed-unpacked-previous"
          >
            Step back
          </button>
          <div className="flex-1 rounded-lg border border-dashed border-primary/30 bg-background p-3 text-sm" data-testid="packed-unpacked-grid">
            <p className="font-semibold">Memory walk</p>
            <p className="text-muted-foreground" data-testid="packed-unpacked-step">
              {scenario.walk[step]}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{scenario.note}</p>
          </div>
          <button
            type="button"
            onClick={nextStep}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow"
            data-testid="packed-unpacked-next"
          >
            Next step
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PackedUnpackedPlayground;
