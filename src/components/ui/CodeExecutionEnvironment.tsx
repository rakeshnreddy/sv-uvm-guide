"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Play, Pause, RotateCcw, StepForward } from 'lucide-react';
import * as WaveDrom from 'wavedrom';
import type {
  SimulationStats,
  SimulatorBackend,
} from '@/server/simulation/types';

interface CodeExecutionEnvironmentProps {
  // In the future, this might take the code as a prop, e.g.
  // code: string;
}

export const CodeExecutionEnvironment: React.FC<CodeExecutionEnvironmentProps> = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [backend, setBackend] = useState<SimulatorBackend>('wasm');
  const [output, setOutput] = useState<string>('');
  const [coverage, setCoverage] = useState<number | null>(null);
  const [regressions, setRegressions] = useState<string[]>([]);
  const [waveform, setWaveform] = useState<any>(null);
  const [stats, setStats] = useState<SimulationStats | null>(null);
  const waveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (waveform && waveRef.current) {
      WaveDrom.renderWaveElement(waveRef.current, waveform);
    }
  }, [waveform]);

  const handleRunCode = async () => {
    setIsRunning(true);
    setIsPaused(false);
    setOutput('Compiling and running simulation...');

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '', backend }),
      });
      const data = await res.json();
      setOutput(data.output);
      setWaveform(data.waveform);
      setStats(data.stats);
      setCoverage(data.coverage);
      setRegressions(data.regressions || []);
    } catch (err) {
      setOutput(String(err));
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
          <option value="wasm">WebAssembly</option>
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
        <pre className="bg-black text-white p-4 rounded-md text-sm whitespace-pre-wrap font-mono h-64 overflow-y-auto">
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
