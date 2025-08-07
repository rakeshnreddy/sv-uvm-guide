"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { coverageData } from './coverage-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

const CoverageAnalyzer = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [coverageState, setCoverageState] = useState<{ [key: string]: boolean[] }>({});

  const currentExample = coverageData[exampleIndex];
  const currentStep = currentExample.steps[currentStepIndex];

  useEffect(() => {
    const initialState: { [key: string]: boolean[] } = {};
    currentExample.coverpoints.forEach(cp => {
      initialState[cp.name] = cp.bins.map(() => false);
    });
    setCoverageState(initialState);
    setCurrentStepIndex(0);
  }, [currentExample]);

  useEffect(() => {
    const newState: { [key: string]: boolean[] } = {};
    currentExample.coverpoints.forEach(cp => {
      let remaining = currentStepIndex;
      newState[cp.name] = cp.bins.map(bin => {
        if (!bin.isCovered) return false;
        if (remaining > 0) {
          remaining -= 1;
          return true;
        }
        return false;
      });
    });
    setCoverageState(newState);
  }, [currentStepIndex, currentExample]);

  const handleNext = () => {
    setCurrentStepIndex(prev => (prev < coverageData[exampleIndex].steps.length - 1 ? prev + 1 : prev));
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleExampleChange = (index: string) => {
    setExampleIndex(parseInt(index));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Coverage Analyzer</CardTitle>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleExampleChange} defaultValue={exampleIndex.toString()}>
          <SelectTrigger className="w-[280px] mb-4">
            <SelectValue placeholder="Select an example" />
          </SelectTrigger>
          <SelectContent>
            {coverageData.map((example, index) => (
              <SelectItem key={example.name} value={index.toString()}>{example.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <CodeBlock code={currentExample.code} language="systemverilog" />
          </div>
          <div className="flex flex-col justify-center items-center">
            <div className="w-full bg-muted rounded-lg p-4 flex flex-col justify-around">
              {currentExample.coverpoints.map(cp => {
                const binsState = coverageState[cp.name] || [];
                const isCross = cp.name.startsWith('cross');
                if (isCross) {
                  const aVals = Array.from(new Set(
                    cp.bins.map(b => parseInt(b.name.match(/a=(\d+)/)?.[1] || '0'))
                  )).sort((a, b) => a - b);
                  const bVals = Array.from(new Set(
                    cp.bins.map(b => parseInt(b.name.match(/b=(\d+)/)?.[1] || '0'))
                  )).sort((a, b) => a - b);
                  return (
                    <div key={cp.name} className="mb-4">
                      <h4 className="font-semibold mb-2">{cp.name}</h4>
                      <table className="border-collapse">
                        <thead>
                          <tr>
                            <th className="p-1"></th>
                            {bVals.map(b => (
                              <th key={b} className="p-1 text-sm">b={b}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {aVals.map(a => (
                            <tr key={a}>
                              <th className="p-1 text-sm text-left">a={a}</th>
                              {bVals.map(b => {
                                const idx = cp.bins.findIndex(
                                  bin => bin.name.includes(`a=${a}`) && bin.name.includes(`b=${b}`)
                                );
                                const covered = binsState[idx];
                                return (
                                  <td key={b} className="p-1">
                                    <motion.div
                                      initial={{ scale: 0.8 }}
                                      animate={{
                                        scale: 1,
                                        backgroundColor: covered ? '#22c55e' : '#d1d5db'
                                      }}
                                      className="w-8 h-8 rounded"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }
                return (
                  <div key={cp.name} className="mb-4">
                    <h4 className="font-semibold">{cp.name}</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {cp.bins.map((bin, idx) => (
                        <motion.div
                          key={bin.name}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            backgroundColor: binsState[idx] ? '#22c55e' : '#d1d5db'
                          }}
                          className="px-3 py-1 rounded-full text-sm text-black"
                        >
                          {bin.name}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-semibold mb-2">Requirements Progress</h4>
          {currentExample.coverpoints.map(cp => {
            const binsState = coverageState[cp.name] || [];
            const total = cp.bins.length;
            const covered = binsState.filter(Boolean).length;
            const percent = Math.round((covered / total) * 100);
            return (
              <div key={cp.name} className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>{cp.name}</span>
                  <span>{percent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    className="h-2 bg-primary rounded"
                  />
                </div>
              </div>
            );
          })}
          {(() => {
            const totals = currentExample.coverpoints.reduce(
              (acc, cp) => {
                acc.total += cp.bins.length;
                acc.covered += (coverageState[cp.name] || []).filter(Boolean).length;
                return acc;
              },
              { total: 0, covered: 0 }
            );
            const percent = totals.total ? Math.round((totals.covered / totals.total) * 100) : 0;
            return (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Overall Coverage</span>
                  <span>{percent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    className="h-2 bg-primary rounded"
                  />
                </div>
              </div>
            );
          })()}
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
          <Button onClick={handleNext} disabled={currentStepIndex === currentExample.steps.length - 1}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CoverageAnalyzer;
