"use client";

import React, { useState } from 'react';
import { Button } from './Button';
import { Play } from 'lucide-react';

interface CodeExecutionEnvironmentProps {
  // In the future, this might take the code as a prop, e.g.
  // code: string;
}

export const CodeExecutionEnvironment: React.FC<CodeExecutionEnvironmentProps> = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');

  const handleRunCode = () => {
    setIsRunning(true);
    setOutput('Compiling and running simulation...');

    // Simulate a network request or a long-running process like a simulation
    setTimeout(() => {
      const mockOutput = [
        'VCS-MX/MXI-2023.03-SP2-1  linux-64  Jul 26 15:00 2023',
        'Copyright (c) 1991-2023.  ALL RIGHTS RESERVED.',
        'info: Running test: base_test',
        '-----------------------------------',
        'UVM_INFO @ 0: uvm_test_top [RNTST] Starting test base_test',
        'UVM_INFO @ 10: uvm_test_top.env.agent [AGENT] Got item: 5',
        'UVM_INFO @ 20: uvm_test_top.env.agent [AGENT] Got item: 12',
        'UVM_INFO @ 30: uvm_test_top.env.agent [AGENT] Got item: 8',
        '--- UVM Report Summary ---',
        '** Report counts by severity',
        'UVM_INFO : 4',
        'UVM_WARNING : 0',
        'UVM_ERROR : 0',
        'UVM_FATAL : 0',
        '** Report counts by id',
        '[AGENT] 3',
        '[RNTST] 1',
        '',
        'Simulation PASSED',
      ].join('\n');

      setOutput(mockOutput);
      setIsRunning(false);
    }, 2000);
  };

  return (
    <div className="code-execution-environment my-6 p-4 border border-white/20 rounded-lg shadow-md bg-white/10 backdrop-blur-lg">
      <div className="controls mb-4">
        <Button onClick={handleRunCode} disabled={isRunning}>
          <Play className="w-4 h-4 mr-2" />
          {isRunning ? 'Running...' : 'Run Simulation'}
        </Button>
      </div>
      <div className="output-section">
        <h3 className="text-lg font-semibold mb-2 text-foreground/90">Simulation Output</h3>
        <pre className="bg-black text-white p-4 rounded-md text-sm whitespace-pre-wrap font-mono h-64 overflow-y-auto">
          {output || 'Click "Run Simulation" to see the output.'}
        </pre>
      </div>
    </div>
  );
};

export default CodeExecutionEnvironment;
