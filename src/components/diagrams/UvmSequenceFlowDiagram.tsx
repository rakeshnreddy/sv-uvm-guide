"use client";
import React, { useState, useMemo, useRef } from 'react';
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
  const svgRef = useRef<SVGSVGElement>(null);

  const sequenceState =
    currentStepIndex === 0
      ? 'WAIT'
      : currentStepIndex < currentSequence.steps.length - 1
      ? 'RUN'
      : 'DONE';
  const stateColor: Record<string, string> = {
    WAIT: '#bdc3c7',
    RUN: '#f1c40f',
    DONE: '#2ecc71',
  };

  const ackMap = useMemo(() => {
    const map = new Map<string, number>();
    currentSequence.steps.forEach((s, idx) => {
      if (s.ackFor) {
        map.set(s.ackFor, idx);
      }
    });
    return map;
  }, [currentSequence]);

  const hasVirtual = useMemo(
    () =>
      currentSequence.steps.some(
        (s) =>
          s.source.toLowerCase().includes('virtual') ||
          s.target.toLowerCase().includes('virtual')
      ),
    [currentSequence]
  );

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

  const handleExport = () => {
    if (svgRef.current) {
      const data = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentSequence.id}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
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

  const getLayerColor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('virtual')) return 'rgba(52,152,219,0.1)';
    if (lower.includes('sequence')) return 'rgba(155,89,182,0.1)';
    if (lower.includes('sequencer')) return 'rgba(46,204,113,0.1)';
    if (lower.includes('driver')) return 'rgba(241,196,15,0.1)';
    if (lower.includes('dut')) return 'rgba(231,76,60,0.1)';
    return 'rgba(189,195,199,0.1)';
  };

  const width = 200 + (participants.length - 1) * 150;
  const currentStep: SequenceFlowStep = currentSequence.steps[currentStepIndex];
  const arbitrationLog = useMemo(
    () =>
      currentSequence.steps
        .slice(0, currentStepIndex + 1)
        .filter((s) => s.name.startsWith('grant'))
        .map((s) => s.name),
    [currentSequence, currentStepIndex]
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex">
        <div className="w-56 p-4 border-r">
          <h3 className="font-bold mb-2">Sequence Library</h3>
          <select
            value={currentSequence.id}
            onChange={(e) => {
              const seq = sequenceLibrary.find((s) => s.id === e.target.value);
              if (seq) {
                setCurrentSequence(seq);
                setCurrentStepIndex(0);
              }
            }}
            className="w-full mb-4 p-2 border rounded"
          >
            {sequenceLibrary.map((seq) => (
              <option key={seq.id} value={seq.id}>
                {seq.name}
              </option>
            ))}
          </select>
          {sequenceLibrary.map((seq) => (
            <DraggableSequence key={seq.id} seq={seq} />
          ))}
          <p className="text-xs text-muted-foreground mt-2">
            Drag a sequence onto the diagram to run
          </p>
        </div>

        <div className="flex-1 p-4 overflow-x-auto" ref={setDropRef}>
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentSequence.name} – UVM Sequence Execution Flow
                <span className="flex items-center gap-1 text-sm">
                  <svg width="16" height="16">
                    <circle cx="8" cy="8" r="8" fill={stateColor[sequenceState]} />
                  </svg>
                  {sequenceState}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex">
                <svg
                  ref={svgRef}
                  className="w-full h-auto"
                  height={lifelineHeight + 100}
                  viewBox={`0 0 ${width} ${lifelineHeight + 100}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {hasVirtual && (
                    <rect
                      x="0"
                      y="0"
                      width={width}
                      height="60"
                      fill="rgba(52,152,219,0.08)"
                    />
                  )}
                  {participants.map((p) => (
                    <g key={p.id}>
                      <rect
                        x={p.x - 75}
                        y={50}
                        width={150}
                        height={lifelineHeight}
                        fill={getLayerColor(p.name)}
                      />
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
                        const to = participants.find(
                          (p) => p.id === step.target
                        );
                        if (!from || !to) return null;

                        const yPos = 70 + index * messageSpacing;
                        const elements = [] as React.ReactNode[];

                        if (step.name.toLowerCase().includes('barrier')) {
                          elements.push(
                            <line
                              key={`barrier-${index}`}
                              x1={0}
                              y1={yPos}
                              x2={width}
                              y2={yPos}
                              stroke="#e67e22"
                              strokeDasharray="8,4"
                            />,
                            <text
                              key={`barrier-text-${index}`}
                              x={width - 4}
                              y={yPos - 4}
                              textAnchor="end"
                              fontSize="10"
                              fill="#e67e22"
                            >
                              barrier
                            </text>
                          );
                        }

                        const color = step.ackFor
                          ? '#2ecc71'
                          : step.source === 'DUT' || step.target === 'DUT'
                          ? '#9b59b6'
                          : '#3498db';

                        const reqIndex = step.ackFor
                          ? currentSequence.steps.findIndex(
                              (s) => s.name === step.ackFor
                            )
                          : -1;
                        const hasMismatch =
                          step.ackFor && (reqIndex === -1 || reqIndex > index);
                        const isStalled =
                          !step.ackFor &&
                          !ackMap.has(step.name) &&
                          step.name.toLowerCase().includes('request');

                        if (hasMismatch || isStalled) {
                          elements.push(
                            <rect
                              key={`debug-${index}`}
                              x={Math.min(from.x, to.x) - 40}
                              y={yPos - 20}
                              width={Math.abs(to.x - from.x) + 80}
                              height={30}
                              fill="rgba(231,76,60,0.2)"
                            />
                          );
                        }

                        elements.push(
                          <motion.line
                            key={`line-${index}`}
                            x1={from.x}
                            y1={yPos}
                            x2={to.x}
                            y2={yPos}
                            stroke={color}
                            strokeWidth="2"
                            markerEnd="url(#arrowhead-seq-flow)"
                            initial={{ x2: from.x }}
                            animate={{ x2: to.x }}
                            transition={{ duration: 0.6 }}
                          />
                        );

                        elements.push(
                          <motion.circle
                            key={`dot-${index}`}
                            cx={from.x}
                            cy={yPos}
                            r="4"
                            fill={color}
                            initial={{ cx: from.x }}
                            animate={{ cx: to.x }}
                            transition={{ duration: 0.6 }}
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

                        if (step.ackFor && reqIndex >= 0) {
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

                        return (
                          <motion.g
                            key={index}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <title>{step.description}</title>
                            {elements}
                          </motion.g>
                        );
                      })}
                  </AnimatePresence>
                </svg>
                {hasVirtual && (
                  <div className="ml-4 w-48 p-2 border rounded bg-muted/50">
                    <h4 className="font-bold mb-2">Arbitration Panel</h4>
                    <ul className="text-sm list-disc pl-4">
                      {arbitrationLog.map((a, i) => (
                        <li key={i}>{a.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
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
                <div className="flex gap-2">
                  <Button onClick={handleExport}>Export SVG</Button>
                  <Button
                    onClick={handleNext}
                    disabled={
                      currentStepIndex === currentSequence.steps.length - 1
                    }
                  >
                    Next
                  </Button>
                </div>
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

