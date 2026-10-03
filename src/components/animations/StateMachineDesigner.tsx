"use client";
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { DndContext, useDraggable, type DragEndEvent } from '@dnd-kit/core';
import { stateMachineData, State, Transition } from './state-machine-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import {
  ENCODING_HINTS,
  analyzeReachability,
  edgeBetween,
  encodeState,
  encodingWidth,
  resetWalk,
  stepWalk,
  type FsmEncoding,
  type WalkState,
} from '@/lib/fsm-designer-model';

export type VerificationHook = (
  states: State[],
  transitions: Transition[],
  current: string | null
) => void;

const verificationHooks: VerificationHook[] = [];

export const registerVerificationHook = (hook: VerificationHook) => {
  verificationHooks.push(hook);
};

const BOX = { w: 96, h: 64 };

const DraggableState = ({
  id,
  state,
  onRemove,
  onClick,
  selected,
  current,
  visited,
  encodingValue,
}: {
  id: string;
  state: State;
  onRemove: (id: string) => void;
  onClick: (id: string) => void;
  selected: boolean;
  current: boolean;
  visited: boolean;
  encodingValue: string;
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {};

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, position: 'absolute', left: state.x, top: state.y }}
      {...listeners}
      {...attributes}
      onClick={() => onClick(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(id);
        }
      }}
      tabIndex={0}
      aria-label={`State ${state.name} encoded as ${encodingValue}${current ? ', current state' : ''}${visited ? ', visited' : ''}${selected ? ', transition source selected' : ''}`}
    >
      <div
        className={`relative flex h-16 w-24 cursor-grab items-center justify-center rounded-lg bg-primary text-primary-foreground ${selected ? 'ring-2 ring-amber-400' : ''} ${current ? 'outline outline-2 outline-offset-2 outline-cyan-500' : ''}`}
      >
        <div className="flex flex-col items-center">
          <span>
            {current ? <span aria-hidden>▶ </span> : null}
            {state.name}
          </span>
          <span className="font-mono text-xs [font-variant-ligatures:none]">{encodingValue}</span>
          {visited ? <span className="text-[10px]" aria-hidden>✓ visited</span> : null}
        </div>
        <button
          type="button"
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          aria-label={`Remove ${state.name}`}
        >
          ×
        </button>
      </div>
    </div>
  );
};

const RESET_CODE: Record<string, string> = {
  synchronous: 'always_ff @(posedge clk)              if (!rst_n) state <= RESET;',
  asynchronous: 'always_ff @(posedge clk or negedge rst_n) if (!rst_n) state <= RESET;',
};

