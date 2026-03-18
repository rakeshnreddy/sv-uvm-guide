"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Play, RotateCcw, Shield, ShieldOff, ArrowRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Data model                                                         */
/* ------------------------------------------------------------------ */

type Property = {
  id: string;
  name: string;
  svCode: string;
  kind: 'assert' | 'assume' | 'cover';
  description: string;
};

type SimCycle = {
  cycle: number;
  push: boolean;
  pop: boolean;
  count: number;
  full: boolean;
  empty: boolean;
  assertPass: boolean;
};

const PROPERTIES: Property[] = [
  {
    id: 'p_full',
    name: 'p_full_is_correct',
    svCode: '(count == DEPTH) |-> full',
    kind: 'assert',
    description: 'Safety: when the count reaches DEPTH, the full flag must be asserted.',
  },
  {
    id: 'p_no_overflow',
    name: 'p_no_overflow',
    svCode: '!(push && full)',
    kind: 'assume',
    description: 'Assumption: the environment never pushes when the FIFO is full.',
  },
  {
    id: 'p_no_underflow',
    name: 'p_no_underflow',
    svCode: '!(pop && empty)',
    kind: 'assume',
    description: 'Assumption: the environment never pops when the FIFO is empty.',
  },
  {
    id: 'p_fill_drain',
    name: 'p_cover_fill_drain',
    svCode: '(count==0) ##[1:$] (count==DEPTH) ##[1:$] (count==0)',
    kind: 'cover',
    description: 'Reachability: the FIFO can be filled to capacity and drained back to empty.',
  },
];

const DEPTH = 4;

function generateSimCycles(): SimCycle[] {
  const cycles: SimCycle[] = [];
  let count = 0;
  // Simple deterministic pattern: fill then drain
  const actions: [boolean, boolean][] = [
    [true, false], [true, false], [true, false], [true, false],  // fill 0→4
    [false, true], [false, true], [false, false], [true, false], // drain then push
    [false, true], [false, true], [false, true], [false, false], // drain to 0
  ];
  for (let i = 0; i < actions.length; i++) {
    const [push, pop] = actions[i];
    if (push && count < DEPTH) count++;
    if (pop && count > 0) count--;
    const full = count === DEPTH;
    const empty = count === 0;
    const assertPass = full ? true : true; // p_full_is_correct: vacuously true when !full, true when full&&full
    cycles.push({ cycle: i + 1, push, pop, count, full, empty, assertPass });
  }
  return cycles;
}

