"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Progress } from '@/components/ui/Progress';

interface EvaluationResult {
  quality: { score: number; feedback: string };
  performance: { score: number; feedback: string };
  testCoverage: { score: number; feedback: string };
  architecture: { score: number; feedback: string };
  overall: { score: number; feedback: string };
}

const MOCK_PROJECT = `
module top;
  // This is a mock project file.
  // In a real scenario, a user would submit a more complex design.
  initial begin
    $display("Hello, World!");
  end
endmodule
`.trim();

export const ProjectBasedEvaluator = () => {
  const [code, setCode] = useState(MOCK_PROJECT);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const handleEvaluate = () => {
    setIsEvaluating(true);
    setResult(null);

    // Simulate a backend evaluation process
    setTimeout(() => {
      const qualityScore = 70 + Math.floor(Math.random() * 25); // 70-95
      const performanceScore = 60 + Math.floor(Math.random() * 35); // 60-95
      const testCoverageScore = 50 + Math.floor(Math.random() * 45); // 50-95
      const architectureScore = 75 + Math.floor(Math.random() * 20); // 75-95
      const overallScore = Math.round((qualityScore + performanceScore + testCoverageScore + architectureScore) / 4);

      setResult({
        quality: { score: qualityScore, feedback: `Code maintainability is ${qualityScore > 85 ? 'excellent' : 'good'}. Consider refactoring complex modules.` },
        performance: { score: performanceScore, feedback: `Simulation speed is ${performanceScore > 85 ? 'fast' : 'acceptable'}. Some bottlenecks detected.` },
        testCoverage: { score: testCoverageScore, feedback: `Functional coverage at ${testCoverageScore}%. Missing some corner cases.` },
        architecture: { score: architectureScore, feedback: `Design adheres to ${architectureScore > 85 ? 'all' : 'most'} architectural patterns.` },
        overall: { score: overallScore, feedback: overallScore > 80 ? 'Great work! This project meets most of the requirements.' : 'Good start, but there are areas for improvement.' },
      });
      setIsEvaluating(false);
    }, 2000);
  };

  const ResultBar = ({ label, score, feedback }: { label: string; score: number; feedback: string }) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="font-semibold">{label}</span>
        <span className="text-sm font-bold">{score}/100</span>
      </div>
      <Progress value={score} className="h-2" />
      <p className="text-xs text-muted-foreground mt-1">{feedback}</p>
    </div>
  );

  return (
    <div className="p-4 border border-dashed border-white/30 rounded-lg my-6 bg-white/5">
      <h2 className="text-2xl font-bold text-primary mb-4">Project-Based Evaluator</h2>
      <p className="text-foreground/80 mb-4">
        Submit your SystemVerilog/UVM project code below for an automated evaluation.
      </p>

      <Textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full h-64 text-sm font-mono p-2 rounded bg-background border"
        placeholder="Paste your project code here..."
      />

      <Button onClick={handleEvaluate} disabled={isEvaluating} className="mt-4">
        {isEvaluating ? 'Evaluating...' : 'Submit for Evaluation'}
      </Button>

      {isEvaluating && (
        <div className="mt-4 text-center">
          <p>Analyzing your project... This may take a moment.</p>
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-primary mb-4">Evaluation Results</h3>
          <ResultBar label="Overall Score" score={result.overall.score} feedback={result.overall.feedback} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <ResultBar label="Code Quality" score={result.quality.score} feedback={result.quality.feedback} />
            <ResultBar label="Performance" score={result.performance.score} feedback={result.performance.feedback} />
            <ResultBar label="Test Coverage" score={result.testCoverage.score} feedback={result.testCoverage.feedback} />
            <ResultBar label="Architecture" score={result.architecture.score} feedback={result.architecture.feedback} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectBasedEvaluator;
