"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { randomizationData } from './randomization-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

const RandomizationExplorer = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [randomValues, setRandomValues] = useState<{ [key: string]: number }>({});

  const currentExample = randomizationData[exampleIndex];

  useEffect(() => {
    randomize();
  }, [exampleIndex]);

  const randomize = () => {
    const newValues: { [key: string]: number } = {};
    currentExample.variables.forEach(v => {
      newValues[v] = Math.floor(Math.random() * 256);
    });
    setRandomValues(newValues);
  };

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
