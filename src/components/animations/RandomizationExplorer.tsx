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
} from 'recharts';

const RandomizationExplorer = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [randomValues, setRandomValues] = useState<{ [key: string]: number }>({});
  const [iterationLog, setIterationLog] = useState<string[]>([]);
  const [distribution, setDistribution] = useState<number[]>(Array(16).fill(0));
  const [weight, setWeight] = useState(50);

  const currentExample = randomizationData[exampleIndex];

  useEffect(() => {
    setDistribution(Array(16).fill(0));
    setIterationLog([]);
    setWeight(50);
    randomize(50);
  }, [exampleIndex, randomize]);

  const updateDistribution = (value: number) => {
    const bin = Math.floor(value / 16);
    setDistribution(prev => {
      const next = [...prev];
      next[bin] += 1;
      return next;
    });
  };

  const checkConstraints = (
    exampleIdx: number,
    values: { [key: string]: number },
    w: number
  ): { ok: boolean; reason?: string } => {
    switch (exampleIdx) {
      case 1: {
        const useOverride = Math.random() * 100 < w;
        const threshold = useOverride ? 200 : 100;
        if (values.data <= threshold) {
          return {
            ok: false,
            reason: `data (${values.data}) <= ${threshold} (${useOverride ? 'override' : 'base'})`,
          };
        }
        return { ok: true };
      }
      case 2: {
        if (values.len >= 5) {
          return { ok: false, reason: `len (${values.len}) >= 5` };
        }
        if (values.data >= values.len * 10) {
          return {
            ok: false,
            reason: `data (${values.data}) >= len*10 (${values.len * 10})`,
          };
        }
        return { ok: true };
      }
      default:
        return { ok: true };
    }
  };

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

  const distributionChartData = useMemo(
    () =>
      distribution.map((count, index) => ({
        range: `${index * 16}-${index * 16 + 15}`,
        count,
      })),
    [distribution]
  );

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
              <Button onClick={randomize} className="mt-4">Randomize</Button>
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
              <div className="w-full mt-4">
                <h3 className="mb-2 font-semibold">Solver Iterations</h3>
                <ul className="text-sm list-disc pl-4 max-h-40 overflow-y-auto">
                  {iterationLog.map((log, i) => (
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
