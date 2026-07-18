"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Play, Pause, RotateCcw, StepForward } from 'lucide-react';
import * as WaveDrom from 'wavedrom';
import type {
  SimulationStats,
  SimulatorBackend,
  SimulationWaveform,
} from '@/server/simulation/types';

interface CodeExecutionEnvironmentProps {
  // In the future, this might take the code as a prop, e.g.
  // code: string;
}

export const CodeExecutionEnvironment: React.FC<CodeExecutionEnvironmentProps> = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [backend, setBackend] = useState<SimulatorBackend>('icarus');
  const [output, setOutput] = useState<string>('');
  const [coverage, setCoverage] = useState<number | null>(null);
  const [regressions, setRegressions] = useState<string[]>([]);
  const [waveform, setWaveform] = useState<SimulationWaveform | null>(null);
  const [stats, setStats] = useState<SimulationStats | null>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  useEffect(() => {
    if (waveform && waveRef.current && typeof WaveDrom?.renderWaveElement === 'function') {
      WaveDrom.renderWaveElement(waveRef.current, waveform);
    }
  }, [waveform]);

  const handleRunCode = async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsRunning(true);
    setIsPaused(false);
    setOutput('Compiling and running simulation...');

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          backend,
          files: [{ path: 'submission.sv', content: 'module submission; endmodule\n' }],
        }),
      });
      const queued = await res.json();
      if (!res.ok || typeof queued.jobId !== 'string') {
        throw new Error(queued.error ?? 'Unable to enqueue simulation');
      }

      setOutput(`Simulation queued (${queued.jobId}).`);
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 1_000);
          controller.signal.addEventListener(
            'abort',
            () => {
              window.clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        });

        const statusResponse = await fetch(`/api/simulate/${encodeURIComponent(queued.jobId)}`, {
          signal: controller.signal,
        });
        const job = await statusResponse.json();
        if (!statusResponse.ok) {
          throw new Error(job.error ?? 'Unable to load simulation status');
        }
        if (job.status === 'queued' || job.status === 'running') {
          setOutput(`Simulation ${job.status}…`);
          continue;
        }

        const result = job.result && typeof job.result === 'object' ? job.result : {};
        const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
        setOutput(
          diagnostics.length > 0
            ? diagnostics.map((item: { message?: string }) => item.message ?? 'Simulation diagnostic').join('\n')
            : job.status === 'succeeded'
              ? 'Simulation completed successfully.'
              : `Simulation ended with status: ${job.status}`,
        );
        setCoverage(typeof result.coverage === 'number' ? result.coverage : null);
        setWaveform(null);
        setStats(null);
        setRegressions([]);
        return;
      }

      throw new Error('Simulation status timed out');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setOutput(err instanceof Error ? err.message : 'Simulation request failed');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handlePause = () => {
    setIsPaused((p) => !p);
    // In a real implementation, this would signal the simulator
    // to pause or resume execution.
  };

  const handleStep = () => {
    // Placeholder for stepping through simulation cycles.
  };

  const handleReset = () => {
    requestControllerRef.current?.abort();
    setOutput('');
    setWaveform(null);
    setStats(null);
    setCoverage(null);
    setRegressions([]);
  };

  return (
    <div className="code-execution-environment my-6 p-4 border border-white/20 rounded-lg shadow-md bg-white/10 backdrop-blur-lg">
      <div className="controls mb-4 flex gap-2 items-center">
        <select
          className="border rounded-md p-1 bg-background text-foreground"
          value={backend}
          onChange={(e) => setBackend(e.target.value as SimulatorBackend)}
          disabled={isRunning}
        >
          <option value="icarus">Icarus</option>
          <option value="verilator">Verilator</option>
        </select>
        <Button onClick={handleRunCode} disabled={isRunning}>
          <Play className="w-4 h-4 mr-2" />
          {isRunning ? 'Running...' : 'Run Simulation'}
        </Button>
        <Button onClick={handlePause} disabled={!isRunning} variant="secondary">
          <Pause className="w-4 h-4 mr-2" />
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
        <Button onClick={handleStep} disabled={!isRunning} variant="secondary">
          <StepForward className="w-4 h-4 mr-2" />Step
        </Button>
        <Button onClick={handleReset} variant="secondary">
          <RotateCcw className="w-4 h-4 mr-2" />Reset
        </Button>
      </div>
      <div className="output-section mb-4">
        <h3 className="text-lg font-semibold mb-2 text-foreground/90">Simulation Output</h3>
        <pre
          className="bg-black text-white p-4 rounded-md text-sm whitespace-pre-wrap font-mono h-64 overflow-y-auto"
          data-testid="simulation-output"
        >
          {output || 'Click "Run Simulation" to see the output.'}
        </pre>
      </div>
      {waveform && (
        <div className="waveform-section mb-4">
          <h3 className="text-lg font-semibold mb-2 text-foreground/90">Waveform</h3>
          <div ref={waveRef} />
        </div>
      )}
      {stats && (
        <div className="profiling-section mb-4 text-sm">
          <h3 className="text-lg font-semibold mb-2 text-foreground/90">Performance</h3>
          <p>Runtime: {stats.runtimeMs.toFixed(2)} ms</p>
          <p>Memory: {Math.round(stats.memoryBytes / 1024)} kB</p>
          <p>
            CPU: user {stats.cpuUserMs.toFixed(2)} ms / system{' '}
            {stats.cpuSystemMs.toFixed(2)} ms
          </p>
        </div>
      )}
      {coverage !== null && (
        <div className="coverage-section mb-4 text-sm">
          <h3 className="text-lg font-semibold mb-2 text-foreground/90">Coverage</h3>
          <p>{coverage}%</p>
        </div>
      )}
      {regressions.length > 0 && (
        <div className="regression-section text-sm">
          <h3 className="text-lg font-semibold mb-2 text-foreground/90">Regression Results</h3>
          <ul className="list-disc pl-5">
            {regressions.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CodeExecutionEnvironment;
