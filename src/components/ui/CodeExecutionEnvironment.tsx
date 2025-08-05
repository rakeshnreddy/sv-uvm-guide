"use client";

import React, { useState } from 'react';
import { Button } from './Button';
import { Play, AlertTriangle } from 'lucide-react';

interface CodeExecutionEnvironmentProps {
  code: string;
}

export const CodeExecutionEnvironment: React.FC<CodeExecutionEnvironmentProps> = ({ code }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('Sending code to server for simulation...');
    setError('');

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'An unknown error occurred during simulation.');
        setOutput(result.output || 'No output available.');
      } else {
        setOutput(result.output);
      }
    } catch (e) {
      const fetchError = e instanceof Error ? e.message : 'A network error occurred.';
      setError(`Failed to connect to the simulation service: ${fetchError}`);
      setOutput('');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="code-execution-environment my-6 p-4 border border-white/20 rounded-lg shadow-md bg-white/10 backdrop-blur-lg">
      <div className="controls mb-4">
        <Button onClick={handleRunCode} disabled={isRunning || !code}>
          <Play className="w-4 h-4 mr-2" />
          {isRunning ? 'Running...' : 'Run Simulation'}
        </Button>
      </div>
      <div className="output-section">
        <h3 className="text-lg font-semibold mb-2 text-foreground/90">Simulation Output</h3>
        {error && (
            <div className="bg-red-900/50 text-white p-3 rounded-md mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-3 text-red-400" />
                <div>
                    <h4 className="font-bold">Simulation Error</h4>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        )}
        <pre className="bg-black text-white p-4 rounded-md text-sm whitespace-pre-wrap font-mono h-64 overflow-y-auto">
          {output || 'Click "Run Simulation" to see the output.'}
        </pre>
      </div>
    </div>
  );
};

export default CodeExecutionEnvironment;
