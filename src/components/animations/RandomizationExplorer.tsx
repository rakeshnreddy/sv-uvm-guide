"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { randomizationData } from './randomization-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { scaleBand, scaleLinear } from 'd3-scale';
import { line as d3Line, curveMonotoneX } from 'd3-shape';
import { extent, max } from 'd3-array';

type SolveResult = {
  values: Record<string, number>;
  iterations: string[];
  callbacks: string[];
  conflictName: string | null;
  duration: number;
  success: boolean;
};

const MAX_ATTEMPTS = 20;
const MAX_HISTORY = 200;

type DistributionDatum = { range: string; count: number };
type SolveTimeDatum = { run: number; time: number };

const distributionChartDimensions = {
  width: 520,
  height: 220,
  margin: { top: 16, right: 16, bottom: 52, left: 52 },
};

const solveTimeChartDimensions = {
  width: 520,
  height: 220,
  margin: { top: 16, right: 24, bottom: 48, left: 60 },
};

const DistributionBarChart = ({ data }: { data: DistributionDatum[] }) => {
  const { width, height, margin } = distributionChartDimensions;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = scaleBand<string>()
    .domain(data.map((d) => d.range))
    .range([0, innerWidth])
    .padding(0.2);

  const maxValue = max(data, (d) => d.count) ?? 0;
  const yScale = scaleLinear()
    .domain([0, maxValue === 0 ? 1 : maxValue])
    .range([innerHeight, 0])
    .nice();

  const yTicks = yScale.ticks(4);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="application"
      aria-label="Random value distribution"
    >
      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <g key={tick} transform={`translate(0, ${y})`}>
              <line x1={0} x2={innerWidth} stroke="currentColor" strokeOpacity={0.06} />
              <text
                x={-10}
                dy="0.32em"
                textAnchor="end"
                fontSize={11}
                fill="currentColor"
                fillOpacity={0.6}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {data.map((d) => {
          const x = xScale(d.range);
          if (x == null) return null;
          const barHeight = innerHeight - yScale(d.count);
          return (
            <g key={d.range} transform={`translate(${x}, ${yScale(d.count)})`}>
              <rect width={xScale.bandwidth()} height={Math.max(0, barHeight)} fill="hsl(var(--primary))" rx={4} fillOpacity={0.85} />
              <title>{`${d.range}: ${d.count}`}</title>
            </g>
          );
        })}

        {data.map((d) => {
          const x = xScale(d.range);
          if (x == null) return null;
          return (
            <text
              key={`label-${d.range}`}
              x={x + xScale.bandwidth() / 2}
              y={innerHeight + 18}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              fillOpacity={0.7}
            >
              {d.range}
            </text>
          );
        })}
      </g>
    </svg>
  );
};

const SolveTimeLineChart = ({ data }: { data: SolveTimeDatum[] }) => {
  const { width, height, margin } = solveTimeChartDimensions;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  if (data.length === 0) {
    return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="application" aria-label="Solve time trend">
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="currentColor" fillOpacity={0.6}>
          No runs yet
        </text>
      </svg>
    );
  }

  const [minRun, maxRun] = extent(data, (d) => d.run) as [number, number];
  const maxTime = max(data, (d) => d.time) ?? 0;

  const xScale = scaleLinear()
    .domain([minRun, maxRun])
    .nice()
    .range([0, innerWidth]);

  const yScale = scaleLinear()
    .domain([0, maxTime === 0 ? 1 : maxTime])
    .range([innerHeight, 0])
    .nice();

  const lineGenerator = d3Line<SolveTimeDatum>()
    .x((d) => xScale(d.run))
    .y((d) => yScale(d.time))
    .curve(curveMonotoneX);

  const path = lineGenerator(data) ?? undefined;
  const yTicks = yScale.ticks(4);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="application" aria-label="Solve time trend">
      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <g key={tick} transform={`translate(0, ${y})`}>
              <line x1={0} x2={innerWidth} stroke="currentColor" strokeOpacity={0.06} />
              <text
                x={-10}
                dy="0.32em"
                textAnchor="end"
                fontSize={11}
                fill="currentColor"
                fillOpacity={0.6}
              >
                {tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {path ? <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeOpacity={0.85} /> : null}

        {data.map((d) => (
          <circle
            key={d.run}
            cx={xScale(d.run)}
            cy={yScale(d.time)}
            r={4}
            fill="hsl(var(--primary))"
            fillOpacity={0.9}
          >
            <title>{`Run ${d.run}: ${d.time.toFixed(2)} ms`}</title>
          </circle>
        ))}

        <g transform={`translate(0, ${innerHeight})`}>
          <line x1={0} x2={innerWidth} stroke="currentColor" strokeOpacity={0.2} />
          {data.map((d) => (
            <text
              key={`run-${d.run}`}
              x={xScale(d.run)}
              y={32}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              fillOpacity={0.7}
            >
              {d.run}
            </text>
          ))}
        </g>
      </g>
    </svg>
  );
};

