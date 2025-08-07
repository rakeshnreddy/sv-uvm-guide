"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { proceduralBlocksData } from './procedural-blocks-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

// Waveform data for blocking vs non-blocking assignments
const waveformData = {
  blocking: [
    { time: 0, a: 1, b: 2 },
    { time: 1, a: 2, b: 2 },
    { time: 2, a: 2, b: 2 },
  ],
  nonBlocking: [
    { time: 0, a: 1, b: 2 },
    { time: 1, a: 1, b: 2 },
    { time: 2, a: 2, b: 1 },
  ],
};

const Waveform: React.FC<{ data: { time: number; a: number; b: number }[] }> = ({ data }) => {
  const width = 200;
  const height = 60;
  const step = width / (data.length - 1);
  const scaleY = (v: number) => height - v * 20;

  const buildPath = (key: 'a' | 'b') => {
    let d = `M 0 ${scaleY(data[0][key])}`;
    for (let i = 1; i < data.length; i++) {
      const x = i * step;
      d += ` H ${x} V ${scaleY(data[i][key])}`;
    }
    return d;
  };

  const pathA = buildPath('a');
  const pathB = buildPath('b');

  return (
    <svg width={width} height={height} className="bg-background rounded">
      <motion.path
        d={pathA}
        fill="none"
        stroke="#ef4444"
        strokeWidth={2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
      />
      <motion.path
        d={pathB}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.2 }}
      />
    </svg>
  );
};

const BlockingNonBlockingTimeline = () => (
  <div className="grid md:grid-cols-2 gap-4 mt-4">
    <div className="flex flex-col items-center">
      <h4 className="mb-2">Blocking</h4>
      <Waveform data={waveformData.blocking} />
    </div>
    <div className="flex flex-col items-center">
      <h4 className="mb-2">Non-blocking</h4>
      <Waveform data={waveformData.nonBlocking} />
    </div>
  </div>
);

const ForkJoinAnimation = () => (
  <div className="relative w-full h-24 bg-muted rounded mt-4 overflow-hidden">
    <motion.div
      className="absolute top-2 left-0 h-6 bg-primary"
      initial={{ width: 0 }}
      animate={{ width: '100%' }}
      transition={{ duration: 2 }}
    />
    <motion.div
      className="absolute top-14 left-0 h-6 bg-secondary"
      initial={{ width: 0 }}
      animate={{ width: '100%' }}
      transition={{ duration: 4 }}
    />
    <motion.div
      className="absolute bottom-0 left-0 right-0 h-2 bg-accent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 4 }}
    />
  </div>
);

const EventWaitAnimation = () => {
  const [clk, setClk] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setClk(c => !c), 800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center space-x-4 mt-4">
      <div className="flex items-center space-x-2">
        <span>clk</span>
        <motion.div
          className="w-4 h-4 rounded-full"
          animate={{ backgroundColor: clk ? '#22c55e' : '#6b7280' }}
          transition={{ duration: 0.2 }}
        />
      </div>
      <AnimatePresence>
        {clk && (
          <motion.div
            key="proc"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-2 py-1 bg-primary text-primary-foreground rounded"
          >
            Triggered
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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

  const renderVisualization = () => {
    switch (currentExample.name) {
      case 'Blocking vs. Non-blocking':
        return <BlockingNonBlockingTimeline />;
      case 'Fork/Join':
        return <ForkJoinAnimation />;
      case 'Always Block':
        return <EventWaitAnimation />;
      default:
        return null;
    }
  };

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

        {renderVisualization()}

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
