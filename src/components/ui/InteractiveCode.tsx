"use client";

import React, { useState, useMemo } from 'react';
import CodeBlock from './CodeBlock'; // Assuming CodeBlock is in the same directory
import { Button } from './Button';
import { ArrowLeft, ArrowRight } from 'lucide-react'; // Corrected import
import { motion, AnimatePresence } from 'framer-motion';

export interface ExplanationStep {
  // For line numbers, use a string like "5", "5-7", "5,7,10-12"
  // Or a specific keyword like "ALL" for the whole block initially.
  target: string;
  title?: string; // Optional title for the explanation step
  explanation: React.ReactNode;
}

interface InteractiveCodeProps {
  code: string;
  language?: string;
  fileName?: string;
  explanationSteps: ExplanationStep[];
  initialStep?: number;
}

// Helper to parse the target lines string (e.g., "1", "1-3", "1,3-5")
const parseTargetLines = (target: string): Set<number> => { // Removed totalLines
  const highlightedLines = new Set<number>();
  if (!target || target.toLowerCase() === 'all') {
    // If 'all' or empty, highlight nothing by default
    return highlightedLines;
  }

  const parts = target.split(',');
  parts.forEach(part => {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          highlightedLines.add(i);
        }
      }
    } else {
      const lineNumber = Number(part);
      if (!isNaN(lineNumber)) {
        highlightedLines.add(lineNumber);
      }
    }
  });
  return highlightedLines;
};

const InteractiveCode: React.FC<InteractiveCodeProps> = ({
  code,
  language = "plaintext",
  fileName,
  explanationSteps,
  initialStep = 0,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep);
  // const totalLines = useMemo(() => code.split('\n').length, [code]); // Removed

  const currentStep = explanationSteps[currentStepIndex];
  const highlightedLines = useMemo(
    () => currentStep ? parseTargetLines(currentStep.target) : new Set<number>(), // Removed totalLines
    [currentStep]
  );

  const handleNext = () => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, explanationSteps.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  React.useEffect(() => {
    const element = document.querySelector('[data-testid="interactive-code"]');
    if (element) {
      const styles = getComputedStyle(element);
      console.log('InteractiveCode background-color:', styles.backgroundColor);
    }
  }, []);

  

  return (
    <div data-testid="interactive-code" className="interactive-code my-6 p-4 border border-white/20 rounded-lg shadow-md bg-white/10 backdrop-blur-lg">
      <div className="code-section mb-4 relative bg-transparent">
        <CodeBlock
          code={code}
          language={language}
          fileName={fileName}
          showLineNumbers={true}
          lineProps={(lineNumber) => {
            const style: React.CSSProperties = { display: 'block', width: '100%' };
            if (highlightedLines.has(lineNumber)) {
              style.backgroundColor = 'hsla(var(--primary), 0.2)';
              style.borderLeft = '2px solid hsl(var(--primary))';
              style.paddingLeft = '10px';
              style.marginLeft = '-12px'; // Adjust to align with the border
            }
            return { style };
          }}
        />
      </div>

      <div className="explanation-section p-4 bg-white/10 dark:bg-black/10 rounded min-h-[100px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep?.title && <h4 className="font-semibold text-lg mb-2 text-primary">{currentStep.title}</h4>}
            <div className="text-sm text-foreground/90">{currentStep?.explanation || 'End of walkthrough.'}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="navigation-controls flex justify-between items-center mt-4">
        <Button onClick={handlePrevious} disabled={currentStepIndex === 0} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Step {currentStepIndex + 1} of {explanationSteps.length}
        </span>
        <Button onClick={handleNext} disabled={currentStepIndex === explanationSteps.length - 1} variant="outline">
          Next <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default InteractiveCode;
