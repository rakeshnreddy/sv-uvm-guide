"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

type ScenarioMode = 'normal' | 'race';

interface RegionStep {
  region: string;
  description: string;
  tokenPosition: number;
  highlightCode: string; // The code line to highlight
  values: Record<string, string>;
}

const REGIONS = [
  'Pre-Active',
  'Active',
  'Inactive',
  'NBA',
  'Observed',
  'Reactive',
  'Re-Inactive'
];

const SCENARIOS: Record<ScenarioMode, { title: string; code: string; timeline: RegionStep[] }> = {
  normal: {
    title: 'Normal Flip-Flop (Non-Blocking)',
    code: `always_ff @(posedge clk) begin\n  q <= d; // NBA update scheduled\nend`,
    timeline: [
      { region: 'Pre-Active', description: 'Sample inputs before clock edge.', tokenPosition: 0, highlightCode: '', values: { clk: '0', d: '1', q: '0' } },
      { region: 'Active', description: 'clk posedge detected. Evaluate RHS of q <= d (d is 1). Schedule NBA update.', tokenPosition: 1, highlightCode: 'q <= d', values: { clk: '1', d: '1', q: '0' } },
      { region: 'Inactive', description: 'Process #0 delays. (None in this example, skipping).', tokenPosition: 2, highlightCode: '', values: { clk: '1', d: '1', q: '0' } },
      { region: 'NBA', description: 'Execute scheduled non-blocking updates. q becomes 1.', tokenPosition: 3, highlightCode: 'q <= d', values: { clk: '1', d: '1', q: '1' } },
      { region: 'Observed', description: 'Evaluate concurrent assertions with stable values.', tokenPosition: 4, highlightCode: '', values: { clk: '1', d: '1', q: '1' } },
      { region: 'Reactive', description: 'Program blocks (testbench) execute using observed values.', tokenPosition: 5, highlightCode: '', values: { clk: '1', d: '1', q: '1' } },
      { region: 'Re-Inactive', description: 'Final cleanup before advancing simulation time.', tokenPosition: 6, highlightCode: '', values: { clk: '1', d: '1', q: '1' } }
    ]
  },
  race: {
    title: 'Race Condition (Blocking)',
    code: `always @(posedge clk) q1 = d;  // Process A\nalways @(posedge clk) q2 = q1; // Process B`,
    timeline: [
      { region: 'Pre-Active', description: 'Initial state before clock edge.', tokenPosition: 0, highlightCode: '', values: { clk: '0', d: '1', q1: '0', q2: '0' } },
      { region: 'Active', description: 'Process A executes: q1 = d. q1 updates immediately to 1.', tokenPosition: 1, highlightCode: 'q1 = d', values: { clk: '1', d: '1', q1: '1', q2: '0' } },
      { region: 'Active', description: 'Process B executes: q2 = q1. It sees the new q1 value (1). (If B ran first, it would see 0!)', tokenPosition: 1, highlightCode: 'q2 = q1', values: { clk: '1', d: '1', q1: '1', q2: '1' } },
      { region: 'Inactive', description: 'Skip Inactive region.', tokenPosition: 2, highlightCode: '', values: { clk: '1', d: '1', q1: '1', q2: '1' } },
      { region: 'NBA', description: 'No non-blocking assignments scheduled.', tokenPosition: 3, highlightCode: '', values: { clk: '1', d: '1', q1: '1', q2: '1' } },
      { region: 'Observed', description: 'Assertions evaluated. Race condition may cause failures depending on execution order.', tokenPosition: 4, highlightCode: '', values: { clk: '1', d: '1', q1: '1', q2: '1' } },
      { region: 'Reactive', description: 'Testbench reacts to whatever unpredictable values resulted.', tokenPosition: 5, highlightCode: '', values: { clk: '1', d: '1', q1: '1', q2: '1' } }
    ]
  }
};

