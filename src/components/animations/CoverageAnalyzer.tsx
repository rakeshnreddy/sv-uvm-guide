"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { coverageData } from './coverage-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

const CoverageAnalyzer = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const handleNext = () => {
    setCurrentStepIndex(prev => (prev < coverageData[exampleIndex].steps.length - 1 ? prev + 1 : prev));
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleExampleChange = (index: string) => {
    setExampleIndex(parseInt(index));
    setCurrentStepIndex(0);
  };

  const currentExample = coverageData[exampleIndex];
  const currentStep = currentExample.steps[currentStepIndex];

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
            <div className="w-full h-48 bg-muted rounded-lg p-4 flex flex-col justify-around">
              {currentExample.coverpoints.map((cp) => (
                <div key={cp.name}>
                  <h4 className="font-semibold">{cp.name}</h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {cp.bins.map((bin) => (
                      <motion.div
                        key={bin.name}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`px-3 py-1 rounded-full text-sm ${bin.isCovered ? 'bg-green-500 text-white' : 'bg-gray-300'}`}
                      >
                        {bin.name}
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
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
          <Button onClick={handleNext} disabled={currentStepIndex === currentExample.steps.length - 1}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CoverageAnalyzer;
