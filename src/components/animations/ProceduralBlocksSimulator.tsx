"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { proceduralBlocksData } from './procedural-blocks-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

const ProceduralBlocksSimulator = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const handleNext = () => {
    setCurrentStepIndex(prev => (prev < proceduralBlocksData[exampleIndex].steps.length - 1 ? prev + 1 : prev));
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleExampleChange = (index: string) => {
    setExampleIndex(parseInt(index));
    setCurrentStepIndex(0);
  };

  const currentExample = proceduralBlocksData[exampleIndex];
  const currentStep = currentExample.steps[currentStepIndex];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Procedural Blocks Simulator</CardTitle>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleExampleChange} defaultValue={exampleIndex.toString()}>
          <SelectTrigger className="w-[280px] mb-4">
            <SelectValue placeholder="Select an example" />
          </SelectTrigger>
          <SelectContent>
            {proceduralBlocksData.map((example, index) => (
              <SelectItem key={example.name} value={index.toString()}>{example.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <CodeBlock code={currentExample.code} language="systemverilog" />

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

export default ProceduralBlocksSimulator;
