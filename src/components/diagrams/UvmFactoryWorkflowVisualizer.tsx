"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uvmFactoryWorkflowData } from './uvm-factory-workflow-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const UvmFactoryWorkflowVisualizer = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const handleNext = () => {
    setCurrentStepIndex(prev => (prev < uvmFactoryWorkflowData.length - 1 ? prev + 1 : prev));
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const currentStep = uvmFactoryWorkflowData[currentStepIndex];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>UVM Factory Workflow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex overflow-x-auto pb-4 mb-4 space-x-2">
          {uvmFactoryWorkflowData.map((step, index) => (
            <Button
              key={step.name}
              variant={index === currentStepIndex ? 'default' : 'outline'}
              onClick={() => setCurrentStepIndex(index)}
              className="flex-shrink-0"
            >
              {step.name}
            </Button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="p-4 border rounded-lg bg-background/50"
          >
            <h3 className="text-lg font-bold text-primary">{currentStep.name}</h3>
            <p className="text-sm text-muted-foreground mb-2">Type: {currentStep.type}</p>
            <p>{currentStep.description}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-4">
          <Button onClick={handlePrev} disabled={currentStepIndex === 0}>Previous</Button>
          <Button onClick={handleNext} disabled={currentStepIndex === uvmFactoryWorkflowData.length - 1}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UvmFactoryWorkflowVisualizer;
