"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { interfaceData } from './interface-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

const InterfaceSignalFlow = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [clock, setClock] = useState(0);
  const [signalValues, setSignalValues] = useState<number[]>([]);

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
  const dataSignals = currentExample.signals.filter(s => s.name !== 'clk');

  useEffect(() => {
    setSignalValues(dataSignals.map(() => 0));
    setClock(0);
  }, [currentExample, dataSignals]);

  useEffect(() => {
    const id = setInterval(() => {
      setClock(prev => 1 - prev);
      setSignalValues(prev => prev.map(v => (v ? 0 : 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [currentExample]);

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
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-lg">clk</span>
                <motion.div
                  animate={{ backgroundColor: clock ? '#22c55e' : '#ef4444' }}
                  className="w-16 h-2 rounded"
                />
              </div>
              {dataSignals.map((signal, index) => (
                <motion.div
                  key={signal.name + clock}
                  initial={{ opacity: 0, x: signal.direction === 'out' ? 50 : -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex items-center justify-between"
                >
                  <span className="font-mono text-lg">{signal.name}</span>
                  <div className="flex items-center">
                    <motion.span
                      key={clock}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm mr-2"
                    >
                      {signal.direction === 'in'
                        ? 'sample'
                        : signal.direction === 'out'
                        ? 'drive'
                        : 'bidirectional'}
                    </motion.span>
                    <motion.div
                      key={signalValues[index] + clock}
                      initial={{ width: 0 }}
                      animate={{ width: 64 }}
                      transition={{ duration: 0.5 }}
                      className={`h-2 rounded ${signal.direction === 'in' ? 'bg-green-500' : signal.direction === 'out' ? 'bg-blue-500' : 'bg-yellow-500'}`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
            {currentExample.name === 'Virtual Interface Binding' && (
              <div className="flex items-center justify-center mt-4">
                <div className="p-2 border rounded mr-2">Driver</div>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '4rem' }}
                  transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                  className="h-0.5 bg-blue-500"
                />
                <div className="p-2 border rounded ml-2">Interface</div>
              </div>
            )}
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
