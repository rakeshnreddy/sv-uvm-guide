"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uvmPhases, UvmPhase } from './uvm-phasing-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const UvmPhasingInteractiveTimeline = () => {
  const [phases, setPhases] = useState<UvmPhase[]>(uvmPhases);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [newPhase, setNewPhase] = useState({ name: '', start: '', end: '', dependencies: '' });

  const totalTime = Math.max(...phases.map(p => p.timing.end));

  const handleNext = () => {
    setCurrentPhaseIndex(prev => (prev < phases.length - 1 ? prev + 1 : prev));
  };

  const handlePrev = () => {
    setCurrentPhaseIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleAddPhase = () => {
    const start = Number(newPhase.start);
    const end = Number(newPhase.end);
    if (!newPhase.name || isNaN(start) || isNaN(end)) return;

    const phase: UvmPhase = {
      name: newPhase.name,
      type: 'run',
      description: 'Custom phase',
      isTask: true,
      dependencies: newPhase.dependencies
        ? newPhase.dependencies.split(',').map(d => d.trim()).filter(Boolean)
        : undefined,
      timing: { start, end },
    };

    setPhases(prev => [...prev, phase]);
    setCurrentPhaseIndex(phases.length);
    setNewPhase({ name: '', start: '', end: '', dependencies: '' });
  };

  const currentPhase = phases[currentPhaseIndex];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>UVM Phasing Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <svg viewBox="0 0 100 40" className="w-full h-32">
            <defs>
              <marker id="arrow" markerWidth="4" markerHeight="4" refX="4" refY="2" orient="auto">
                <path d="M0,0 L4,2 L0,4 Z" fill="currentColor" />
              </marker>
            </defs>
            {phases.map((phase, idx) => {
              const x = (phase.timing.start / totalTime) * 100;
              const width = ((phase.timing.end - phase.timing.start) / totalTime) * 100;
              const y = 20;
              const barHeight = 6;
              return (
                <g key={phase.name} onClick={() => setCurrentPhaseIndex(idx)} className="cursor-pointer">
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={barHeight}
                    fill="hsl(var(--primary))"
                    fillOpacity={idx === currentPhaseIndex ? 0.8 : 0.4}
                  />
                  <text x={x + width / 2} y={y - 2} textAnchor="middle" fontSize="3">
                    {phase.name}
                  </text>
                  {phase.objectionTriggers?.raise !== undefined && (
                    <circle
                      cx={(phase.objectionTriggers.raise / totalTime) * 100}
                      cy={y + barHeight + 3}
                      r={1}
                      fill="red"
                    />
                  )}
                  {phase.objectionTriggers?.drop !== undefined && (
                    <circle
                      cx={(phase.objectionTriggers.drop / totalTime) * 100}
                      cy={y + barHeight + 3}
                      r={1}
                      fill="green"
                    />
                  )}
                </g>
              );
            })}
            {phases.map(phase =>
              phase.dependencies?.map(dep => {
                const depPhase = phases.find(p => p.name === dep);
                if (!depPhase) return null;
                const x1 = (depPhase.timing.end / totalTime) * 100;
                const x2 = (phase.timing.start / totalTime) * 100;
                const y = 23;
                return (
                  <line
                    key={`${dep}-${phase.name}`}
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth={0.5}
                    markerEnd="url(#arrow)"
                  />
                );
              })
            )}
          </svg>
        </div>

        <div className="flex overflow-x-auto pb-4 mb-4 space-x-2">
          {phases.map((phase, index) => (
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
            <p className="text-sm mb-1">Timing: {currentPhase.timing.start} - {currentPhase.timing.end}</p>
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
            {currentPhase.objectionTriggers && (
              <p className="text-sm text-muted-foreground">
                Objection Triggers:
                {currentPhase.objectionTriggers.raise !== undefined && ` raise@${currentPhase.objectionTriggers.raise}`}
                {currentPhase.objectionTriggers.drop !== undefined && ` drop@${currentPhase.objectionTriggers.drop}`}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-4">
          <Button onClick={handlePrev} disabled={currentPhaseIndex === 0}>Previous</Button>
          <Button onClick={handleNext} disabled={currentPhaseIndex === phases.length - 1}>Next</Button>
        </div>

        <div className="mt-4">
          <h4 className="font-semibold mb-2">Add Custom Phase</h4>
          <div className="flex flex-wrap gap-2 mb-2">
            <Input
              placeholder="Name"
              value={newPhase.name}
              onChange={e => setNewPhase({ ...newPhase, name: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Start"
              value={newPhase.start}
              onChange={e => setNewPhase({ ...newPhase, start: e.target.value })}
            />
            <Input
              type="number"
              placeholder="End"
              value={newPhase.end}
              onChange={e => setNewPhase({ ...newPhase, end: e.target.value })}
            />
            <Input
              placeholder="Deps"
              value={newPhase.dependencies}
              onChange={e => setNewPhase({ ...newPhase, dependencies: e.target.value })}
            />
            <Button onClick={handleAddPhase}>Add</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UvmPhasingInteractiveTimeline;