const RandomizationExplorer = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [randomValues, setRandomValues] = useState<Record<string, number>>({});
  const [iterationLog, setIterationLog] = useState<string[]>([]);
  const [distribution, setDistribution] = useState<number[]>(() => Array(16).fill(0));
  const [weight, setWeight] = useState(50);
  const [activeConstraints, setActiveConstraints] = useState<Record<string, boolean>>({});
  const [conflictingConstraint, setConflictingConstraint] = useState<string | null>(null);
  const [callbackLog, setCallbackLog] = useState<string[]>([]);
  const [solveTimes, setSolveTimes] = useState<number[]>([]);
  const [stats, setStats] = useState({ success: 0, failure: 0 });
  const [sampleCount, setSampleCount] = useState(25);

  const currentExample = randomizationData[exampleIndex];
  const distributionKey = currentExample.distributionKey ?? currentExample.variables[0];

  const solveOnce = useCallback(
    (w: number, constraintSnapshot: Record<string, boolean> = activeConstraints): SolveResult => {
      const iterations: string[] = [];
      const callbacks: string[] = [];

      if (currentExample.preRandomize) {
        callbacks.push(currentExample.preRandomize());
      }

      let newValues: Record<string, number> = {};
      let conflictName: string | null = null;
      let conflictReason = '';

      const start = performance.now();

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const attemptValues: Record<string, number> = {};
        currentExample.variables.forEach(variable => {
          attemptValues[variable] = Math.floor(Math.random() * 256);
        });

        conflictName = null;
        conflictReason = '';

        for (const constraint of currentExample.constraints) {
          if (!constraintSnapshot[constraint.name]) continue;
          const result = constraint.check(attemptValues, w);
          if (!result.ok) {
            conflictName = constraint.name;
            conflictReason = result.reason || 'failed';
            break;
          }
        }

        if (!conflictName) {
          newValues = attemptValues;
          iterations.push(`Iteration ${attempt}: success`);
          break;
        } else {
          iterations.push(`Iteration ${attempt}: ${conflictName} - ${conflictReason}`);
        }
      }

      const duration = performance.now() - start;
      const success = !conflictName;

      if (success) {
        if (currentExample.postRandomize) {
          callbacks.push(currentExample.postRandomize(newValues));
        }
      } else {
        const exhaustedMessage = conflictName
          ? `Solver exhausted ${MAX_ATTEMPTS} attempts (stalled at ${conflictName})`
          : `Solver exhausted ${MAX_ATTEMPTS} attempts`;
        iterations.push(exhaustedMessage);
        callbacks.push('post_randomize skipped: solver failed to find a solution');
      }

      return {
        values: newValues,
        iterations,
        callbacks,
        conflictName,
        duration,
        success,
      };
    },
    [activeConstraints, currentExample]
  );

  const applyResults = useCallback(
    (results: SolveResult[], options?: { reset?: boolean }) => {
      if (results.length === 0) return;

      const lastResult = results[results.length - 1];
      setRandomValues(lastResult.values);
      setIterationLog(lastResult.iterations);
      setConflictingConstraint(lastResult.conflictName);
      setCallbackLog(lastResult.callbacks);

      const successes = results.filter(result => result.success).length;
      const failures = results.length - successes;
      const durations = results.map(result => result.duration);

      if (options?.reset) {
        setStats({ success: successes, failure: failures });
        setSolveTimes(durations.slice(-MAX_HISTORY));
      } else {
        setStats(prev => ({
          success: prev.success + successes,
          failure: prev.failure + failures,
        }));
        setSolveTimes(prev => [...prev, ...durations].slice(-MAX_HISTORY));
      }

      if (distributionKey) {
        const increments = Array(16).fill(0);
        results.forEach(result => {
          if (!result.success) return;
          const value = result.values[distributionKey];
          if (typeof value !== 'number' || Number.isNaN(value)) return;
          const bin = Math.min(15, Math.max(0, Math.floor(value / 16)));
          increments[bin] += 1;
        });

        if (options?.reset) {
          setDistribution(increments);
        } else if (increments.some(count => count > 0)) {
          setDistribution(prev => prev.map((count, idx) => count + increments[idx]));
        }
      } else if (options?.reset) {
        setDistribution(Array(16).fill(0));
      }
    },
    [distributionKey]
  );

  useEffect(() => {
    const initialActive = currentExample.constraints.reduce<Record<string, boolean>>(
      (acc, constraint) => ({ ...acc, [constraint.name]: true }),
      {}
    );
    setActiveConstraints(initialActive);
    setWeight(currentExample.defaultWeight ?? 50);
    setStats({ success: 0, failure: 0 });
    setSampleCount(currentExample.defaultSampleCount ?? 25);
    setCurrentStepIndex(0);

    const initialResult = solveOnce(currentExample.defaultWeight ?? 50, initialActive);
    applyResults([initialResult], { reset: true });
  }, [currentExample, solveOnce, applyResults]);

  const runRandomize = useCallback(
    (overrideWeight?: number) => {
      const result = solveOnce(overrideWeight ?? weight);
      applyResults([result]);
    },
    [solveOnce, applyResults, weight]
  );

  const runBatch = useCallback(() => {
    const clamped = Math.max(1, Math.min(500, sampleCount));
    const results = Array.from({ length: clamped }, () => solveOnce(weight));
    applyResults(results);
  }, [applyResults, sampleCount, solveOnce, weight]);

  const resetMetrics = useCallback(() => {
    setDistribution(Array(16).fill(0));
    setSolveTimes([]);
    setStats({ success: 0, failure: 0 });
    setIterationLog([]);
    setCallbackLog([]);
    setConflictingConstraint(null);
    setRandomValues({});
  }, []);

  const currentStep = currentExample.steps[currentStepIndex];
  const distributionChartData = useMemo<DistributionDatum[]>(
    () =>
      distribution.map((count, index) => ({
        range: `${index * 16}-${index * 16 + 15}`,
        count,
      })),
    [distribution]
  );

  const solveTimeChartData = useMemo<SolveTimeDatum[]>(
    () => solveTimes.map((time, index) => ({ run: index + 1, time })),
    [solveTimes]
  );

  const graph = useMemo(() => {
    const width = 400;
    const varSpacing = width / (currentExample.variables.length + 1);
    const conSpacing = width / (currentExample.constraints.length + 1);

    const varNodes = currentExample.variables.map((variable, idx) => ({
      id: variable,
      x: (idx + 1) * varSpacing,
      y: 20,
    }));

    const conNodes = currentExample.constraints.map((constraint, idx) => ({
      id: constraint.name,
      x: (idx + 1) * conSpacing,
      y: 120,
      dependsOn: constraint.dependsOn,
      enabled: activeConstraints[constraint.name],
      conflict: conflictingConstraint === constraint.name,
    }));

    const edges = conNodes.flatMap(node =>
      node.dependsOn.map(variable => ({
        from: varNodes.find(v => v.id === variable)!,
        to: node,
      }))
    );

    return { varNodes, conNodes, edges };
  }, [currentExample, activeConstraints, conflictingConstraint]);

  const handleNext = () => {
    if (currentStepIndex === currentExample.steps.length - 1) {
      runRandomize();
      setCurrentStepIndex(0);
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleExampleChange = (value: string) => {
    setExampleIndex(parseInt(value, 10));
  };

  const handleSampleCountChange = (value: string) => {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      setSampleCount(Math.max(1, Math.min(500, Math.round(parsed))));
    }
  };

  const totalRuns = stats.success + stats.failure;
  const successRate = totalRuns ? (stats.success / totalRuns) * 100 : 0;
  const latestSolveTime = solveTimes[solveTimes.length - 1] ?? 0;
  const averageSolveTime = useMemo(() => {
    if (!solveTimes.length) return 0;
    const total = solveTimes.reduce((sum, time) => sum + time, 0);
    return total / solveTimes.length;
  }, [solveTimes]);

  const weightLabel = currentExample.weightLabel ?? 'Override Weight';
  const weightDescription = currentExample.weightDescription;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Randomization Explorer</CardTitle>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleExampleChange} value={exampleIndex.toString()}>
          <SelectTrigger className="w-[280px] mb-4">
            <SelectValue placeholder="Select an example" />
          </SelectTrigger>
          <SelectContent>
            {randomizationData.map((example, index) => (
              <SelectItem key={example.name} value={index.toString()}>
                {example.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <CodeBlock code={currentExample.code} language="systemverilog" />
          </div>
          <div className="flex flex-col justify-center items-center">
            <div className="w-full h-48 bg-muted rounded-lg p-4 flex flex-col justify-around items-center">
              {currentExample.variables.map(variable => (
                <div key={variable} className="flex items-center">
                  <span className="font-mono text-lg mr-4">{variable}:</span>
                  <motion.div
                    key={`${variable}-${randomValues[variable] ?? 'unset'}`}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-24 h-12 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-xl font-bold"
                  >
                    {randomValues[variable] ?? '–'}
                  </motion.div>
                </div>
              ))}
            </div>
            <Button onClick={() => runRandomize()} className="mt-4">
              Randomize
            </Button>
            {currentExample.showWeightControl && (
              <div className="w-full mt-4">
                <Label htmlFor="weight" className="mb-2 block">
                  {weightLabel} ({weight}%)
                </Label>
                <Input
                  id="weight"
                  type="range"
                  min={0}
                  max={100}
                  value={weight}
                  onChange={event => {
                    const next = parseInt(event.target.value, 10);
                    setWeight(Number.isNaN(next) ? weight : next);
                  }}
                />
                {weightDescription && (
                  <p className="text-xs text-muted-foreground mt-1">{weightDescription}</p>
                )}
              </div>
            )}

            <div className="w-full mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="sample-count" className="text-sm">
                  Batch samples
                </Label>
                <Input
                  id="sample-count"
                  type="number"
                  min={1}
                  max={500}
                  value={sampleCount}
                  onChange={event => handleSampleCountChange(event.target.value)}
                  className="w-24"
                />
              </div>
              <Button variant="outline" onClick={runBatch}>
                Run Batch
              </Button>
              <Button variant="ghost" onClick={resetMetrics}>
                Reset Metrics
              </Button>
            </div>

            {conflictingConstraint && (
              <div className="w-full mt-4 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm">
                <p>
                  <strong>Solver note:</strong> Last run stalled on <code>{conflictingConstraint}</code>. Disable or
                  adjust that constraint to find a valid solution.
                </p>
              </div>
            )}

            <div className="w-full mt-4">
              <h3 className="mb-2 font-semibold">Constraints</h3>
              {currentExample.constraints.length === 0 ? (
                <p className="text-sm">No constraints</p>
              ) : (
                currentExample.constraints.map(constraint => (
                  <div key={constraint.name} className="flex items-center mb-1">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={activeConstraints[constraint.name]}
                      onChange={event =>
                        setActiveConstraints(prev => ({
                          ...prev,
                          [constraint.name]: event.target.checked,
                        }))
                      }
                    />
                    <span className={conflictingConstraint === constraint.name ? 'text-destructive' : ''}>
                      {constraint.name}: {constraint.expression}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="w-full mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded border p-3 text-sm">
                <p className="font-semibold mb-1">Run Summary</p>
                <p>Successes: {stats.success}</p>
                <p>Failures: {stats.failure}</p>
                <p>Success rate: {successRate.toFixed(1)}%</p>
              </div>
              <div className="rounded border p-3 text-sm">
                <p className="font-semibold mb-1">Solve Time</p>
                <p>Latest: {solveTimes.length ? `${latestSolveTime.toFixed(2)} ms` : '–'}</p>
                <p>Average: {solveTimes.length ? `${averageSolveTime.toFixed(2)} ms` : '–'}</p>
              </div>
            </div>

            <div className="w-full mt-4">
              <h3 className="mb-2 font-semibold">Solver Iterations</h3>
              <ul className="text-sm list-disc pl-4 max-h-40 overflow-y-auto">
                {iterationLog.map((log, idx) => (
                  <li key={`${log}-${idx}`}>{log}</li>
                ))}
              </ul>
            </div>

            <div className="w-full mt-4">
              <h3 className="mb-2 font-semibold">Callbacks</h3>
              <ul className="text-sm list-disc pl-4 max-h-40 overflow-y-auto">
                {callbackLog.map((log, idx) => (
                  <li key={`${log}-${idx}`}>{log}</li>
                ))}
              </ul>
            </div>

            <div className="w-full mt-4">
              <h3 className="mb-2 font-semibold">Distribution</h3>
              <DistributionBarChart data={distributionChartData} />
            </div>

            <div className="w-full mt-4">
              <h3 className="mb-2 font-semibold">Constraint Graph</h3>
              {graph.conNodes.length === 0 ? (
                <p className="text-sm">No constraints</p>
              ) : (
                <svg width={400} height={160} className="border rounded">
                  {graph.edges.map((edge, idx) => (
                    <line
                      key={`edge-${idx}`}
                      x1={edge.from.x}
                      y1={edge.from.y + 10}
                      x2={edge.to.x}
                      y2={edge.to.y - 10}
                      stroke="#888"
                    />
                  ))}
                  {graph.varNodes.map(node => (
                    <g key={node.id}>
                      <circle cx={node.x} cy={node.y} r={10} fill="#8884d8" />
                      <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill="white">
                        {node.id}
                      </text>
                    </g>
                  ))}
                  {graph.conNodes.map(node => (
                    <g key={node.id}>
                      <rect
                        x={node.x - 20}
                        y={node.y - 10}
                        width={40}
                        height={20}
                        fill={node.conflict ? '#f87171' : node.enabled ? '#82ca9d' : '#d1d5db'}
                      />
                      <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill="white">
                        {node.id}
                      </text>
                    </g>
                  ))}
                </svg>
              )}
            </div>

            <div className="w-full mt-4">
              <h3 className="mb-2 font-semibold">Performance Metrics</h3>
              <p className="text-sm mb-2">
                Last solve time: {solveTimes.length ? `${latestSolveTime.toFixed(2)} ms` : '–'}
              </p>
              <SolveTimeLineChart data={solveTimeChartData} />
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="p-4 border rounded-lg bg-background/50 mt-4"
          >
            <p>{currentStep}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-4">
          <Button onClick={handlePrev} disabled={currentStepIndex === 0}>
            Previous
          </Button>
          <Button onClick={handleNext}>
            {currentStepIndex === currentExample.steps.length - 1 ? 'Finish and Randomize' : 'Next'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RandomizationExplorer;
