"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { interfaceData } from './interface-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

const InterfaceSignalFlow = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const handleNext = () => {
    setCurrentStepIndex(prev => (prev < interfaceData[exampleIndex].steps.length - 1 ? prev + 1 : prev));
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleExampleChange = (index: string) => {
    setExampleIndex(parseInt(index));
    setCurrentStepIndex(0);
  };

  const currentExample = interfaceData[exampleIndex];
  const currentStep = currentExample.steps[currentStepIndex];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Interface Signal Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleExampleChange} defaultValue={exampleIndex.toString()}>
          <SelectTrigger className="w-[280px] mb-4">
            <SelectValue placeholder="Select an example" />
          </SelectTrigger>
          <SelectContent>
            {interfaceData.map((example, index) => (
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
              {currentExample.signals.map((signal, index) => (
                <motion.div
                  key={signal.name}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className="flex items-center justify-between"
                >
                  <span className="font-mono text-lg">{signal.name}</span>
                  <div className="flex items-center">
                    <span className="text-sm mr-2">{signal.direction}</span>
                    <div className={`w-16 h-2 ${signal.direction === 'in' ? 'bg-green-500' : signal.direction === 'out' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                  </div>
                </motion.div>
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

export default InterfaceSignalFlow;
