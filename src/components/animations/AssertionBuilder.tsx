"use client";
import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { svaOperators, SvaOperator } from './sva-data';
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

const AssertionBuilder = () => {
  const [operators, setOperators] = useState(svaOperators);
  const [property, setProperty] = useState<SvaOperator[]>([]);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [simulation, setSimulation] = useState<{ operator: SvaOperator; status: 'pass' | 'fail' }[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setCode(property.map(op => op.symbol).join(' '));
  }, [property]);

  const runSimulation = () => {
    const results = property.map((op, idx) => ({
      operator: op,
      status: (op.type === 'temporal' && idx === property.length - 1 ? 'fail' : 'pass') as 'pass' | 'fail',
    }));
    setSimulation(results);
    setCurrentStep(0);
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, simulation.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      if (over.id === 'property-dropzone') {
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

                {simulation.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center space-x-2 mb-2">
                      {simulation.map((step, idx) => (
                        <div
                          key={idx}
                          className={`flex-1 text-center p-2 rounded text-white ${step.status === 'fail' ? 'bg-red-500' : 'bg-green-600'} ${idx === currentStep ? 'ring-2 ring-offset-2 ring-offset-background ring-yellow-400' : ''}`}
                        >
                          {step.operator.symbol}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between">
                      <Button onClick={prevStep} disabled={currentStep === 0}>Prev</Button>
                      <Button onClick={nextStep} disabled={currentStep === simulation.length - 1}>Next</Button>
                    </div>
                    <p className="mt-2 text-sm">
                      {simulation[currentStep].operator.description}
                      {simulation[currentStep].status === 'fail' && ' - Failed'}
                    </p>
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
