"use client";
import React, { useState, useRef, useEffect } from 'react';
import { DndContext } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import * as d3 from 'd3';
import { stateMachineData, State, Transition } from './state-machine-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';

const DraggableState = ({
  id,
  state,
  onRemove,
}: {
  id: string;
  state: State;
  onRemove: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, position: 'absolute', left: state.x, top: state.y }}
      {...listeners}
      {...attributes}
    >
      <div className="relative w-24 h-16 bg-primary text-primary-foreground rounded-lg flex items-center justify-center cursor-grab">
        {state.name}
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={() => onRemove(id)}
        >
          ×
        </button>
      </div>
    </div>
  );
};

const StateMachineDesigner = () => {
  const [states, setStates] = useState<State[]>(stateMachineData[0].states);
  const [transitions, setTransitions] = useState<Transition[]>(stateMachineData[0].transitions);
  const [mode, setMode] = useState<'Moore' | 'Mealy'>('Moore');
  const [encoding, setEncoding] = useState('binary');
  const [reset, setReset] = useState('synchronous');
  const [timing, setTiming] = useState('edge');
  const [newTransition, setNewTransition] = useState<{ source: string; target: string }>({
    source: '',
    target: '',
  });
  const stateCounter = useRef(states.length + 1);
  const svgRef = useRef<SVGSVGElement>(null);

  const addState = () => {
    const id = `s${stateCounter.current++}`;
    const name = `STATE_${stateCounter.current}`;
    setStates((s) => [...s, { id, name, x: 50, y: 50 }]);
  };

  const removeState = (id: string) => {
    setStates((s) => s.filter((st) => st.id !== id));
    setTransitions((t) => t.filter((tr) => tr.source !== id && tr.target !== id));
  };

  const addTransition = () => {
    if (newTransition.source && newTransition.target) {
      setTransitions((t) => [...t, { ...newTransition }]);
      setNewTransition({ source: '', target: '' });
    }
  };

  const removeTransition = (index: number) => {
    setTransitions((t) => t.filter((_, i) => i !== index));
  };

  const toggleMode = () => setMode((m) => (m === 'Moore' ? 'Mealy' : 'Moore'));

  const handleDragEnd = (event: any) => {
    const { active, delta } = event;
    setStates((states) =>
      states.map((s) => (s.id === active.id ? { ...s, x: s.x + delta.x, y: s.y + delta.y } : s))
    );
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const lineGenerator = d3
      .line<{ x: number; y: number }>()
      .x((d) => d.x)
      .y((d) => d.y);

    svg
      .selectAll('path')
      .data(transitions)
      .enter()
      .append('path')
      .attr('d', (d) => {
        const sourceState = states.find((s) => s.id === d.source);
        const targetState = states.find((s) => s.id === d.target);
        if (!sourceState || !targetState) return '';
        return lineGenerator([
          { x: sourceState.x + 48, y: sourceState.y + 32 },
          { x: targetState.x + 48, y: targetState.y + 32 },
        ]);
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
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <Button onClick={addState}>Add State</Button>
              <Button variant="outline" onClick={toggleMode}>
                Mode: {mode}
              </Button>
              <div className="flex flex-col">
                <Label>State Encoding</Label>
                <Select value={encoding} onValueChange={setEncoding}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="binary">Binary</SelectItem>
                    <SelectItem value="onehot">One-Hot</SelectItem>
                    <SelectItem value="gray">Gray</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col">
                <Label>Reset</Label>
                <Select value={reset} onValueChange={setReset}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="synchronous">Synchronous</SelectItem>
                    <SelectItem value="asynchronous">Asynchronous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col">
                <Label>Timing</Label>
                <Select value={timing} onValueChange={setTiming}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="edge">Edge-Triggered</SelectItem>
                    <SelectItem value="level">Level-Sensitive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex flex-col">
                <Label htmlFor="source-select">Source</Label>
                <select
                  id="source-select"
                  className="border rounded px-2 py-1"
                  value={newTransition.source}
                  onChange={(e) =>
                    setNewTransition((t) => ({ ...t, source: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <Label htmlFor="target-select">Target</Label>
                <select
                  id="target-select"
                  className="border rounded px-2 py-1"
                  value={newTransition.target}
                  onChange={(e) =>
                    setNewTransition((t) => ({ ...t, target: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={addTransition}>Add Transition</Button>
            </div>

            {transitions.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label>Transitions</Label>
                {transitions.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>
                      {states.find((s) => s.id === t.source)?.name} →{' '}
                      {states.find((s) => s.id === t.target)?.name}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeTransition(i)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-sm">
              <p>Coverage Metrics:</p>
              <p>States: {states.length}</p>
              <p>Transitions: {transitions.length}</p>
            </div>

            <div className="relative w-full h-96 bg-muted rounded-lg">
              {states.map((state) => (
                <DraggableState
                  key={state.id}
                  id={state.id}
                  state={state}
                  onRemove={removeState}
                />
              ))}
              <svg
                ref={svgRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </DndContext>
  );
};

export default StateMachineDesigner;
