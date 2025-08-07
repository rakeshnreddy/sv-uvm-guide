"use client";
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uvmPhases, UvmPhase, addUvmPhase } from './uvm-phasing-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ArrowUpCircle, ArrowDownCircle, Download, Share2 } from 'lucide-react';

const UvmPhasingInteractiveTimeline = () => {
  const [phases, setPhases] = useState<UvmPhase[]>(uvmPhases);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [newPhase, setNewPhase] = useState({ name: '', start: '', end: '', dependencies: '' });
  const [showModal, setShowModal] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  const totalTime = Math.max(...phases.map(p => p.timing.end));

  const handleNext = React.useCallback(() => {
    setCurrentPhaseIndex(prev => (prev < phases.length - 1 ? prev + 1 : prev));
  }, [phases.length]);

  const handlePrev = React.useCallback(() => {
    setCurrentPhaseIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

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

    addUvmPhase(phase);
    setPhases(prev => [...prev, phase]);
    setCurrentPhaseIndex(phases.length);
    setNewPhase({ name: '', start: '', end: '', dependencies: '' });
    setShowModal(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (/^[0-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < phases.length) setCurrentPhaseIndex(idx);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phases.length, handleNext, handlePrev]);

  const handleExportImage = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = 'uvm-timeline.svg';
    link.click();
  };

  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* empty */
    }
  };

  const currentPhase = phases[currentPhaseIndex];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>UVM Phasing Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <svg ref={svgRef} id="uvm-timeline-svg" viewBox="0 0 100 40" className="w-full h-32">
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
                    <g
                      transform={`translate(${(phase.objectionTriggers.raise / totalTime) * 100}, ${y + barHeight + 1})`}
                    >
                      <ArrowUpCircle width={3} height={3} color="red" />
                    </g>
                  )}
                  {phase.objectionTriggers?.drop !== undefined && (
                    <g
                      transform={`translate(${(phase.objectionTriggers.drop / totalTime) * 100}, ${y + barHeight + 1})`}
                    >
                      <ArrowDownCircle width={3} height={3} color="green" />
                    </g>
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
            <motion.g
              initial={{ x: 0 }}
              animate={{ x: 100 }}
              transition={{ duration: totalTime / 10, repeat: Infinity, ease: 'linear' }}
            >
              <line x1={0} y1={15} x2={0} y2={32} stroke="hsl(var(--primary))" strokeWidth={0.5} />
              <circle cx={0} cy={15} r={1.2} fill="hsl(var(--primary))" />
            </motion.g>
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

        <div className="flex justify-between mt-4 flex-wrap gap-2">
          <div className="flex gap-2">
            <Button onClick={handlePrev} disabled={currentPhaseIndex === 0}>Previous</Button>
            <Button onClick={handleNext} disabled={currentPhaseIndex === phases.length - 1}>Next</Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportImage}>
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
            <Button variant="outline" onClick={handleShareLink}>
              <Share2 className="w-4 h-4 mr-1" /> Share
            </Button>
            <Button variant="outline" onClick={() => setShowModal(true)}>
              Add Phase
            </Button>
          </div>
        </div>
      </CardContent>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-background p-4 rounded-lg w-80"
            >
              <h4 className="font-semibold mb-2">Add Custom Phase</h4>
              <div className="flex flex-col gap-2 mb-4">
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
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddPhase}>Add</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export default UvmPhasingInteractiveTimeline;