const StateMachineDesigner = () => {
  const markerId = useId();
  const [states, setStates] = useState<State[]>(stateMachineData[0].states);
  const [transitions, setTransitions] = useState<Transition[]>(stateMachineData[0].transitions);
  const [pattern, setPattern] = useState(stateMachineData[0].name);
  const [mode, setMode] = useState<'Moore' | 'Mealy'>('Moore');
  const [encoding, setEncoding] = useState<FsmEncoding>('binary');
  const [reset, setReset] = useState('synchronous');
  const [newTransition, setNewTransition] = useState<{ source: string; target: string }>({ source: '', target: '' });
  const [pendingTransition, setPendingTransition] = useState<string | null>(null);
  const [seed, setSeed] = useState(1);
  const [walk, setWalk] = useState<WalkState>(() => resetWalk(stateMachineData[0].states));
  const stateCounter = useRef(states.length + 1);

  // Coverage restarts whenever the graph changes (not when a state is merely dragged).
  const structureKey = `${states.map((s) => s.id).join(',')}|${transitions.map((t) => `${t.source}>${t.target}`).join(',')}|${seed}`;
  const [walkKey, setWalkKey] = useState(structureKey);
  if (walkKey !== structureKey) {
    setWalkKey(structureKey);
    setWalk(resetWalk(states));
  }

  const analysis = useMemo(() => analyzeReachability(states, transitions), [states, transitions]);
  const width = encodingWidth(states.length, encoding);
  const nameOf = (id: string) => states.find((s) => s.id === id)?.name ?? id;
  const stateById = (id: string) => states.find((s) => s.id === id);

  useEffect(() => {
    verificationHooks.forEach((h) => h(states, transitions, walk.current));
  }, [states, transitions, walk]);

  const exportJSON = () => {
    const dataStr = JSON.stringify({ states, transitions, mode, encoding, reset }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'state-machine.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePatternChange = (value: string) => {
    const example = stateMachineData.find((p) => p.name === value);
    if (example) {
      setPattern(example.name);
      setStates(example.states);
      setTransitions(example.transitions);
      setPendingTransition(null);
      stateCounter.current = example.states.length + 1;
    }
  };

  const addState = () => {
    const n = stateCounter.current++;
    let id = `s${n}`;
    while (states.some((s) => s.id === id)) id = `s${stateCounter.current++}`;
    setStates((s) => [...s, { id, name: `STATE_${n}`, x: 50, y: 50 }]);
  };

  const removeState = (id: string) => {
    setStates((s) => s.filter((st) => st.id !== id));
    setTransitions((t) => t.filter((tr) => tr.source !== id && tr.target !== id));
    setPendingTransition((p) => (p === id ? null : p));
  };

  const addEdge = (source: string, target: string) =>
    setTransitions((t) => (t.some((tr) => tr.source === source && tr.target === target) ? t : [...t, { source, target }]));

  const addTransition = () => {
    if (newTransition.source && newTransition.target) {
      addEdge(newTransition.source, newTransition.target);
      setNewTransition({ source: '', target: '' });
    }
  };

  const removeTransition = (index: number) => {
    setTransitions((t) => t.filter((_, i) => i !== index));
  };

  // Click one state, then another, to draw a transition. Clicking the same state again cancels.
  const handleStateClick = (id: string) => {
    if (!pendingTransition) {
      setPendingTransition(id);
      return;
    }
    if (pendingTransition !== id) addEdge(pendingTransition, id);
    setPendingTransition(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setStates((prev) => prev.map((s) => (s.id === active.id ? { ...s, x: s.x + delta.x, y: s.y + delta.y } : s)));
  };

  const transitionPaths = transitions.map((t, i) => {
    const a = stateById(t.source);
    const b = stateById(t.target);
    if (!a || !b) return null;
    const visited = walk.visitedTransitions.includes(i);
    const cls = visited ? 'stroke-cyan-500' : 'stroke-primary';
    if (t.source === t.target) {
      const d = `M${a.x + 30},${a.y} C${a.x + 18},${a.y - 42} ${a.x + 78},${a.y - 42} ${a.x + 66},${a.y}`;
      return <path key={i} d={d} fill="none" className={cls} strokeWidth={2} markerEnd={`url(#${markerId})`} />;
    }
    const e = edgeBetween(a, b, BOX);
    // Offset a pair of opposite transitions so both arrows stay readable.
    const reverse = transitions.some((o) => o.source === t.target && o.target === t.source);
    const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1;
    const ox = reverse ? (-(e.y2 - e.y1) / len) * 6 : 0;
    const oy = reverse ? ((e.x2 - e.x1) / len) * 6 : 0;
    return (
      <line key={i} x1={e.x1 + ox} y1={e.y1 + oy} x2={e.x2 + ox} y2={e.y2 + oy} className={cls} strokeWidth={visited ? 3 : 2} markerEnd={`url(#${markerId})`} />
    );
  });

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>State Machine Designer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col">
                <Label>Pattern Library</Label>
                <Select value={pattern} onValueChange={handlePatternChange}>
                  <SelectTrigger className="w-[200px]" aria-label="Pattern library">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stateMachineData.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addState}>Add State</Button>
              <Button variant="outline" onClick={() => setMode((m) => (m === 'Moore' ? 'Mealy' : 'Moore'))}>
                Mode: {mode}
              </Button>
              <div className="flex flex-col">
                <Label>State Encoding</Label>
                <Select value={encoding} onValueChange={(v) => setEncoding(v as FsmEncoding)}>
                  <SelectTrigger className="w-[150px]" aria-label="State encoding">
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
                  <SelectTrigger className="w-[150px]" aria-label="Reset style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="synchronous">Synchronous</SelectItem>
                    <SelectItem value="asynchronous">Asynchronous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={exportJSON} aria-label="Export state machine">
                Export
              </Button>
            </div>
            <div className="space-y-1 text-sm" aria-live="polite">
              <p>
                {mode === 'Moore'
                  ? 'Moore: outputs depend only on the current state.'
                  : 'Mealy: outputs depend on the current state and the current inputs.'}
              </p>
              <p data-testid="encoding-summary">
                Encoding width: {width} flip-flop{width === 1 ? '' : 's'} for {states.length} state{states.length === 1 ? '' : 's'}. {ENCODING_HINTS[encoding]}
              </p>
              <p>
                Reset ({reset}):{' '}
                <code className="font-mono text-xs [font-variant-ligatures:none]">{RESET_CODE[reset]}</code>
              </p>
              {pendingTransition ? (
                <p className="text-amber-700 dark:text-amber-300">
                  Transition from {nameOf(pendingTransition)}: select the target state (select {nameOf(pendingTransition)} again to cancel).
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col">
                <Label htmlFor="source-select">Source</Label>
                <select
                  id="source-select"
                  className="rounded border px-2 py-1"
                  value={newTransition.source}
                  onChange={(e) => setNewTransition((t) => ({ ...t, source: e.target.value }))}
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
                  className="rounded border px-2 py-1"
                  value={newTransition.target}
                  onChange={(e) => setNewTransition((t) => ({ ...t, target: e.target.value }))}
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
                <ul aria-label="Transitions" className="flex flex-col gap-1">
                  {transitions.map((t, i) => (
                    <li key={`${t.source}-${t.target}`} className="flex items-center gap-2 text-sm">
                      <span>
                        {nameOf(t.source)} → {nameOf(t.target)}
                        {walk.visitedTransitions.includes(i) ? ' (taken)' : ''}
                      </span>
                      <Button variant="destructive" size="sm" onClick={() => removeTransition(i)} aria-label={`Remove transition ${nameOf(t.source)} to ${nameOf(t.target)}`}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-sm" aria-live="polite" data-testid="fsm-coverage">
              <p>
                Coverage after {walk.step} clock{walk.step === 1 ? '' : 's'} (seed {seed}):
              </p>
              <p>
                States: {walk.visitedStates.length}/{states.length}
              </p>
              <p>
                Transitions: {walk.visitedTransitions.length}/{transitions.length}
              </p>
              <p className="text-muted-foreground">
                Transitions here have no input conditions, so when a state has several, a seeded generator picks one; the same seed replays the same walk.
              </p>
            </div>

            {(analysis.unreachable.length > 0 || analysis.dead.length > 0) && (
              <div className="text-sm text-amber-800 dark:text-amber-200" data-testid="fsm-analysis">
                {analysis.unreachable.length > 0 && <p>Unreachable from reset ({states[0]?.name}): {analysis.unreachable.join(', ')}</p>}
                {analysis.dead.length > 0 && (
                  <p>Dead transitions (their source is unreachable): {analysis.dead.map((t) => `${nameOf(t.source)}→${nameOf(t.target)}`).join(', ')}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setWalk((w) => stepWalk(w, transitions, seed))}>Step Simulation</Button>
              <Button variant="outline" onClick={() => setWalk(resetWalk(states))}>
                Reset Simulation
              </Button>
              <Button variant="outline" onClick={() => setSeed((s) => s + 1)}>
                New seed
              </Button>
            </div>

            <div className="overflow-x-auto">
              <div className="relative h-96 w-full min-w-[300px] rounded-lg bg-muted">
                <svg
                  className="absolute left-0 top-0 h-full w-full"
                  role="img"
                  aria-label={`State transitions: ${transitions.map((t) => `${nameOf(t.source)} to ${nameOf(t.target)}`).join(', ') || 'none'}`}
                >
                  <defs>
                    <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M0,0 L10,5 L0,10 Z" className="fill-primary" />
                    </marker>
                  </defs>
                  {transitionPaths}
                </svg>
                {states.map((state, idx) => (
                  <DraggableState
                    key={state.id}
                    id={state.id}
                    state={state}
                    onRemove={removeState}
                    onClick={handleStateClick}
                    selected={pendingTransition === state.id}
                    current={walk.current === state.id}
                    visited={walk.visitedStates.includes(state.id)}
                    encodingValue={encodeState(idx, states.length, encoding)}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </DndContext>
  );
};

export default StateMachineDesigner;
