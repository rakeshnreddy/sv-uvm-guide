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
  onClick,
  selected,
  encodingValue,
}: {
  id: string;
  state: State;
  onRemove: (id: string) => void;
  onClick: (id: string) => void;
  selected: boolean;
  encodingValue: string;
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
      onClick={() => onClick(id)}
    >
      <div
        className={`relative w-24 h-16 rounded-lg flex items-center justify-center cursor-grab bg-primary text-primary-foreground ${selected ? 'ring-2 ring-secondary' : ''}`}
      >
        <div className="flex flex-col items-center">
          <span>{state.name}</span>
          <span className="text-xs">{encodingValue}</span>
        </div>
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
  const [pendingTransition, setPendingTransition] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{
    unreachable: string[];
    dead: Transition[];
  }>({ unreachable: [], dead: [] });
  const [currentState, setCurrentState] = useState<string | null>(
    stateMachineData[0].states[0]?.id || null
  );
  const [visitedStates, setVisitedStates] = useState<Set<string>>(new Set());
  const [visitedTransitions, setVisitedTransitions] = useState<Set<number>>(new Set());
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

  const handleStateClick = (id: string) => {
    setPendingTransition((prev) => {
      if (!prev) return id;
      if (prev !== id) {
        setTransitions((t) => [...t, { source: prev, target: id }]);
      }
      return null;
    });
  };

  const encodeState = (index: number) => {
    if (encoding === 'onehot') {
      return states.map((_, i) => (i === index ? '1' : '0')).join('');
    }
    const width = Math.max(1, Math.ceil(Math.log2(states.length)));
    let value = index;
    if (encoding === 'gray') {
      value = index ^ (index >> 1);
    }
    return value.toString(2).padStart(width, '0');
  };

  const runStep = () => {
    if (!currentState) return;
    setVisitedStates((s) => new Set(s).add(currentState));
    const options = transitions
      .map((t, i) => ({ ...t, i }))
      .filter((t) => t.source === currentState);
    if (options.length === 0) return;
    const choice = options[Math.floor(Math.random() * options.length)];
    setVisitedTransitions((s) => new Set(s).add(choice.i));
    setCurrentState(choice.target);
  };

  const resetSimulation = React.useCallback(() => {
    setVisitedStates(new Set());
    setVisitedTransitions(new Set());
    setCurrentState(states[0]?.id || null);
  }, [states]);

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
      .data(transitions.map((t, i) => ({ ...t, i })))
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
      .attr('fill', 'none')
      .style('cursor', 'pointer')
      .on('click', (_, d) => removeTransition(d.i));
  }, [states, transitions]);

  useEffect(() => {
    // analysis for unreachable states and dead transitions
    const reachable = new Set<string>();
    const start = states[0]?.id;
    if (start) {
      const stack = [start];
      while (stack.length) {
        const id = stack.pop();
        if (!id || reachable.has(id)) continue;
        reachable.add(id);
        transitions
          .filter((t) => t.source === id)
          .forEach((t) => stack.push(t.target));
      }
    }
    const unreachable = states
      .filter((s) => !reachable.has(s.id))
      .map((s) => s.name);
    const dead = transitions.filter((t) => !reachable.has(t.source));
    setAnalysis({ unreachable, dead });
  }, [states, transitions]);

  useEffect(() => {
    resetSimulation();
  }, [states, transitions, resetSimulation]);

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
              <p>
                States: {visitedStates.size}/{states.length}
              </p>
              <p>
                Transitions: {visitedTransitions.size}/{transitions.length}
              </p>
            </div>

            {(analysis.unreachable.length > 0 || analysis.dead.length > 0) && (
              <div className="text-sm text-yellow-700">
                {analysis.unreachable.length > 0 && (
                  <p>
                    Unreachable states: {analysis.unreachable.join(', ')}
                  </p>
                )}
                {analysis.dead.length > 0 && (
                  <p>
                    Dead transitions:{' '}
                    {analysis.dead
                      .map(
                        (t) =>
                          `${states.find((s) => s.id === t.source)?.name}→${
                            states.find((s) => s.id === t.target)?.name
                          }`
                      )
                      .join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={runStep}>Step Simulation</Button>
              <Button variant="outline" onClick={resetSimulation}>
                Reset Simulation
              </Button>
            </div>

            <div className="relative w-full h-96 bg-muted rounded-lg">
              {states.map((state, idx) => (
                <DraggableState
                  key={state.id}
                  id={state.id}
                  state={state}
                  onRemove={removeState}
                  onClick={handleStateClick}
                  selected={pendingTransition === state.id}
                  encodingValue={encodeState(idx)}
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
