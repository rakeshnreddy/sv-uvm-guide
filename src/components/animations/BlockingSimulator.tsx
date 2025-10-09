"use client";

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';

type Mode = 'blocking' | 'nonBlocking';

interface Step {
  title: string;
  blockA: string;
  blockB: string;
  note: string;
  values: Record<string, string>;
}

const codeSamples: Record<Mode, string> = {
  blocking: `always_ff @(posedge clk) begin
  shared = req;        // Blocking: updates immediately
  temp   = shared;     // Reads the value written this time step
end

always_ff @(posedge clk) begin
  out = shared;        // Race: may see old or new shared
end`,
  nonBlocking: `always_ff @(posedge clk) begin
  shared <= req;       // Non-blocking: schedule NBA update
  temp   <= shared;    // Samples previous shared value
end

always_ff @(posedge clk) begin
  out <= shared;       // Samples previous shared value
end`,
};

const timeline: Record<Mode, Step[]> = {
  blocking: [
    {
      title: 'Block A executes (scheduler slot order dependent)',
      blockA: 'shared = req; temp = shared; // sequential blocking assignments',
      blockB: 'waiting for its turn',
      note: 'Because assignments are blocking, shared updates immediately to 1 before Block B runs.',
      values: {
        req: '1',
        shared: '1 (updated immediately)',
        temp: '1',
        out: '0',
      },
    },
    {
      title: 'Block B executes in the same delta cycle',
      blockA: 'completed earlier in the slot',
      blockB: 'out = shared; // sees whichever value is present right now',
      note: 'If Block B runs after Block A, out becomes 1; if it runs first, out stays 0. This is the race.',
      values: {
        req: '1',
        shared: '1',
        temp: '1',
        out: '0 → 1 (order dependent)',
      },
    },
    {
      title: 'Next timestep observation',
      blockA: 'shared keeps latest write',
      blockB: 'out holds last value written in previous delta',
      note: 'Waveforms may flicker because the simulator cannot guarantee evaluation order for parallel blocking assignments.',
      values: {
        req: 'next input',
        shared: '1 (from prior edge)',
        temp: '1',
        out: '0 or 1 (non-deterministic)',
      },
    },
  ],
  nonBlocking: [
    {
      title: 'Both blocks sample right-hand sides',
      blockA: 'shared <= req; temp <= shared; // schedule NBA updates',
      blockB: 'out <= shared; // also schedules NBA update',
      note: 'All RHS values are sampled before any updates occur, so each block sees the pre-clock state.',
      values: {
        req: '1',
        shared: '0 (old value)',
        temp: '0',
        out: '0',
      },
    },
    {
      title: 'Non-blocking assignment (NBA) region commits',
      blockA: 'shared updates to req (1); temp updates to previous shared (0)',
      blockB: 'out updates to previous shared (0)',
      note: 'Updates happen together—no race. shared becomes 1, out remains 0 for this edge.',
      values: {
        req: '1',
        shared: '1 (after NBA)',
        temp: '0 → 1 on next edge',
        out: '0',
      },
    },
    {
      title: 'Next clock edge behavior',
      blockA: 'shared <= req_next; temp <= shared; // now shared was 1',
      blockB: 'out <= shared; // samples consistent 1',
      note: 'Out observes a stable 1 on the next tick—deterministic ordering prevents glitches.',
      values: {
        req: 'req_next',
        shared: '1',
        temp: '1',
        out: '1',
      },
    },
  ],
};

const BlockingSimulator = () => {
  const [mode, setMode] = useState<Mode>('blocking');
  const [step, setStep] = useState(0);

  const steps = timeline[mode];
  const clampedStep = Math.min(step, steps.length - 1);
  const visibleSteps = steps.slice(0, clampedStep + 1);
  const progress = ((clampedStep + 1) / steps.length) * 100;

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode);
    setStep(0);
  };

  const handleNext = () => {
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handlePrev = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleReset = () => {
    setStep(0);
  };

  return (
    <Card className="my-8" data-testid="blocking-simulator">
      <CardHeader>
        <CardTitle>Blocking vs. Non-Blocking Timeline</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare scheduler behavior for blocking (<code>=</code>) and non-blocking (<code>{'<= '}</code>) assignments (IEEE
          1800-2023 §10.4).
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            onClick={() => handleModeChange('blocking')}
            variant={mode === 'blocking' ? 'default' : 'outline'}
          >
            Blocking mode
          </Button>
          <Button
            type="button"
            onClick={() => handleModeChange('nonBlocking')}
            variant={mode === 'nonBlocking' ? 'default' : 'outline'}
          >
            Non-blocking mode
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <pre
            data-testid="blocking-code"
            className="rounded border border-border bg-background/70 p-4 text-xs leading-relaxed shadow"
          >
            {codeSamples[mode]}
          </pre>
          <div className="space-y-3" data-testid="timeline-panel">
            <Progress value={progress} className="h-2" />
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {visibleSteps.map((item, index) => (
                  <motion.div
                    key={`${mode}-step-${index}`}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="rounded border border-primary/30 bg-primary/5 p-3 text-xs shadow-sm"
                  >
                    <p className="font-semibold">Step {index + 1}: {item.title}</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div>
                        <p className="font-semibold">Always block A</p>
                        <p>{item.blockA}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Always block B</p>
                        <p>{item.blockB}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-muted-foreground">{item.note}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" data-testid="timeline-controls">
          <Button type="button" onClick={handlePrev} variant="outline" disabled={clampedStep === 0}>
            Previous
          </Button>
          <Button type="button" onClick={handleNext} disabled={clampedStep >= steps.length - 1}>
            Next
          </Button>
          <Button type="button" onClick={handleReset} variant="ghost">
            Reset
          </Button>
          <span className="text-xs text-muted-foreground">Step {clampedStep + 1} of {steps.length}</span>
        </div>

        <div className="overflow-x-auto" data-testid="state-panel">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/70">
                <th className="py-1 pr-4 font-semibold">Signal</th>
                <th className="py-1 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(steps[clampedStep].values).map(([signal, value]) => (
                <tr key={signal} className="border-b border-border/40 last:border-0">
                  <td className="py-1 pr-4 font-mono">{signal}</td>
                  <td className="py-1 font-mono">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default BlockingSimulator;
