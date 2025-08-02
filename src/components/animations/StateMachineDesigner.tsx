"use client";
import React, { useState, useRef, useEffect } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import * as d3 from 'd3';
import { stateMachineData, State, Transition } from './state-machine-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const DraggableState = ({ id, state, onDrop }: { id: string; state: State; onDrop: (id: string, delta: { x: number; y: number }) => void }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : {};

  return (
    <div ref={setNodeRef} style={{ ...style, position: 'absolute', left: state.x, top: state.y }} {...listeners} {...attributes}>
      <div className="w-24 h-16 bg-primary text-primary-foreground rounded-lg flex items-center justify-center cursor-grab">
        {state.name}
      </div>
    </div>
  );
};

const StateMachineDesigner = () => {
  const [states, setStates] = useState<State[]>(stateMachineData[0].states);
  const [transitions, setTransitions] = useState<Transition[]>(stateMachineData[0].transitions);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleDragEnd = (event: any) => {
    const { active, delta } = event;
    setStates(states => states.map(s => s.id === active.id ? { ...s, x: s.x + delta.x, y: s.y + delta.y } : s));
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const lineGenerator = d3.line<{x:number, y:number}>().x(d => d.x).y(d => d.y);

    svg.selectAll('path')
      .data(transitions)
      .enter()
      .append('path')
      .attr('d', d => {
        const sourceState = states.find(s => s.id === d.source);
        const targetState = states.find(s => s.id === d.target);
        if (!sourceState || !targetState) return '';
        return lineGenerator([{x: sourceState.x + 48, y: sourceState.y + 32}, {x: targetState.x + 48, y: targetState.y + 32}]);
      })
      .attr('stroke', 'hsl(var(--primary))')
      .attr('stroke-width', 2)
      .attr('fill', 'none');

  }, [states, transitions]);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>State Machine Designer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full h-96 bg-muted rounded-lg">
            {states.map(state => (
              <DraggableState key={state.id} id={state.id} state={state} onDrop={() => {}} />
            ))}
            <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
          </div>
        </CardContent>
      </Card>
    </DndContext>
  );
};

export default StateMachineDesigner;
