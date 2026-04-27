'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from 'lucide-react';

// ── Types ──

interface Transaction {
  id: number;
  type: 'read' | 'write';
  addr: string;
  label: string;
}

interface CycleEvent {
  channel: 'AR' | 'AW' | 'R' | 'B';
  txn: Transaction;
  action: string;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  outstanding: Transaction[];
  events: CycleEvent[][];
}

// ── Scenario Data ──

const scenarios: Scenario[] = [
  {
    id: 'same_id_order',
    name: 'Same-ID Ordering',
    description: 'Two reads with the same ID — responses MUST arrive in order.',
    outstanding: [
      { id: 3, type: 'read', addr: '0x1000', label: 'Read A' },
      { id: 3, type: 'read', addr: '0x2000', label: 'Read B' },
    ],
    events: [
      [],
      [{ channel: 'AR', txn: { id: 3, type: 'read', addr: '0x1000', label: 'Read A' }, action: 'Issue Read A (ID=3)' }],
      [{ channel: 'AR', txn: { id: 3, type: 'read', addr: '0x2000', label: 'Read B' }, action: 'Issue Read B (ID=3)' }],
      [{ channel: 'R', txn: { id: 3, type: 'read', addr: '0x1000', label: 'Read A' }, action: 'Data A returns (RID=3) — must come first!' }],
      [{ channel: 'R', txn: { id: 3, type: 'read', addr: '0x2000', label: 'Read B' }, action: 'Data B returns (RID=3) — in order ✓' }],
    ],
  },
  {
    id: 'diff_id_reorder',
    name: 'Different-ID Reorder',
    description: 'Two reads with different IDs — responses may arrive in ANY order.',
    outstanding: [
      { id: 1, type: 'read', addr: '0x1000', label: 'Read A' },
      { id: 2, type: 'read', addr: '0x2000', label: 'Read B' },
    ],
    events: [
      [],
      [{ channel: 'AR', txn: { id: 1, type: 'read', addr: '0x1000', label: 'Read A' }, action: 'Issue Read A (ID=1) — cache miss, slow' }],
      [{ channel: 'AR', txn: { id: 2, type: 'read', addr: '0x2000', label: 'Read B' }, action: 'Issue Read B (ID=2) — cache hit, fast' }],
      [{ channel: 'R', txn: { id: 2, type: 'read', addr: '0x2000', label: 'Read B' }, action: 'Data B returns FIRST (RID=2) — legal!' }],
      [{ channel: 'R', txn: { id: 1, type: 'read', addr: '0x1000', label: 'Read A' }, action: 'Data A returns later (RID=1) — reordered ✓' }],
    ],
  },
  {
    id: 'mixed_outstanding',
    name: 'Mixed Outstanding',
    description: 'Multiple outstanding writes and reads with different IDs interleaving.',
    outstanding: [
      { id: 1, type: 'write', addr: '0x1000', label: 'Write A' },
      { id: 2, type: 'read', addr: '0x2000', label: 'Read B' },
      { id: 1, type: 'write', addr: '0x3000', label: 'Write C' },
      { id: 3, type: 'read', addr: '0x4000', label: 'Read D' },
    ],
    events: [
      [],
      [{ channel: 'AW', txn: { id: 1, type: 'write', addr: '0x1000', label: 'Write A' }, action: 'Issue Write A (ID=1)' }],
      [
        { channel: 'AR', txn: { id: 2, type: 'read', addr: '0x2000', label: 'Read B' }, action: 'Issue Read B (ID=2)' },
        { channel: 'AW', txn: { id: 1, type: 'write', addr: '0x3000', label: 'Write C' }, action: 'Issue Write C (ID=1)' },
      ],
      [{ channel: 'AR', txn: { id: 3, type: 'read', addr: '0x4000', label: 'Read D' }, action: 'Issue Read D (ID=3)' }],
      [{ channel: 'R', txn: { id: 3, type: 'read', addr: '0x4000', label: 'Read D' }, action: 'Read D returns (RID=3) — fast slave' }],
      [{ channel: 'B', txn: { id: 1, type: 'write', addr: '0x1000', label: 'Write A' }, action: 'Write A ack (BID=1) — must come before Write C ack' }],
      [{ channel: 'R', txn: { id: 2, type: 'read', addr: '0x2000', label: 'Read B' }, action: 'Read B returns (RID=2)' }],
      [{ channel: 'B', txn: { id: 1, type: 'write', addr: '0x3000', label: 'Write C' }, action: 'Write C ack (BID=1) — after Write A ✓' }],
    ],
  },
  {
    id: 'id_prepend',
    name: 'Interconnect ID Prepend',
    description: 'Two masters use the same ID — the interconnect prepends source bits to keep them unique.',
    outstanding: [
      { id: 2, type: 'read', addr: '0x1000', label: 'M0: Read' },
      { id: 2, type: 'read', addr: '0x2000', label: 'M1: Read' },
    ],
    events: [
      [],
      [{ channel: 'AR', txn: { id: 2, type: 'read', addr: '0x1000', label: 'M0: Read' }, action: 'M0 issues ARID=2 → Interconnect makes ID=0_10 (4)' }],
      [{ channel: 'AR', txn: { id: 2, type: 'read', addr: '0x2000', label: 'M1: Read' }, action: 'M1 issues ARID=2 → Interconnect makes ID=1_10 (6)' }],
      [{ channel: 'R', txn: { id: 2, type: 'read', addr: '0x2000', label: 'M1: Read' }, action: 'Slave returns RID=6 → routed to M1 (stripped to ID=2)' }],
      [{ channel: 'R', txn: { id: 2, type: 'read', addr: '0x1000', label: 'M0: Read' }, action: 'Slave returns RID=4 → routed to M0 (stripped to ID=2)' }],
    ],
  },
];

