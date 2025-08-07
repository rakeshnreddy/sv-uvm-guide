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
  const [phase, setPhase] = useState<'sample' | 'drive'>('sample');
  const [arrayIndex, setArrayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1000);

  const handleNext = () => {
    setCurrentStepIndex(prev => (prev < interfaceData[exampleIndex].steps.length - 1 ? prev + 1 : prev));
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleExampleChange = (index: string) => {
    setExampleIndex(parseInt(index));
    setCurrentStepIndex(0);
    setPhase('sample');
    setArrayIndex(0);
    setIsPlaying(true);
  };

  const currentExample = interfaceData[exampleIndex];
  const currentStep = currentExample.steps[currentStepIndex];
  const dataSignals = currentExample.signals.filter(s => s.name !== 'clk');

  useEffect(() => {
    setSignalValues(dataSignals.map(() => 0));
    setClock(0);
    setPhase('sample');
    setArrayIndex(0);
  }, [currentExample, dataSignals]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setClock(prev => 1 - prev);
      setSignalValues(prev => prev.map(v => (v ? 0 : 1)));
      setPhase(prev => (prev === 'sample' ? 'drive' : 'sample'));
      if (currentExample.arraySize) {
        setArrayIndex(prev => (prev + 1) % currentExample.arraySize);
      }
    }, speed);
    return () => clearInterval(id);
  }, [currentExample, isPlaying, speed]);

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

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button variant="outline" onClick={() => setIsPlaying(p => !p)}>
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Select onValueChange={v => setSpeed(parseInt(v))} defaultValue={speed.toString()}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Speed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2000">Slow</SelectItem>
              <SelectItem value="1000">Normal</SelectItem>
              <SelectItem value="500">Fast</SelectItem>
            </SelectContent>
          </Select>
          {currentExample.arraySize && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setArrayIndex(prev =>
                    (prev - 1 + currentExample.arraySize!) % currentExample.arraySize!
                  )
                }
              >
                -
              </Button>
              <span className="text-sm font-mono">{arrayIndex}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setArrayIndex(prev => (prev + 1) % currentExample.arraySize!)
                }
              >
                +
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <CodeBlock code={currentExample.code} language="systemverilog" />
          </div>
          <div className="flex flex-col justify-center items-center">
            <div className="w-full h-48 bg-muted rounded-lg p-4 flex flex-col justify-around">
              {currentExample.parameters && (
                <div className="mb-2 text-sm font-mono">
                  {Object.entries(currentExample.parameters).map(([p, v]) => (
                    <span key={p} className="mr-2">{`${p}=${v}`}</span>
                  ))}
                </div>
              )}
              {currentExample.arraySize && (
                <div className="mb-2 font-mono">Index: {arrayIndex}</div>
              )}
              <div className="relative w-full h-2 bg-background rounded mb-2 overflow-hidden">
                <motion.div
                  key={clock}
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: speed / 1000, ease: 'linear' }}
                  className="absolute top-0 left-0 h-full bg-blue-200"
                />
                {dataSignals.map(
                  signal =>
                    signal.timing?.sample !== undefined && (
                      <div
                        key={`${signal.name}-sample-marker`}
                        title={`${signal.name} sample`}
                        style={{ left: `${signal.timing.sample * 100}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-green-500"
                      />
                    )
                )}
                {dataSignals.map(
                  signal =>
                    signal.timing?.drive !== undefined && (
                      <div
                        key={`${signal.name}-drive-marker`}
                        title={`${signal.name} drive`}
                        style={{ left: `${signal.timing.drive * 100}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-blue-500"
                      />
                    )
                )}
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-lg" title="clock">clk</span>
                <motion.div
                  animate={{ backgroundColor: clock ? '#22c55e' : '#ef4444' }}
                  className="w-16 h-2 rounded"
                />
              </div>
              {dataSignals.map((signal, index) => {
                const showPhaseLabel =
                  !!signal.timing &&
                  ((phase === 'sample' && signal.timing.sample !== undefined) ||
                    (phase === 'drive' && signal.timing.drive !== undefined));
                const tooltip = `${signal.direction} signal` +
                  (signal.restricted ? ' - modport restricted' : '') +
                  (signal.timing?.sample !== undefined ? ` - sample @${signal.timing.sample}` : '') +
                  (signal.timing?.drive !== undefined ? ` - drive @${signal.timing.drive}` : '') +
                  (signal.glitch ? ' - glitch' : '') +
                  (signal.delay ? ' - delay' : '');
                return (
                  <motion.div
                    key={`${signal.name}-${clock}-${arrayIndex}`}
                    initial={{ opacity: 0, x: signal.direction === 'out' ? 50 : -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center justify-between"
                    title={tooltip}
                  >
                    <span className="font-mono text-lg">
                      {signal.name}
                      {signal.restricted && (
                        <span className="text-red-500 text-xs ml-1">(restricted)</span>
                      )}
                    </span>
                    <div className="flex items-center">
                      {signal.timing ? (
                        showPhaseLabel && (
                          <motion.span
                            key={`${signal.name}-label-${phase}-${clock}`}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="text-sm mr-2"
                          >
                            {phase}
                          </motion.span>
                        )
                      ) : (
                        <motion.span
                          key={`${signal.name}-label-${clock}`}
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
                      )}
                      <div className="relative">
                        <motion.div
                          key={`${signalValues[index]}-${clock}`}
                          initial={{ width: 0 }}
                          animate={{ width: 64 }}
                          transition={{ duration: 0.5, delay: signal.delay ? 0.3 : 0 }}
                          className={`h-2 rounded ${
                            signal.direction === 'in'
                              ? 'bg-green-500'
                              : signal.direction === 'out'
                              ? 'bg-blue-500'
                              : 'bg-yellow-500'
                          }`}
                        />
                        {signal.glitch && (
                          <motion.div
                            key={`glitch-${clock}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 0.2, delay: 0.2 }}
                            className="absolute inset-0 bg-red-500 rounded"
                          />
                        )}
                        {signal.timing && showPhaseLabel && (
                          <motion.div
                            key={`${signal.name}-marker-${phase}-${clock}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            style={{
                              left: `${
                                (phase === 'sample'
                                  ? signal.timing.sample!
                                  : signal.timing.drive!) * 100
                              }%`,
                            }}
                            className="absolute -top-1 w-1 h-4 bg-black"
                          />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {currentExample.name === 'Virtual Interface Binding' && (
              <div className="flex items-center justify-center mt-4">
                <div className="p-2 border rounded mr-2">Driver</div>
                <div className="relative w-16 h-0.5 bg-blue-500 mx-2 overflow-hidden">
                  <motion.div
                    className="absolute top-0 left-0 h-full w-4 bg-blue-300"
                    animate={{ x: ['0%', '100%'] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                </div>
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