export const SVSchedulerRegionVisualizer = () => {
  const [mode, setMode] = useState<ScenarioMode>('normal');
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const scenario = SCENARIOS[mode];
  const currentStepData = scenario.timeline[step];

  // Auto-play logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      if (step < scenario.timeline.length - 1) {
        timer = setTimeout(() => {
          setStep(s => s + 1);
        }, 1200);
      } else {
        setIsPlaying(false);
      }
    }
    return () => clearTimeout(timer);
  }, [isPlaying, step, scenario.timeline.length]);

  const handleNext = () => setStep(s => Math.min(s + 1, scenario.timeline.length - 1));
  const handlePrev = () => setStep(s => Math.max(s - 1, 0));
  const handleReset = () => {
    setStep(0);
    setIsPlaying(false);
  };
  const togglePlay = () => {
    if (step === scenario.timeline.length - 1) {
      setStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const setScenario = (newMode: ScenarioMode) => {
    setMode(newMode);
    handleReset();
  };

  return (
    <Card className="my-8 overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm" data-testid="scheduler-visualizer">
      <CardHeader className="bg-slate-50 dark:bg-slate-900/50 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>SystemVerilog Scheduler Timeline</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Delta cycles and execution ordering</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <Button
              variant={mode === 'normal' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setScenario('normal')}
              data-testid="mode-normal"
            >
              Normal Flip-Flop
            </Button>
            <Button
              variant={mode === 'race' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setScenario('race')}
              data-testid="mode-race"
            >
              Race Condition
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Horizontal Swimlanes */}
        <div className="relative mb-12 mt-4 hidden md:block">
          {/* Connector Line */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800 -translate-y-1/2" />
          
          <div className="flex justify-between relative z-10">
            {REGIONS.map((r, i) => {
              const isActive = currentStepData.tokenPosition === i;
              const isPast = currentStepData.tokenPosition > i;
              return (
                <div key={r} className="flex flex-col items-center">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-300
                    ${isActive ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg scale-110' : 
                      isPast ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300' : 
                      'bg-white border-slate-300 text-slate-400 dark:bg-slate-950 dark:border-slate-700'}
                  `}
                  >
                    {i + 1}
                  </div>
                  <span className={`mt-2 text-xs font-medium ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                    {r}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Animated Token/Arrow */}
          <motion.div
            className="absolute top-1/2 w-4 h-4 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)] -mt-2 -ml-2"
            animate={{
              left: `${(currentStepData.tokenPosition / (REGIONS.length - 1)) * 100}%`
            }}
            transition={{ type: "spring", stiffness: 120, damping: 15 }}
          />
        </div>

        {/* Mobile View Active Region */}
        <div className="md:hidden text-center mb-6 py-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Active Region</span>
          <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300 mt-1">
            {REGIONS[currentStepData.tokenPosition]}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Signal Values Panel */}
          <div className="col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold">
              Signal State
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(currentStepData.values).map(([sig, val]) => (
                    <tr key={sig} className="border-b last:border-0 border-slate-100 dark:border-slate-800/50">
                      <td className="py-2 font-mono font-medium text-slate-500">{sig}</td>
                      <td className="py-2 text-right">
                        <AnimatePresence mode="popLayout">
                          <motion.span
                            key={val}
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="font-mono inline-block px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 font-bold"
                          >
                            {val}
                          </motion.span>
                        </AnimatePresence>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-2 flex flex-col gap-4">
            {/* Code Block Context */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden relative font-mono text-sm shadow-sm h-full max-h-[160px] flex">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-20" />
              <pre className="p-4 text-slate-300 overflow-x-auto w-full flex-grow flex items-center flex-wrap whitespace-pre-wrap">
                {scenario.code.split('\n').map((line, i) => {
                  const isHighlighted = currentStepData.highlightCode && line.includes(currentStepData.highlightCode);
                  return (
                    <div 
                      key={i} 
                      className={`${isHighlighted ? 'bg-indigo-500/20 text-white w-full border-l-2 border-indigo-400 -ml-4 pl-3 py-0.5' : 'text-slate-400 w-full'}`}
                    >
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>

            {/* Step Description */}
            <motion.div 
              key={step + mode}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold">
                  {step}
                </span>
                <span className="font-semibold text-blue-900 dark:text-blue-100">{currentStepData.region} Phase</span>
              </div>
              <p className="text-blue-800 dark:text-blue-200 text-sm mt-2 leading-relaxed">
                {currentStepData.description}
              </p>
            </motion.div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-8 md:mt-10 pt-6 border-t border-slate-100 dark:border-slate-800/50">
          <Button variant="outline" size="sm" onClick={handleReset} data-testid="btn-reset">
            <RotateCcw className="w-4 h-4 mr-2 text-slate-500" />
            Reset
          </Button>
          <div className="flex ml-2 mr-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <Button variant="ghost" size="sm" onClick={handlePrev} disabled={step === 0 || isPlaying} data-testid="btn-prev">
              <SkipBack className="w-4 h-4 text-slate-600" />
            </Button>
            <Button variant="default" size="sm" onClick={togglePlay} className="px-6" data-testid="btn-play">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
               <span className="hidden sm:inline-block ml-2">{isPlaying ? 'Pause' : step >= scenario.timeline.length - 1 ? 'Replay' : 'Play'}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleNext} disabled={step >= scenario.timeline.length - 1 || isPlaying} data-testid="btn-next">
              <SkipForward className="w-4 h-4 text-slate-600" />
            </Button>
          </div>
          <div className="text-xs text-slate-400 font-mono text-center w-full mt-4 sm:w-auto sm:mt-0 sm:ml-auto">
            Cycle Step: {step}/{scenario.timeline.length - 1}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
