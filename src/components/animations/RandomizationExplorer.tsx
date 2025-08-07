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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from 'recharts';

const RandomizationExplorer = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [randomValues, setRandomValues] = useState<{ [key: string]: number }>({});
  const [iterationLog, setIterationLog] = useState<string[]>([]);
  const [distribution, setDistribution] = useState<number[]>(Array(16).fill(0));
  const [weight, setWeight] = useState(50);
  const [activeConstraints, setActiveConstraints] = useState<{ [key: string]: boolean }>({});
  const [conflictingConstraint, setConflictingConstraint] = useState<string | null>(null);
  const [callbackLog, setCallbackLog] = useState<string[]>([]);
  const [solveTimes, setSolveTimes] = useState<number[]>([]);

  const currentExample = randomizationData[exampleIndex];

  const randomize = useCallback(
    (w = weight) => {
      const iterations: string[] = [];
      let newValues: { [key: string]: number } = {};
      for (let attempt = 1; attempt <= 20; attempt++) {
        const attemptValues: { [key: string]: number } = {};
        currentExample.variables.forEach(v => {
          attemptValues[v] = Math.floor(Math.random() * 256);
        });
        const result = checkConstraints(exampleIndex, attemptValues, w);
        if (result.ok) {
          newValues = attemptValues;
          iterations.push(`Iteration ${attempt}: success`);
          if (attemptValues.data !== undefined) {
            updateDistribution(attemptValues.data);
          }
          break;
        } else {
          iterations.push(`Iteration ${attempt}: ${result.reason}`);
        }
      }
      setRandomValues(newValues);
      setIterationLog(iterations);
    },
    [exampleIndex, currentExample, weight]
  );

  useEffect(() => {
    const initialActive = currentExample.constraints.reduce(
      (acc, c) => ({ ...acc, [c.name]: true }),
      {}
    );
    setActiveConstraints(initialActive);
    setDistribution(Array(16).fill(0));
    setIterationLog([]);
    setWeight(50);
    setSolveTimes([]);
    setCallbackLog([]);
    setConflictingConstraint(null);
  }, [currentExample]);

  useEffect(() => {
    randomize(50);
  }, [currentExample, activeConstraints, randomize]);

  const updateDistribution = useCallback((value: number) => {
    const bin = Math.floor(value / 16);
    setDistribution(prev => {
      const next = [...prev];
      next[bin] += 1;
      return next;
    });
  }, []);

  const randomize = useCallback(
    (w = weight) => {
      const iterations: string[] = [];
      const cbMessages: string[] = [];
      if (currentExample.preRandomize) {
        cbMessages.push(currentExample.preRandomize());
      }
      let newValues: { [key: string]: number } = {};
      let conflictName: string | null = null;
      const start = performance.now();
      for (let attempt = 1; attempt <= 20; attempt++) {
        const attemptValues: { [key: string]: number } = {};
        currentExample.variables.forEach(v => {
          attemptValues[v] = Math.floor(Math.random() * 256);
        });
        conflictName = null;
        let conflictReason = '';
        for (const c of currentExample.constraints) {
          if (!activeConstraints[c.name]) continue;
          const res = c.check(attemptValues, w);
          if (!res.ok) {
            conflictName = c.name;
            conflictReason = res.reason || 'failed';
            break;
          }
        }
        if (!conflictName) {
          newValues = attemptValues;
          iterations.push(`Iteration ${attempt}: success`);
          if (attemptValues.data !== undefined) {
            updateDistribution(attemptValues.data);
          }
          break;
        } else {
          iterations.push(`Iteration ${attempt}: ${conflictName} - ${conflictReason}`);
        }
      }
      const end = performance.now();
      if (currentExample.postRandomize) {
        cbMessages.push(currentExample.postRandomize(newValues));
      }
      setRandomValues(newValues);
      setIterationLog(iterations);
      setConflictingConstraint(conflictName);
      setCallbackLog(cbMessages);
      setSolveTimes(prev => [...prev, end - start]);
    },
    [currentExample, weight, activeConstraints, updateDistribution]
  );


  const distributionChartData = useMemo(
    () =>
      distribution.map((count, index) => ({
        range: `${index * 16}-${index * 16 + 15}`,
        count,
      })),
    [distribution]
  );

  const solveTimeChartData = useMemo(
    () => solveTimes.map((time, index) => ({ run: index + 1, time })),
    [solveTimes]
  );

  const graph = useMemo(() => {
    const width = 400;
    const varSpacing = width / (currentExample.variables.length + 1);
    const conSpacing = width / (currentExample.constraints.length + 1);
    const varNodes = currentExample.variables.map((v, i) => ({
      id: v,
      x: (i + 1) * varSpacing,
      y: 20,
    }));
    const conNodes = currentExample.constraints.map((c, i) => ({
      id: c.name,
      x: (i + 1) * conSpacing,
      y: 120,
      dependsOn: c.dependsOn,
      enabled: activeConstraints[c.name],
      conflict: conflictingConstraint === c.name,
    }));
    const edges = conNodes.flatMap(c =>
      c.dependsOn.map(v => ({
        from: varNodes.find(vn => vn.id === v)!,
        to: c,
      }))
    );
    return { varNodes, conNodes, edges };
  }, [currentExample, activeConstraints, conflictingConstraint]);

  const handleNext = () => {
    if (currentStepIndex === currentExample.steps.length - 1) {
      randomize();
      setCurrentStepIndex(0);
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleExampleChange = (index: string) => {
    setExampleIndex(parseInt(index));
    setCurrentStepIndex(0);
  };

  const currentStep = currentExample.steps[currentStepIndex];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Randomization Explorer</CardTitle>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleExampleChange} defaultValue={exampleIndex.toString()}>
          <SelectTrigger className="w-[280px] mb-4">
            <SelectValue placeholder="Select an example" />
          </SelectTrigger>
          <SelectContent>
            {randomizationData.map((example, index) => (
              <SelectItem key={example.name} value={index.toString()}>{example.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <CodeBlock code={currentExample.code} language="systemverilog" />
          </div>
            <div className="flex flex-col justify-center items-center">
              <div className="w-full h-48 bg-muted rounded-lg p-4 flex flex-col justify-around items-center">
                {currentExample.variables.map((v) => (
                  <div key={v} className="flex items-center">
                    <span className="font-mono text-lg mr-4">{v}:</span>
                    <motion.div
                      key={randomValues[v]}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-24 h-12 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-xl font-bold"
                    >
                      {randomValues[v]}
                    </motion.div>
                  </div>
                ))}
              </div>
              <Button onClick={() => randomize()} className="mt-4">Randomize</Button>
              {exampleIndex === 1 && (
                <div className="w-full mt-4">
                  <Label htmlFor="weight" className="mb-2 block">
                    Override Weight ({weight}%)
                  </Label>
                  <Input
                    id="weight"
                    type="range"
                    min={0}
                    max={100}
                    value={weight}
                    onChange={(e) => setWeight(parseInt(e.target.value))}
                  />
                </div>
              )}
              {currentExample.constraints.length > 0 && (
                <div className="w-full mt-4">
                  <h3 className="mb-2 font-semibold">Constraints</h3>
                  {currentExample.constraints.map(c => (
                    <div key={c.name} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={activeConstraints[c.name]}
                        onChange={(e) =>
                          setActiveConstraints(prev => ({ ...prev, [c.name]: e.target.checked }))
                        }
                      />
                      <span className={conflictingConstraint === c.name ? 'text-destructive' : ''}>
                        {c.name}: {c.expression}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="w-full mt-4">
                <h3 className="mb-2 font-semibold">Solver Iterations</h3>
                <ul className="text-sm list-disc pl-4 max-h-40 overflow-y-auto">
                  {iterationLog.map((log, i) => (
                    <li key={i}>{log}</li>
                  ))}
                </ul>
              </div>
              <div className="w-full mt-4">
                <h3 className="mb-2 font-semibold">Callbacks</h3>
                <ul className="text-sm list-disc pl-4 max-h-40 overflow-y-auto">
                  {callbackLog.map((log, i) => (
                    <li key={i}>{log}</li>
                  ))}
                </ul>
              </div>
              <div className="w-full mt-4">
                <h3 className="mb-2 font-semibold">Distribution</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={distributionChartData}>
                    <XAxis dataKey="range" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full mt-4">
                <h3 className="mb-2 font-semibold">Constraint Graph</h3>
                {graph.conNodes.length === 0 ? (
                  <p className="text-sm">No constraints</p>
                ) : (
                  <svg width={400} height={160} className="border rounded">
                    {graph.edges.map((e, i) => (
                      <line
                        key={i}
                        x1={e.from.x}
                        y1={e.from.y + 10}
                        x2={e.to.x}
                        y2={e.to.y - 10}
                        stroke="#888"
                      />
                    ))}
                    {graph.varNodes.map(v => (
                      <g key={v.id}>
                        <circle cx={v.x} cy={v.y} r={10} fill="#8884d8" />
                        <text x={v.x} y={v.y + 4} textAnchor="middle" fontSize="10" fill="white">
                          {v.id}
                        </text>
                      </g>
                    ))}
                    {graph.conNodes.map(c => (
                      <g key={c.id}>
                        <rect
                          x={c.x - 20}
                          y={c.y - 10}
                          width={40}
                          height={20}
                          fill={c.conflict ? '#f87171' : c.enabled ? '#82ca9d' : '#d1d5db'}
                        />
                        <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="10" fill="white">
                          {c.id}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
              <div className="w-full mt-4">
                <h3 className="mb-2 font-semibold">Performance Metrics</h3>
                <p className="text-sm mb-2">
                  Last solve time: {solveTimes[solveTimes.length - 1]?.toFixed(2) ?? '0'} ms
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={solveTimeChartData}>
                    <XAxis dataKey="run" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="time" stroke="#82ca9d" />
                  </LineChart>
                </ResponsiveContainer>
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
          <Button onClick={handlePrev} disabled={currentStepIndex === 0}>Previous</Button>
          <Button onClick={handleNext}>
            {currentStepIndex === currentExample.steps.length - 1 ? 'Finish and Randomize' : 'Next'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RandomizationExplorer;