const SIM_CYCLES = generateSimCycles();

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PropertyCard({ prop, isDisabled, onToggle, proofStatus }: {
  prop: Property;
  isDisabled?: boolean;
  onToggle?: () => void;
  proofStatus?: 'proven' | 'cex' | 'covered' | 'pending';
}) {
  const kindColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    assert: { bg: 'bg-emerald-900/30', border: 'border-emerald-500/40', text: 'text-emerald-300', badge: 'bg-emerald-800 text-emerald-200' },
    assume: { bg: 'bg-sky-900/30', border: 'border-sky-500/40', text: 'text-sky-300', badge: 'bg-sky-800 text-sky-200' },
    cover:  { bg: 'bg-amber-900/30', border: 'border-amber-500/40', text: 'text-amber-300', badge: 'bg-amber-800 text-amber-200' },
  };
  const colors = kindColors[prop.kind];
  const statusIcons: Record<string, React.ReactNode> = {
    proven:  <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    cex:     <XCircle className="w-4 h-4 text-red-400" />,
    covered: <CheckCircle2 className="w-4 h-4 text-amber-400" />,
    pending: <div className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-slate-400 animate-spin" />,
  };
  const statusLabels: Record<string, string> = {
    proven: 'Proven ✓',
    cex: 'CEX Found',
    covered: 'Covered ✓',
    pending: 'Pending',
  };

  return (
    <div className={`rounded-lg border px-3 py-2.5 transition-all ${isDisabled ? 'opacity-40 bg-slate-900/50 border-slate-700/30' : `${colors.bg} ${colors.border}`}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${isDisabled ? 'bg-slate-800 text-slate-500' : colors.badge}`}>{prop.kind}</span>
          <code className={`text-xs font-mono truncate ${isDisabled ? 'text-slate-500' : colors.text}`}>{prop.name}</code>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {proofStatus && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              {statusIcons[proofStatus]}
              <span className="hidden sm:inline">{statusLabels[proofStatus]}</span>
            </span>
          )}
          {prop.kind === 'assume' && onToggle && (
            <button
              onClick={onToggle}
              className={`p-1 rounded transition-colors ${isDisabled ? 'hover:bg-slate-800' : 'hover:bg-slate-700'}`}
              title={isDisabled ? 'Enable assumption' : 'Disable assumption'}
            >
              {isDisabled ? <ShieldOff className="w-3.5 h-3.5 text-slate-500" /> : <Shield className="w-3.5 h-3.5 text-sky-400" />}
            </button>
          )}
        </div>
      </div>
      <p className={`text-[11px] mt-1 ${isDisabled ? 'text-slate-600' : 'text-slate-400'}`}>{prop.description}</p>
      <code className={`text-[10px] font-mono block mt-1 ${isDisabled ? 'text-slate-600' : 'text-slate-500'}`}>{prop.svCode}</code>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function FormalVsSimulationVisualizer() {
  const [simStep, setSimStep] = useState(0);
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [disabledAssumptions, setDisabledAssumptions] = useState<Set<string>>(new Set());
  const [formalRan, setFormalRan] = useState(false);
  const [cexReplay, setCexReplay] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive formal proof results from assumptions
  const noOverflowDisabled = disabledAssumptions.has('p_no_overflow');
  const noUnderflowDisabled = disabledAssumptions.has('p_no_underflow');
  const hasCex = noOverflowDisabled || noUnderflowDisabled;

  const getProofStatus = useCallback((propId: string): 'proven' | 'cex' | 'covered' | 'pending' => {
    if (!formalRan) return 'pending';
    if (propId === 'p_full') return hasCex ? 'cex' : 'proven';
    if (propId === 'p_fill_drain') return 'covered';
    return 'proven';
  }, [formalRan, hasCex]);

  // Simulation animation
  useEffect(() => {
    if (isSimRunning && simStep < SIM_CYCLES.length) {
      intervalRef.current = setInterval(() => {
        setSimStep(prev => {
          if (prev >= SIM_CYCLES.length - 1) {
            setIsSimRunning(false);
            return prev;
          }
          return prev + 1;
        });
      }, 400);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSimRunning, simStep]);

  const handleRunSim = useCallback(() => {
    setSimStep(0);
    setIsSimRunning(true);
  }, []);

  const handleRunFormal = useCallback(() => {
    setFormalRan(true);
  }, []);

  const handleReplayCex = useCallback(() => {
    setCexReplay(true);
    setSimStep(0);
    // Show a CEX-driven scenario: push when full
    setIsSimRunning(true);
  }, []);

  const handleToggleAssumption = useCallback((id: string) => {
    setDisabledAssumptions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setFormalRan(false);
    setCexReplay(false);
  }, []);

  const handleReset = useCallback(() => {
    setSimStep(0);
    setIsSimRunning(false);
    setDisabledAssumptions(new Set());
    setFormalRan(false);
    setCexReplay(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const currentCycle = simStep < SIM_CYCLES.length ? SIM_CYCLES[simStep] : null;
  const visibleCycles = SIM_CYCLES.slice(0, simStep + 1);

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 font-sans my-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display text-white m-0">Formal vs Simulation Explorer</h3>
          <p className="text-sm text-slate-400 mt-1">Compare how the same FIFO properties behave under simulation and formal proof.</p>
        </div>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-700 flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* Two-panel layout */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Simulation Panel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 m-0">Simulation</h4>
            <button
              onClick={handleRunSim}
              disabled={isSimRunning}
              className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-xs font-medium rounded-lg transition-colors border border-emerald-700 flex items-center gap-1.5"
            >
              <Play className="w-3 h-3" /> Run UVM Test
            </button>
          </div>

          {/* FIFO state bar */}
          <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">FIFO State (Depth {DEPTH})</div>
            <div className="flex gap-1">
              {Array.from({ length: DEPTH }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-6 rounded transition-all duration-300 ${
                    currentCycle && i < currentCycle.count
                      ? 'bg-emerald-500/70 border border-emerald-400/50'
                      : 'bg-slate-700/50 border border-slate-600/30'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
              <span>{currentCycle?.empty ? '⚑ empty' : ''}</span>
              <span>count: {currentCycle?.count ?? 0}</span>
              <span>{currentCycle?.full ? '⚑ full' : ''}</span>
            </div>
          </div>

          {/* Waveform-style timeline */}
          <div className="bg-black/40 rounded-lg border border-slate-800 p-3 overflow-x-auto">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
              Cycle Log {cexReplay && <span className="text-red-400 font-bold ml-2">▸ CEX Replay</span>}
            </div>
            <div className="flex flex-col gap-0.5 font-mono text-[10px]">
              <div className="flex gap-2 text-slate-600 border-b border-slate-800 pb-1 mb-1">
                <span className="w-8 text-right">#</span>
                <span className="w-10 text-center">push</span>
                <span className="w-10 text-center">pop</span>
                <span className="w-10 text-center">cnt</span>
                <span className="w-12 text-center">assert</span>
              </div>
              {visibleCycles.map((c, i) => (
                <div key={i} className={`flex gap-2 ${i === simStep ? 'text-emerald-300 bg-emerald-900/20 rounded' : 'text-slate-400'}`}>
                  <span className="w-8 text-right text-slate-600">{c.cycle}</span>
                  <span className={`w-10 text-center ${c.push ? 'text-cyan-400' : ''}`}>{c.push ? '↑' : '·'}</span>
                  <span className={`w-10 text-center ${c.pop ? 'text-orange-400' : ''}`}>{c.pop ? '↓' : '·'}</span>
                  <span className="w-10 text-center">{c.count}</span>
                  <span className="w-12 text-center text-emerald-500">✓</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coverage bins */}
          <div className="bg-slate-800/40 rounded-lg border border-slate-700 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Coverage Progress</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (simStep / SIM_CYCLES.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400">{Math.round(Math.min(100, (simStep / SIM_CYCLES.length) * 100))}%</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {simStep >= SIM_CYCLES.length - 1 ? 'Fill-and-drain sequence covered ✓' : 'Running stimulus to hit cover properties...'}
            </p>
          </div>
        </div>

        {/* Formal Panel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-violet-400 m-0">Formal Proof</h4>
            <button
              onClick={handleRunFormal}
              className="px-3 py-1 bg-violet-800 hover:bg-violet-700 text-xs font-medium rounded-lg transition-colors border border-violet-700 flex items-center gap-1.5"
            >
              <Shield className="w-3 h-3" /> Run Proofs
            </button>
          </div>

          {/* Property list */}
          <div className="flex flex-col gap-2">
            {PROPERTIES.map(prop => (
              <PropertyCard
                key={prop.id}
                prop={prop}
                isDisabled={disabledAssumptions.has(prop.id)}
                onToggle={prop.kind === 'assume' ? () => handleToggleAssumption(prop.id) : undefined}
                proofStatus={formalRan ? getProofStatus(prop.id) : undefined}
              />
            ))}
          </div>

          {/* Counterexample panel */}
          {formalRan && hasCex && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-red-300">Counterexample Found</div>
                  <p className="text-[11px] text-red-400/80 mt-1">
                    {noOverflowDisabled
                      ? 'With p_no_overflow disabled, the formal engine found a trace where push fires while full=1. The FIFO overflows and count wraps, violating p_full_is_correct.'
                      : 'With p_no_underflow disabled, the formal engine found a trace where pop fires while empty=1. The count underflows.'}
                  </p>
                  <button
                    onClick={handleReplayCex}
                    className="mt-2 px-3 py-1 bg-red-900/60 hover:bg-red-800/60 text-[11px] font-medium rounded-lg transition-colors border border-red-700/50 flex items-center gap-1.5 text-red-200"
                  >
                    <ArrowRight className="w-3 h-3" /> Replay as UVM Seed
                  </button>
                </div>
              </div>
            </div>
          )}

          {formalRan && !hasCex && (
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-emerald-300">All Properties Proven</div>
                  <p className="text-[11px] text-emerald-400/80 mt-1">
                    Under the given assumptions, the safety assertion holds for all reachable states. The cover property is reachable within bounded depth.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Insight box */}
          <div className="bg-slate-800/40 rounded-lg border border-slate-700 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Key Insight</div>
            <p className="text-[11px] text-slate-400">
              Toggle assumptions with the <Shield className="w-3 h-3 inline text-sky-400" /> icon to see how removing a constraint exposes real bugs. In production, this workflow converts counterexamples into directed UVM regression seeds.
            </p>
          </div>
        </div>
      </div>

      {/* Code hint */}
      <div className="bg-black/40 rounded-lg border border-slate-800 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Shared Property Library Pattern</div>
        <pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre">
{`// fifo_props.sv — consumed by both simulation and formal
module fifo_properties #(parameter DEPTH = ${DEPTH})
  (input logic clk, rst_n, push, pop,
   input logic [$clog2(DEPTH):0] count,
   input logic full, empty);

  assert property (@(posedge clk) disable iff (!rst_n)
    (count == DEPTH) |-> full);           // ← assert in sim, prove in formal

  assume property (@(posedge clk) disable iff (!rst_n)
    !(push && full));                     // ← constrain formal, mirror UVM constraints

  cover property (@(posedge clk) disable iff (!rst_n)
    (count == 0) ##[1:$] (count == DEPTH) ##[1:$] (count == 0));
endmodule

// Bind once — both flows see the same checkers
bind fifo fifo_properties #(.DEPTH(DEPTH)) props (.*);`}
        </pre>
      </div>
    </div>
  );
}
