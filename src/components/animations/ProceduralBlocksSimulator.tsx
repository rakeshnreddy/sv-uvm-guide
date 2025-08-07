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

const Waveform: React.FC<{ data: { time: number; a: number; b: number }[]; step: number }> = ({ data, step }) => {
  const width = 200;
  const height = 60;
  const stepWidth = width / (data.length - 1);
  const scaleY = (v: number) => height - v * 20;

  const buildPath = (key: 'a' | 'b') => {
    let d = `M 0 ${scaleY(data[0][key])}`;
    for (let i = 1; i < data.length; i++) {
      const x = i * stepWidth;
      d += ` H ${x} V ${scaleY(data[i][key])}`;
    }
    return d;
  };

  const pathA = buildPath('a');
  const pathB = buildPath('b');

  const pointerX = Math.min(step, data.length - 1) * stepWidth;

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
      <motion.line
        x1={pointerX}
        x2={pointerX}
        y1={0}
        y2={height}
        stroke="#888"
        strokeWidth={1}
        animate={{ x1: pointerX, x2: pointerX }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  );
};

const BlockingNonBlockingTimeline: React.FC<{ step: number }> = ({ step }) => (
  <div className="grid md:grid-cols-2 gap-4 mt-4">
    <div className="flex flex-col items-center">
      <h4 className="mb-2">Blocking</h4>
      <Waveform data={waveformData.blocking} step={step} />
      <div className="text-xs mt-1">
        a={waveformData.blocking[Math.min(step, 2)].a}, b={waveformData.blocking[Math.min(step, 2)].b}
      </div>
    </div>
    <div className="flex flex-col items-center">
      <h4 className="mb-2">Non-blocking</h4>
      <Waveform data={waveformData.nonBlocking} step={step} />
      <div className="text-xs mt-1">
        a={waveformData.nonBlocking[Math.min(step, 2)].a}, b={waveformData.nonBlocking[Math.min(step, 2)].b}
      </div>
    </div>
  </div>
);

const ForkJoinAnimation: React.FC<{ step: number }> = ({ step }) => {
  const progress1 = Math.min(step / 5, 1) * 100;
  const progress2 = Math.min(step / 10, 1) * 100;
  return (
    <div className="relative w-full h-24 bg-muted rounded mt-4 overflow-hidden">
      <div className="absolute top-2 left-0 h-6 w-full border border-primary/50">
        <motion.div
          className="h-full bg-primary"
          animate={{ width: `${progress1}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="absolute top-14 left-0 h-6 w-full border border-secondary/50">
        <motion.div
          className="h-full bg-secondary"
          animate={{ width: `${progress2}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      {step >= 10 && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-2 bg-accent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </div>
  );
};

const WaitAnimation: React.FC<{ step: number }> = ({ step }) => {
  const signalHigh = step >= 1;
  const triggered = step >= 2;
  return (
    <div className="flex items-center space-x-4 mt-4">
      <div className="flex items-center space-x-2">
        <span>done</span>
        <motion.div
          className="w-4 h-4 rounded-full"
          animate={{ backgroundColor: signalHigh ? '#22c55e' : '#6b7280' }}
          transition={{ duration: 0.2 }}
        />
      </div>
      <AnimatePresence>
        {triggered && (
          <motion.div
            key="waited"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-2 py-1 bg-primary text-primary-foreground rounded"
          >
            a = 1
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DelayAnimation: React.FC<{ step: number }> = ({ step }) => {
  const progress = step === 0 ? 0 : step === 1 ? 50 : 100;
  return (
    <div className="relative w-full h-6 bg-muted rounded mt-4">
      <motion.div
        className="h-full bg-primary"
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
      />
      {step === 2 && (
        <span className="absolute right-0 -top-6 text-xs">a = 1</span>
      )}
    </div>
  );
};

const LoopAnimation: React.FC<{ step: number }> = ({ step }) => {
  const iterations = 3;
  return (
    <div className="flex space-x-2 mt-4">
      {Array.from({ length: iterations }).map((_, i) => (
        <motion.div
          key={i}
          className="w-6 h-6 rounded-full bg-muted"
          animate={{ backgroundColor: i < step ? '#3b82f6' : '#e5e7eb' }}
          transition={{ duration: 0.2 }}
        />
      ))}
    </div>
  );
};

const ProceduralBlocksSimulator = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setCurrentStepIndex(prev => {
        if (prev < proceduralBlocksData[exampleIndex].steps.length - 1) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, 1000 / speed);
    return () => clearInterval(id);
  }, [isPlaying, speed, exampleIndex]);

  const handleStep = () => {
    setCurrentStepIndex(prev => (prev < proceduralBlocksData[exampleIndex].steps.length - 1 ? prev + 1 : prev));
  };

  const handleRewind = () => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  const handleExampleChange = (index: string) => {
    setExampleIndex(parseInt(index));
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  const currentExample = proceduralBlocksData[exampleIndex];
  const currentStep = currentExample.steps[currentStepIndex];

  const renderVisualization = () => {
    switch (currentExample.name) {
      case 'Blocking vs. Non-blocking':
        return <BlockingNonBlockingTimeline step={currentStepIndex} />;
      case 'Fork/Join':
        return <ForkJoinAnimation step={currentStepIndex} />;
      case 'Wait Statement':
        return <WaitAnimation step={currentStepIndex} />;
      case '#Delay':
        return <DelayAnimation step={currentStepIndex} />;
      case 'Loop':
        return <LoopAnimation step={currentStepIndex} />;
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

        <div className="flex items-center justify-between mt-4">
          <div className="flex space-x-2">
            <Button onClick={handleRewind} disabled={currentStepIndex === 0}>Rewind</Button>
            <Button onClick={() => setIsPlaying(p => !p)}>{isPlaying ? 'Pause' : 'Run'}</Button>
            <Button onClick={handleStep} disabled={currentStepIndex === currentExample.steps.length - 1}>Step</Button>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs">Speed</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.5}
              value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
            />
            <span className="text-xs">{speed.toFixed(1)}x</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProceduralBlocksSimulator;
