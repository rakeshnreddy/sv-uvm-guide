"use client";
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  sequenceLibrary,
  SequenceDefinition,
  SequenceFlowStep,
} from './uvm-sequence-flow-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface Participant {
  id: string;
  name: string;
  x: number;
}

const DraggableSequence = ({ seq }: { seq: SequenceDefinition }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: seq.id });
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-2 mb-2 rounded bg-secondary text-secondary-foreground cursor-grab"
    >
      {seq.name}
    </div>
  );
};

const UvmSequenceFlowDiagram = () => {
  const [currentSequence, setCurrentSequence] = useState<SequenceDefinition>(
    sequenceLibrary[0]
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const sensors = useSensors(useSensor(PointerSensor));
  const { setNodeRef: setDropRef } = useDroppable({ id: 'diagram-drop' });

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over?.id === 'diagram-drop') {
      const seq = sequenceLibrary.find((s) => s.id === active.id);
      if (seq) {
        setCurrentSequence(seq);
        setCurrentStepIndex(0);
      }
    }
  };

  const handleNext = () => {
    setCurrentStepIndex((prev) =>
      prev < currentSequence.steps.length - 1 ? prev + 1 : prev
    );
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const lifelineHeight = 400;
  const messageSpacing = 40;

  const participants: Participant[] = useMemo(() => {
    const names = Array.from(
      new Set(
        currentSequence.steps.flatMap((s) => [s.source, s.target])
      )
    );
    const spacing = 150;
    return names.map((name, idx) => ({
      id: name,
      name,
      x: 100 + idx * spacing,
    }));
  }, [currentSequence]);

  const width = 200 + (participants.length - 1) * 150;
  const currentStep: SequenceFlowStep = currentSequence.steps[currentStepIndex];

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex">
        <div className="w-56 p-4 border-r">
          <h3 className="font-bold mb-2">Sequence Library</h3>
          {sequenceLibrary.map((seq) => (
            <DraggableSequence key={seq.id} seq={seq} />
          ))}
          <p className="text-xs text-muted-foreground mt-2">
            Drag a sequence onto the diagram to run
          </p>
        </div>

        <div className="flex-1 p-4" ref={setDropRef}>
          <Card className="w-full">
            <CardHeader>
              <CardTitle>
                {currentSequence.name} – UVM Sequence Execution Flow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <svg
                className="w-full h-auto"
                height={lifelineHeight + 100}
                viewBox={`0 0 ${width} ${lifelineHeight + 100}`}
              >
                {participants.map((p) => (
                  <g key={p.id}>
                    <text
                      x={p.x}
                      y="30"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {p.name}
                    </text>
                    <line
                      x1={p.x}
                      y1="50"
                      x2={p.x}
                      y2={lifelineHeight}
                      stroke="#aaa"
                      strokeDasharray="5,5"
                    />
                  </g>
                ))}

                <AnimatePresence>
                  {currentSequence.steps
                    .slice(0, currentStepIndex + 1)
                    .map((step, index) => {
                      const from = participants.find(
                        (p) => p.id === step.source
                      );
                      const to = participants.find((p) => p.id === step.target);
                      if (!from || !to) return null;

                      const yPos = 70 + index * messageSpacing;
                      const elements = [] as React.ReactNode[];

                      elements.push(
                        <line
                          key={`line-${index}`}
                          x1={from.x}
                          y1={yPos}
                          x2={to.x}
                          y2={yPos}
                          stroke="#3498db"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead-seq-flow)"
                        />
                      );

                      elements.push(
                        <text
                          key={`text-${index}`}
                          x={(from.x + to.x) / 2}
                          y={yPos - 10}
                          textAnchor="middle"
                          fontSize="12"
                        >
                          {step.name}
                        </text>
                      );

                      if (step.ackFor) {
                        const reqIndex = currentSequence.steps.findIndex(
                          (s) => s.name === step.ackFor
                        );
                        if (reqIndex >= 0) {
                          const yReq = 70 + reqIndex * messageSpacing;
                          const ackParticipant = participants.find(
                            (p) => p.id === step.target
                          );
                          if (ackParticipant) {
                            elements.push(
                              <line
                                key={`timing-${index}`}
                                x1={ackParticipant.x + 20}
                                y1={yReq}
                                x2={ackParticipant.x + 20}
                                y2={yPos}
                                stroke="#e74c3c"
                                strokeDasharray="4,2"
                                markerEnd="url(#arrowhead-timing)"
                              />
                            );
                          }
                        }
                      }

                      return (
                        <motion.g
                          key={index}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          {elements}
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
                  <h3 className="text-lg font-bold text-primary">
                    {currentStep.name}
                  </h3>
                  <p>{currentStep.description}</p>
                </motion.div>
              </AnimatePresence>

              <div className="flex justify-between mt-4">
                <Button onClick={handlePrev} disabled={currentStepIndex === 0}>
                  Previous
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={
                    currentStepIndex === currentSequence.steps.length - 1
                  }
                >
                  Next
                </Button>
              </div>

              <defs>
                <marker
                  id="arrowhead-seq-flow"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9.5"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#3498db" />
                </marker>
                <marker
                  id="arrowhead-timing"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 6 3, 0 6" fill="#e74c3c" />
                </marker>
              </defs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DndContext>
  );
};

export default UvmSequenceFlowDiagram;

