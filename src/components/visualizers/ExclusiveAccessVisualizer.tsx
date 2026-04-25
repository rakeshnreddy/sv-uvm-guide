'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from 'lucide-react';

// ── Types ──

interface MonitorState {
  address: string | null;
  id: number | null;
  valid: boolean;
}

interface CycleEvent {
  master: number;
  action: string;
  monitorUpdate?: MonitorState;
  color: string;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  events: CycleEvent[][];
}

// ── Scenario Data ──

const scenarios: Scenario[] = [
  {
    id: 'success',
    name: 'Successful Atomic Access',
    description: 'Master 0 performs an uninterrupted read-modify-write.',
    events: [
      [],
      [{ master: 0, action: 'AR (Read) with ARLOCK=1 to 0x1000', monitorUpdate: { address: '0x1000', id: 0, valid: true }, color: 'text-blue-400' }],
      [{ master: 0, action: 'Read Data returns with EXOKAY', color: 'text-blue-400' }],
      [{ master: 0, action: 'Master 0 modifies data locally', color: 'text-slate-400' }],
      [{ master: 0, action: 'AW (Write) with AWLOCK=1 to 0x1000', color: 'text-blue-400' }],
      [{ master: 0, action: 'Monitor matches! Write allowed.', monitorUpdate: { address: null, id: null, valid: false }, color: 'text-emerald-400' }],
      [{ master: 0, action: 'Write Response B returns EXOKAY', color: 'text-emerald-400' }],
    ],
  },
  {
    id: 'failed_normal_write',
    name: 'Failed by Normal Write',
    description: 'Master 1 performs a normal write, clearing Master 0\'s exclusive monitor reservation.',
    events: [
      [],
      [{ master: 0, action: 'AR (Read) with ARLOCK=1 to 0x1000', monitorUpdate: { address: '0x1000', id: 0, valid: true }, color: 'text-blue-400' }],
      [{ master: 0, action: 'Read Data returns with EXOKAY', color: 'text-blue-400' }],
      [{ master: 1, action: 'AW (Normal Write) to 0x1000', monitorUpdate: { address: null, id: null, valid: false }, color: 'text-purple-400' }],
      [{ master: 1, action: 'Normal Write succeeds, monitor cleared', color: 'text-purple-400' }],
      [{ master: 0, action: 'AW (Write) with AWLOCK=1 to 0x1000', color: 'text-blue-400' }],
      [{ master: 0, action: 'Monitor mismatch! Write BLOCKED.', color: 'text-rose-400' }],
      [{ master: 0, action: 'Write Response B returns OKAY (Failed)', color: 'text-rose-400' }],
    ],
  },
  {
    id: 'interleaved_exclusive',
    name: 'Interleaved Exclusive Accesses',
    description: 'Two masters try to acquire the same lock. First to write wins.',
    events: [
      [],
      [{ master: 0, action: 'M0: AR with ARLOCK=1 to 0x1000', monitorUpdate: { address: '0x1000', id: 0, valid: true }, color: 'text-blue-400' }],
      [{ master: 1, action: 'M1: AR with ARLOCK=1 to 0x1000', monitorUpdate: { address: '0x1000', id: 1, valid: true }, color: 'text-purple-400' }],
      [{ master: 1, action: 'M1: AW with AWLOCK=1 to 0x1000', color: 'text-purple-400' }],
      [{ master: 1, action: 'M1: Monitor matches! Write allowed.', monitorUpdate: { address: null, id: null, valid: false }, color: 'text-emerald-400' }],
      [{ master: 0, action: 'M0: AW with AWLOCK=1 to 0x1000', color: 'text-blue-400' }],
      [{ master: 0, action: 'M0: Monitor cleared by M1! Write BLOCKED.', color: 'text-rose-400' }],
      [{ master: 0, action: 'M0: B returns OKAY (Failed)', color: 'text-rose-400' }],
    ],
  },
];

const masterColors: Record<number, string> = {
  0: 'bg-blue-500',
  1: 'bg-purple-500',
};

// ── Component ──

export default function ExclusiveAccessVisualizer() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [cycle, setCycle] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const scenario = scenarios.find(s => s.id === scenarioId) ?? scenarios[0];
  const maxCycle = scenario.events.length - 1;
  const currentEvents = scenario.events[cycle] ?? [];

  // Reconstruct Monitor State at current cycle
  let monitorState: MonitorState = { address: null, id: null, valid: false };
  for (let i = 0; i <= cycle; i++) {
    const evts = scenario.events[i];
    for (const evt of evts) {
      if (evt.monitorUpdate) {
        monitorState = evt.monitorUpdate;
      }
    }
  }

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
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden" data-testid="exclusive-access-visualizer">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">AXI Exclusive Access Monitor</h3>
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

      {/* Exclusive Monitor State */}
      <div className="px-4 py-4 border-b border-slate-700/50 bg-slate-800/80 flex items-center justify-center">
        <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-4 w-full max-w-md shadow-lg flex flex-col items-center relative">
          <div className="absolute -top-3 bg-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded-full font-bold tracking-widest uppercase">
            Global Exclusive Monitor
          </div>
          
          <div className="flex w-full mt-2 items-center justify-between px-4">
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-500 font-semibold mb-1">STATE</span>
              <span className={`text-sm font-bold px-2 py-0.5 rounded ${monitorState.valid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                {monitorState.valid ? 'RESERVED' : 'OPEN'}
              </span>
            </div>
            
            <div className="w-px h-8 bg-slate-700 mx-4"></div>
            
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-500 font-semibold mb-1">ADDRESS</span>
              <span className="text-sm font-mono text-slate-300">
                {monitorState.address || '----'}
              </span>
            </div>
            
            <div className="w-px h-8 bg-slate-700 mx-4"></div>
            
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-500 font-semibold mb-1">MASTER ID</span>
              {monitorState.id !== null ? (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${masterColors[monitorState.id]}`}>
                  {monitorState.id}
                </div>
              ) : (
                <span className="text-sm text-slate-500">--</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event log */}
      <div className="px-4 py-3 min-h-[200px]">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-semibold">Bus Events (Cycle {cycle})</div>
        <div className="space-y-1.5">
          <AnimatePresence>
            {eventLog.map((evt, i) => {
              const isCurrent = i >= eventLog.length - currentEvents.length;
              return (
                <motion.div
                  key={`evt-${i}`}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: isCurrent ? 1 : 0.5, y: 0 }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${
                    isCurrent ? 'border-slate-700 bg-slate-800/50' : 'border-slate-800 bg-slate-800/20'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${masterColors[evt.master] ?? 'bg-slate-500'}`}>
                    {evt.master}
                  </div>
                  <span className={`flex-1 font-medium ${isCurrent ? evt.color : 'text-slate-500'}`}>
                    {evt.action}
                  </span>
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
        <button onClick={reset} title="Reset" className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
          <RotateCcw size={16} />
        </button>
        <button onClick={stepBackward} title="Step Backward" disabled={cycle <= 0} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <SkipBack size={16} />
        </button>
        <button onClick={() => setIsPlaying(!isPlaying)} title={isPlaying ? 'Pause' : 'Play'} className="p-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={stepForward} title="Step Forward" disabled={cycle >= maxCycle} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
}
