"use client";

import React from 'react';

interface DebugScenario {
  id: string;
  title: string;
  description: string;
  bugPattern: string;
  logs: string[];
  waveform: string;
  strategy: string;
  automationSteps: string[];
}

const scenarios: DebugScenario[] = [
  {
    id: "null-pointer",
    title: "Null Pointer Dereference",
    description: "Simulation stops when a null pointer is accessed.",
    bugPattern: "Attempted to read from an uninitialized handle.",
    logs: [
      "[ERROR] Attempted read of null pointer at address 0x00",
      "[WARN] Slow response: latency=200ns",
      "[INFO] Stack trace: main -> init -> configure",
    ],
    waveform: "clk: 0 1 0 1 0\nptr: x x 0 1 x",
    strategy: "Ensure all pointers are initialized before use.",
    automationSteps: ["Run initialization checks", "Enable null pointer warnings"],
  },
  {
    id: "race-condition",
    title: "Race Condition",
    description: "Concurrent writes cause timing issues on a shared register.",
    bugPattern: "Concurrent writes lead to unpredictable state.",
    logs: [
      "[WARN] Timing violation detected at t=100ns",
      "[INFO] Process A wrote value 1 at t=95ns",
      "[INFO] Process B wrote value 0 at t=100ns",
      "[WARN] High latency observed",
    ],
    waveform: "clk: 0 1 0 1 0\nreg: 0 1 0 1 0",
    strategy: "Use proper synchronization mechanisms.",
    automationSteps: ["Check mutual exclusion", "Insert arbitration logic"],
  },
  {
    id: "memory-leak",
    title: "Memory Leak",
    description: "Memory usage increases over time during simulation.",
    bugPattern: "Allocated objects are not freed.",
    logs: [
      "[INFO] Heap usage at start: 10MB",
      "[INFO] Heap usage after run: 120MB",
      "[ERROR] Potential memory leak detected",
      "[WARN] Operation timeout at 500ms",
    ],
    waveform: "clk: 0 1 0 1 0\nmem: 10 20 40 80 160",
    strategy: "Track allocations and ensure proper deallocation.",
    automationSteps: ["Run memory profiler", "Verify allocation paths"],
  },
];

const detectPerformanceIssues = (logs: string[]) =>
  logs.filter((log) => /latency|slow|timeout|performance/i.test(log));

const detectMemoryLeaks = (logs: string[]) =>
  logs.filter((log) => /memory leak|out of memory|heap/i.test(log));

const detectTimingViolations = (logs: string[]) =>
  logs.filter((log) => /timing violation|setup|hold/i.test(log));

// Determine how each log line should be highlighted
const classifyLog = (log: string) => {
  if (/memory leak|out of memory|heap/i.test(log)) return 'memory';
  if (/timing violation|setup|hold/i.test(log)) return 'timing';
  if (/latency|slow|timeout|performance/i.test(log)) return 'performance';
  return null;
};

interface WaveformLine {
  signal: string;
  values: string[];
}

// Simple parser to convert waveform strings into signal/value arrays
const parseWaveform = (waveform: string): WaveformLine[] =>
  waveform.split('\n').map((line) => {
    const [name, rest] = line.split(':');
    return {
      signal: name.trim(),
      values: rest.trim().split(/\s+/),
    };
  });

const Section = ({ title, items }: { title: string; items: string[] }) =>
  items.length ? (
    <div className="mb-2">
      <h4 className="text-foreground/80">{title}</h4>
      <ul className="list-disc list-inside text-foreground/70">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  ) : (
    <p className="text-foreground/60 mb-2">{title}: None detected</p>
  );

