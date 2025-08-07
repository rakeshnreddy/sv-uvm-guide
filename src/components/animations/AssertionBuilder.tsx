"use client";
import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, useDraggable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { svaOperators, SvaOperator } from './sva-data';
import { assertionPatterns, AssertionPattern } from './assertion-patterns-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';

const SortableOperator = ({ id, operator }: { id: string; operator: SvaOperator }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-2 bg-muted rounded-lg m-1 cursor-grab">
      {operator.name} ({operator.symbol})
    </div>
  );
};

const DraggablePattern = ({ pattern }: { pattern: AssertionPattern }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `pattern-${pattern.id}`,
    data: { type: 'pattern', pattern },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-2 bg-accent rounded-lg m-1 cursor-grab">
      {pattern.name}
    </div>
  );
};

const sampleWaveforms: Record<string, number[]> = {
  req: [0, 1, 1, 0, 0],
  gnt: [0, 0, 1, 1, 0],
};

interface TimelineStep {
  cycle: number;
  signals: Record<string, number>;
  assertionStatus: 'pass' | 'fail' | 'untested';
}

interface SimulationResult {
  pass: boolean;
  failCycle?: number;
  coverage: number;
  trace: TimelineStep[];
}

const evaluateProperty = (code: string): SimulationResult => {
  const tokens = code.trim().split(/\s+/);
  const length = sampleWaveforms.req.length;
  const trace: TimelineStep[] = [];
  let pass = true;
  let failCycle: number | undefined;
  let triggered = 0;

  if (tokens.length === 4 && tokens[1] === '|->' && tokens[2].startsWith('##')) {
    const ante = tokens[0];
    const cons = tokens[3];
    const delay = parseInt(tokens[2].replace('##', '')) || 0;
    for (let i = 0; i < length; i++) {
      const signals: Record<string, number> = {};
      Object.keys(sampleWaveforms).forEach(sig => (signals[sig] = sampleWaveforms[sig][i]));
      let assertionStatus: 'pass' | 'fail' | 'untested' = 'untested';
      if (sampleWaveforms[ante] && sampleWaveforms[ante][i]) {
        triggered++;
        if (i + delay < length && sampleWaveforms[cons] && sampleWaveforms[cons][i + delay]) {
          assertionStatus = 'pass';
        } else {
          assertionStatus = 'fail';
          if (failCycle === undefined) {
            failCycle = i + delay;
          }
          pass = false;
        }
      }
      trace.push({ cycle: i, signals, assertionStatus });
    }
  } else {
    for (let i = 0; i < length; i++) {
      const signals: Record<string, number> = {};
      Object.keys(sampleWaveforms).forEach(sig => (signals[sig] = sampleWaveforms[sig][i]));
      trace.push({ cycle: i, signals, assertionStatus: 'untested' });
    }
  }
  const coverage = triggered / length;
  return { pass, failCycle, coverage, trace };
};

const tokenToOperator = (token: string): SvaOperator => {
  const existing = svaOperators.find(op => op.symbol === token);
  if (existing) return existing;
  return {
    id: `sig-${token}-${Math.random()}`,
    name: token,
    symbol: token,
    type: 'signal',
    description: `${token} signal`,
  };
};

const AssertionBuilder = () => {
  const [operators] = useState(svaOperators);
  const [property, setProperty] = useState<SvaOperator[]>([]);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);

  useEffect(() => {
    setCode(property.map(op => op.symbol).join(' '));
  }, [property]);

  const runSimulation = () => {
    const sim = evaluateProperty(code);
    setResult(sim);

  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      if (active.data.current?.type === 'pattern' && over.id === 'property-dropzone') {
        const pattern: AssertionPattern = active.data.current.pattern;
        const tokens = pattern.code.split(/\s+/).map(tokenToOperator);
        setProperty(prev => [...prev, ...tokens]);
      } else if (over.id === 'property-dropzone') {
        const activeOperator = operators.find(op => op.id === active.id);
        if (activeOperator) {
          setProperty(prev => [...prev, activeOperator]);
        }
      } else {
        setProperty(items => {
          const oldIndex = items.findIndex(item => item.id === active.id);
          const newIndex = items.findIndex(item => item.id === over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>SVA Property Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="col-span-1">
              <h3 className="font-semibold mb-2">Available Operators</h3>
              <div className="p-2 border rounded-lg bg-background/50 min-h-[200px]">
                <SortableContext items={operators.map(op => op.id)}>
                  {operators.map(op => <SortableOperator key={op.id} id={op.id} operator={op} />)}
                </SortableContext>
              </div>
              <h3 className="font-semibold mt-4 mb-2">Common Patterns</h3>
              <div className="p-2 border rounded-lg bg-background/50 min-h-[150px]">
                {assertionPatterns.map(pattern => (
                  <DraggablePattern key={pattern.id} pattern={pattern} />
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <h3 className="font-semibold mb-2">Property</h3>
              <div id="property-dropzone" className="p-2 border rounded-lg bg-muted min-h-[200px] flex flex-wrap items-start">
                <SortableContext items={property.map(op => op.id)}>
                  {property.map(op => <SortableOperator key={op.id} id={op.id} operator={op} />)}
                </SortableContext>
              </div>
              <div className="mt-4">
                <Editor
                  height="150px"
                  language="systemverilog"
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  value={code}
                  onChange={value => setCode(value ?? '')}
                />
                <Button className="mt-2" onClick={runSimulation} disabled={property.length === 0}>Simulate</Button>
                {result && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Simulation Timeline</h4>
                    {Object.keys(sampleWaveforms).map(sig => (
                      <div key={sig} className="flex items-center mb-1">
                        <span className="w-16 text-sm">{sig}</span>
                        <div className="flex">
                          {sampleWaveforms[sig].map((v, idx) => (
                            <div key={idx} className={`w-6 h-6 border ${v ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center mt-2">
                      <span className="w-16 text-sm">assert</span>
                      <div className="flex">
                        {result.trace.map((step, idx) => (
                          <div
                            key={idx}
                            className={`w-6 h-6 border ${
                              step.assertionStatus === 'pass'
                                ? 'bg-green-500'
                                : step.assertionStatus === 'fail'
                                ? 'bg-red-500'
                                : 'bg-gray-300'
                            }`}
                          ></div>
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-sm">
                      {result.pass ? 'Assertion passed' : `Assertion failed at cycle ${result.failCycle}`}
                    </p>
                    {!result.pass && result.failCycle !== undefined && (
                      <p className="text-sm">Counterexample at cycle {result.failCycle}</p>
                    )}
                    <p className="text-sm">Coverage: {(result.coverage * 100).toFixed(0)}%</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </DndContext>
  );
};

export default AssertionBuilder;