const idColors: Record<number, string> = {
  1: 'bg-blue-500',
  2: 'bg-purple-500',
  3: 'bg-amber-500',
};

const channelColors: Record<string, string> = {
  AR: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  AW: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  R: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  B: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
};

// ── Component ──

export default function AxiIdOrderingVisualizer() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [cycle, setCycle] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const scenario = scenarios.find(s => s.id === scenarioId) ?? scenarios[0];
  const maxCycle = scenario.events.length - 1;
  const currentEvents = scenario.events[cycle] ?? [];

  // Collect all events up to current cycle for the log
  const eventLog = scenario.events.slice(0, cycle + 1).flat();

  const stepForward = useCallback(() => {
    setCycle(c => Math.min(c + 1, maxCycle));
  }, [maxCycle]);

  const stepBackward = useCallback(() => {
    setCycle(c => Math.max(c - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setCycle(0);
    setIsPlaying(false);
  }, []);

  React.useEffect(() => {
    if (!isPlaying) return;
    if (cycle >= maxCycle) { setIsPlaying(false); return; }
    const timer = setTimeout(stepForward, 1400);
    return () => clearTimeout(timer);
  }, [isPlaying, cycle, maxCycle, stepForward]);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden" data-testid="axi-id-ordering-visualizer">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">AXI ID Ordering Visualizer</h3>
        <select
          value={scenarioId}
          onChange={(e) => { setScenarioId(e.target.value); setCycle(0); setIsPlaying(false); }}
          className="bg-slate-700 text-slate-200 text-sm rounded px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Description */}
      <div className="px-4 py-2 text-sm text-slate-400 bg-slate-800/30 border-b border-slate-700/50">
        {scenario.description}
      </div>

      {/* Outstanding transactions */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-semibold">Outstanding Transactions</div>
        <div className="flex flex-wrap gap-2">
          {scenario.outstanding.map((txn, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${idColors[txn.id] ?? 'bg-slate-500'}`}>
                {txn.id}
              </div>
              <span className="text-sm text-slate-300">{txn.label}</span>
              <span className="text-xs text-slate-500 font-mono">{txn.addr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Event log */}
      <div className="px-4 py-3 min-h-[200px]">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-semibold">Event Log (Cycle {cycle})</div>
        <div className="space-y-1.5">
          <AnimatePresence>
            {eventLog.map((evt, i) => {
              const isCurrent = i >= eventLog.length - currentEvents.length;
              return (
                <motion.div
                  key={`${evt.channel}-${evt.txn.label}-${i}`}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: isCurrent ? 1 : 0.5, y: 0 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                    isCurrent ? channelColors[evt.channel] : 'border-slate-800 bg-slate-800/20 text-slate-500'
                  }`}
                >
                  <span className="font-mono font-bold text-xs w-8 flex-shrink-0">{evt.channel}</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${idColors[evt.txn.id] ?? 'bg-slate-500'}`}>
                    {evt.txn.id}
                  </div>
                  <span className="flex-1">{evt.action}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {eventLog.length === 0 && (
            <div className="text-slate-600 text-sm italic py-4 text-center">Press Play or Step Forward to begin</div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 bg-slate-800/30 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">T{cycle}</span>
          <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
              animate={{ width: `${maxCycle > 0 ? (cycle / maxCycle) * 100 : 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs font-mono text-slate-500">T{maxCycle}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700 flex items-center justify-center gap-2">
        <button onClick={reset} title="Reset" aria-label="Reset simulation" className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
          <RotateCcw size={16} />
        </button>
        <button onClick={stepBackward} title="Step Backward" aria-label="Step Backward" disabled={cycle <= 0} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <SkipBack size={16} />
        </button>
        <button onClick={() => setIsPlaying(!isPlaying)} title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'} className="p-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={stepForward} title="Step Forward" aria-label="Step Forward" disabled={cycle >= maxCycle} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
}