export const DebuggingSimulator = () => {
  const [scenarioId, setScenarioId] = React.useState<string>(scenarios[0]?.id);
  const selectedScenario = React.useMemo(
    () => scenarios.find((s) => s.id === scenarioId),
    [scenarioId]
  );

  const [analysis, setAnalysis] = React.useState<{
    performance: string[];
    memoryLeaks: string[];
    timing: string[];
  } | null>(null);

  // waveform/log step tracking
  const [step, setStep] = React.useState(0);

  // workflow automation progress
  const [workflowIndex, setWorkflowIndex] = React.useState(0);
  const [completed, setCompleted] = React.useState<string[]>([]);

  // Reset state when scenario changes
  React.useEffect(() => {
    setAnalysis(null);
    setStep(0);
    setWorkflowIndex(0);
    setCompleted([]);
  }, [scenarioId]);

  const analyzeScenario = () => {
    if (!selectedScenario) return;
    const performance = detectPerformanceIssues(selectedScenario.logs);
    const memoryLeaks = detectMemoryLeaks(selectedScenario.logs);
    const timing = detectTimingViolations(selectedScenario.logs);
    setAnalysis({ performance, memoryLeaks, timing });
  };

  const waveformData = React.useMemo(
    () => (selectedScenario ? parseWaveform(selectedScenario.waveform) : []),
    [selectedScenario]
  );
  const maxSteps = React.useMemo(() => {
    const wfSteps = waveformData[0]?.values.length || 0;
    const logSteps = selectedScenario?.logs.length || 0;
    return Math.max(wfSteps, logSteps);
  }, [waveformData, selectedScenario]);

  const nextStep = () => setStep((s) => Math.min(s + 1, maxSteps - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const completeCurrentStep = () => {
    if (!selectedScenario) return;
    const stepDesc = selectedScenario.automationSteps[workflowIndex];
    if (stepDesc) {
      setCompleted([...completed, stepDesc]);
      setWorkflowIndex((i) => i + 1);
    }
  };

  return (
    <div className="p-4 border border-dashed border-white/30 rounded-lg my-6 bg-white/5">
      <h2 className="text-2xl font-bold text-primary mb-2">Debugging Simulator</h2>
      <div className="mb-4">
        <label htmlFor="scenario" className="text-foreground/80 mr-2">
          Scenario:
        </label>
        <select
          id="scenario"
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          className="bg-background border border-foreground/20 rounded px-2 py-1"
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      {selectedScenario ? (
        <div>
          <p className="text-foreground/80 mb-2">{selectedScenario.description}</p>
          <h3 className="font-semibold text-primary">Bug Pattern</h3>
          <p className="text-foreground/70 mb-2">{selectedScenario.bugPattern}</p>

          {/* Log Viewer */}
          <h3 className="font-semibold text-primary">Logs</h3>
          <pre className="bg-black/20 p-2 rounded mb-2 overflow-x-auto text-xs">
            {selectedScenario.logs.map((log, idx) => {
              const type = classifyLog(log);
              let cls = '';
              if (type === 'memory') cls = 'text-purple-400';
              else if (type === 'timing') cls = 'text-red-400';
              else if (type === 'performance') cls = 'text-yellow-400';
              if (idx === step) cls += ' font-bold';
              if (idx > step) cls += ' opacity-50';
              return (
                <span key={idx} className={cls}>
                  {log}
                  {'\n'}
                </span>
              );
            })}
          </pre>

          {/* Waveform Viewer */}
          <h3 className="font-semibold text-primary">Waveform</h3>
          <div className="bg-black/20 p-2 rounded mb-2 overflow-x-auto text-xs">
            <table>
              <tbody>
                {waveformData.map((line) => (
                  <tr key={line.signal}>
                    <td className="pr-2 text-primary">{line.signal}</td>
                    {line.values.map((v, i) => {
                      let cellCls = 'px-1';
                      if (i === step) cellCls += ' bg-primary/50';
                      if (/x/i.test(v)) cellCls += ' text-red-400';
                      return (
                        <td key={i} className={cellCls}>
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Step controls */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={prevStep}
              disabled={step === 0}
              className="px-2 py-1 bg-primary text-primary-foreground rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-foreground/70">
              Step {Math.min(step + 1, maxSteps)}/{maxSteps}
            </span>
            <button
              onClick={nextStep}
              disabled={step >= maxSteps - 1}
              className="px-2 py-1 bg-primary text-primary-foreground rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>

          <button
            onClick={analyzeScenario}
            className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded"
          >
            Analyze
          </button>
          {analysis && (
            <div className="mt-4">
              <h3 className="font-semibold text-primary">Analysis</h3>
              <Section title="Performance Issues" items={analysis.performance} />
              <Section title="Memory Leaks" items={analysis.memoryLeaks} />
              <Section title="Timing Violations" items={analysis.timing} />
              <h3 className="font-semibold text-primary mt-4">Recommended Strategy</h3>
              <p className="text-foreground/70">{selectedScenario.strategy}</p>
              <h3 className="font-semibold text-primary mt-4">Automated Workflow</h3>
              {workflowIndex < selectedScenario.automationSteps.length ? (
                <div className="mb-2">
                  <p className="text-foreground/70">
                    Current Step: {selectedScenario.automationSteps[workflowIndex]}
                  </p>
                  <button
                    onClick={completeCurrentStep}
                    className="mt-1 px-2 py-1 bg-primary text-primary-foreground rounded"
                  >
                    Mark Step Complete
                  </button>
                </div>
              ) : (
                <p className="text-foreground/70 mb-2">All steps completed.</p>
              )}
              {completed.length > 0 && (
                <div>
                  <h4 className="text-foreground/80">Progress Log</h4>
                  <ul className="list-disc list-inside text-foreground/70">
                    {completed.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-foreground/80">No scenario selected.</p>
      )}
    </div>
  );
};

export default DebuggingSimulator;

