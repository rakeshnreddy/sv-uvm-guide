"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uvmPhases, UvmPhase } from './uvm-phasing-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const UvmPhasingInteractiveTimeline = () => {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);

  const handleNext = () => {
    setCurrentPhaseIndex(prev => (prev < uvmPhases.length - 1 ? prev + 1 : prev));
  };

  const handlePrev = () => {
    setCurrentPhaseIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const currentPhase = uvmPhases[currentPhaseIndex];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>UVM Phasing Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex overflow-x-auto pb-4 mb-4 space-x-2">
          {uvmPhases.map((phase, index) => (
            <Button
              key={phase.name}
              variant={index === currentPhaseIndex ? 'default' : 'outline'}
              onClick={() => setCurrentPhaseIndex(index)}
              className="flex-shrink-0"
            >
              {phase.name}
            </Button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPhase.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="p-4 border rounded-lg bg-background/50"
          >
            <h3 className="text-lg font-bold text-primary">{currentPhase.name}</h3>
            <p className="text-sm text-muted-foreground mb-2">Type: {currentPhase.type} | {currentPhase.isTask ? 'Task' : 'Function'}</p>
            <p className="mb-2">{currentPhase.description}</p>
            {currentPhase.dependencies && (
              <p className="text-sm mb-1">Depends on: {currentPhase.dependencies.join(', ')}</p>
            )}
            {currentPhase.activities && (
              <ul className="list-disc list-inside text-sm mb-1">
                {currentPhase.activities.map((act, i) => (
                  <li key={i}>{act}</li>
                ))}
              </ul>
            )}

            {currentPhase.objection && (
              <p className="text-sm text-muted-foreground">Objections: {currentPhase.objection}</p>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-4">
          <Button onClick={handlePrev} disabled={currentPhaseIndex === 0}>Previous</Button>
          <Button onClick={handleNext} disabled={currentPhaseIndex === uvmPhases.length - 1}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UvmPhasingInteractiveTimeline;
