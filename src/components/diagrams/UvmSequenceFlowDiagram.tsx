"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uvmSequenceFlowData } from './uvm-sequence-flow-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const participants = [
  { id: 'Sequence', name: 'Sequence', x: 100 },
  { id: 'Sequencer', name: 'Sequencer', x: 300 },
  { id: 'Driver', name: 'Driver', x: 500 },
  { id: 'DUT', name: 'DUT', x: 700 },
];

const UvmSequenceFlowDiagram = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const handleNext = () => {
    setCurrentStepIndex(prev => (prev < uvmSequenceFlowData.length - 1 ? prev + 1 : prev));
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const currentStep = uvmSequenceFlowData[currentStepIndex];
  const lifelineHeight = 400;
  const messageSpacing = 40;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>UVM Sequence Execution Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <svg className="w-full h-auto" height={lifelineHeight + 100} viewBox={`0 0 800 ${lifelineHeight + 100}`}>
          {participants.map(p => (
            <g key={p.id}>
              <text x={p.x} y="30" textAnchor="middle" fontWeight="bold">{p.name}</text>
              <line x1={p.x} y1="50" x2={p.x} y2={lifelineHeight} stroke="#aaa" strokeDasharray="5,5" />
            </g>
          ))}

          <AnimatePresence>
            {uvmSequenceFlowData.slice(0, currentStepIndex + 1).map((step, index) => {
              const from = participants.find(p => p.id === step.source);
              const to = participants.find(p => p.id === step.target);
              if (!from || !to) return null;

              const yPos = 70 + index * messageSpacing;
              return (
                <motion.g
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <line
                    x1={from.x} y1={yPos}
                    x2={to.x} y2={yPos}
                    stroke="#3498db" strokeWidth="2"
                    markerEnd="url(#arrowhead-seq-flow)"
                  />
                  <text x={(from.x + to.x) / 2} y={yPos - 10} textAnchor="middle" fontSize="12">{step.name}</text>
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="p-4 border rounded-lg bg-background/50 mt-4"
          >
            <h3 className="text-lg font-bold text-primary">{currentStep.name}</h3>
            <p>{currentStep.description}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-4">
          <Button onClick={handlePrev} disabled={currentStepIndex === 0}>Previous</Button>
          <Button onClick={handleNext} disabled={currentStepIndex === uvmSequenceFlowData.length - 1}>Next</Button>
        </div>

        <defs>
          <marker id="arrowhead-seq-flow" markerWidth="10" markerHeight="7" refX="9.5" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3498db" />
          </marker>
        </defs>
      </CardContent>
    </Card>
  );
};

export default UvmSequenceFlowDiagram;
