"use client";
import React, { useState, useEffect, useMemo } from 'react';
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

  const parseBinName = (name: string) => {
    const regex = /(\w+)=(\d+)/g;
    const result: Record<string, number> = {};
    let match;
    while ((match = regex.exec(name))) {
      result[match[1]] = parseInt(match[2]);
    }
    return result;
  };

  const renderMatrix = (
    cp: (typeof currentExample.coverpoints)[number],
    binsState: boolean[],
    xVar: string,
    yVar: string,
    xVals: number[],
    yVals: number[],
    filter?: (vals: Record<string, number>) => boolean
  ) => (
    <table className="border-collapse">
      <thead>
        <tr>
          <th className="p-1"></th>
          {xVals.map(x => (
            <th key={x} className="p-1 text-sm">{`${xVar}=${x}`}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {yVals.map(y => (
          <tr key={y}>
            <th className="p-1 text-sm text-left">{`${yVar}=${y}`}</th>
            {xVals.map(x => {
              const idx = cp.bins.findIndex(bin => {
                const parsed = parseBinName(bin.name);
                return (
                  parsed[xVar] === x &&
                  parsed[yVar] === y &&
                  (!filter || filter(parsed))
                );
              });
              const covered = binsState[idx];
              return (
                <td key={x} className="p-1">
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
  );

  const coverageHoles = useMemo(() => {
    const holes: { cp: string; bin: string; suggestion: string }[] = [];
    currentExample.coverpoints.forEach(cp => {
      const binsState = coverageState[cp.name] || [];
      cp.bins.forEach((bin, idx) => {
        if (!binsState[idx]) {
          holes.push({
            cp: cp.name,
            bin: bin.name,
            suggestion: `Add tests to cover ${bin.name}`
          });
        }
      });
    });
    return holes;
  }, [coverageState, currentExample]);

  const generateReport = () => {
    return {
      example: currentExample.name,
      coverpoints: currentExample.coverpoints.map(cp => {
        const binsState = coverageState[cp.name] || [];
        const total = cp.bins.length;
        const covered = binsState.filter(Boolean).length;
        const percent = total ? Math.round((covered / total) * 100) : 0;
        const holes = cp.bins
          .filter((_, idx) => !binsState[idx])
          .map(bin => bin.name);
        return {
          name: cp.name,
          requirementId: cp.requirementId,
          goal: cp.goal,
          total,
          covered,
          percent,
          holes
        };
      })
    };
  };

  const downloadJSON = () => {
    const report = generateReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coverage-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadHTML = () => {
    const report = generateReport();
    const html = `<html><body><h1>Coverage Report - ${report.example}</h1>${report.coverpoints
      .map(
        cp =>
          `<h2>${cp.name} (${cp.requirementId})</h2><p>${cp.percent}% coverage</p><ul>${cp.holes
            .map(h => `<li>${h}</li>`)
            .join('')}</ul>`
      )
      .join('')}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coverage-report.html';
    a.click();
    URL.revokeObjectURL(url);
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
                  const binValues = cp.bins.map(b => parseBinName(b.name));
                  const variables = Object.keys(binValues[0] || {});
                  const valueSets: Record<string, number[]> = {};
                  variables.forEach(v => {
                    valueSets[v] = Array.from(new Set(binValues.map(b => b[v]))).sort(
                      (a, b) => a - b
                    );
                  });
                  if (variables.length === 2) {
                    const [xVar, yVar] = variables;
                    return (
                      <div key={cp.name} className="mb-4">
                        <h4 className="font-semibold mb-2">
                          {cp.name} ({cp.requirementId})
                        </h4>
                        {renderMatrix(
                          cp,
                          binsState,
                          xVar,
                          yVar,
                          valueSets[xVar],
                          valueSets[yVar]
                        )}
                      </div>
                    );
                  }
                  if (variables.length === 3) {
                    const [xVar, yVar, zVar] = variables;
                    return (
                      <div key={cp.name} className="mb-4">
                        <h4 className="font-semibold mb-2">
                          {cp.name} ({cp.requirementId})
                        </h4>
                        {valueSets[zVar].map(z => (
                          <div key={z} className="mb-2">
                            <h5 className="text-sm font-medium mb-1">{`${zVar}=${z}`}</h5>
                            {renderMatrix(
                              cp,
                              binsState,
                              xVar,
                              yVar,
                              valueSets[xVar],
                              valueSets[yVar],
                              vals => vals[zVar] === z
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div key={cp.name} className="mb-4">
                      <h4 className="font-semibold mb-2">
                        {cp.name} ({cp.requirementId})
                      </h4>
                      <p className="text-sm">
                        Cross coverage with more than 3 variables not supported.
                      </p>
                    </div>
                  );
                }
                return (
                  <div key={cp.name} className="mb-4">
                    <h4 className="font-semibold">
                      {cp.name} ({cp.requirementId})
                    </h4>
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
            const percent = total ? Math.round((covered / total) * 100) : 0;
            const barColor = percent >= cp.goal ? 'bg-green-500' : 'bg-primary';
            return (
              <div key={cp.name} className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <a href={`#${cp.requirementId}`} className="underline">
                    {cp.name} ({cp.requirementId})
                  </a>
                  <span>
                    {percent}% / {cp.goal}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(percent, 100)}%` }}
                    className={`h-2 ${barColor} rounded`}
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

        {coverageHoles.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold mb-2">Coverage Holes & Suggestions</h4>
            <ul className="list-disc ml-6 text-sm">
              {coverageHoles.map((hole, idx) => (
                <li key={idx}>
                  {hole.cp}: {hole.bin} - {hole.suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button onClick={downloadJSON}>Download JSON</Button>
          <Button onClick={downloadHTML}>Download HTML</Button>
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
