'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, AlertTriangle } from 'lucide-react';

// ── Types ──

interface Node {
  id: string;
  label: string;
  state: 'idle' | 'waiting' | 'active' | 'deadlocked';
  waitingFor?: string; // ID of the signal it's waiting for
}

interface SignalEvent {
  source: string;
  target: string;
  signal: string;
  active: boolean;
}

interface CycleState {
  nodes: Record<string, Node>;
  signals: SignalEvent[];
  log: string;
  isDeadlocked?: boolean;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  cycles: CycleState[];
}

// ── Scenarios ──

const scenarios: Scenario[] = [
  {
    id: 'channel_dependency',
    name: 'Channel Dependency Deadlock',
    description: 'Master waits for AWREADY before asserting WVALID. Slave waits for WVALID before asserting AWREADY. Circular wait!',
    cycles: [
      {
        nodes: {
          'master_aw': { id: 'master_aw', label: 'Master AW Channel', state: 'idle' },
          'master_w': { id: 'master_w', label: 'Master W Channel', state: 'idle' },
          'slave_aw': { id: 'slave_aw', label: 'Slave AW Channel', state: 'idle' },
          'slave_w': { id: 'slave_w', label: 'Slave W Channel', state: 'idle' },
        },
        signals: [],
        log: 'Initial state. Master wants to perform a write.',
      },
      {
        nodes: {
          'master_aw': { id: 'master_aw', label: 'Master AW Channel', state: 'active' },
          'master_w': { id: 'master_w', label: 'Master W Channel', state: 'waiting', waitingFor: 'AWREADY' },
          'slave_aw': { id: 'slave_aw', label: 'Slave AW Channel', state: 'idle' },
          'slave_w': { id: 'slave_w', label: 'Slave W Channel', state: 'idle' },
        },
        signals: [
          { source: 'master_aw', target: 'slave_aw', signal: 'AWVALID', active: true },
        ],
        log: 'Master asserts AWVALID. Master design incorrectly waits for AWREADY before sending W data.',
      },
      {
        nodes: {
          'master_aw': { id: 'master_aw', label: 'Master AW Channel', state: 'active' },
          'master_w': { id: 'master_w', label: 'Master W Channel', state: 'waiting', waitingFor: 'AWREADY' },
          'slave_aw': { id: 'slave_aw', label: 'Slave AW Channel', state: 'waiting', waitingFor: 'WVALID' },
          'slave_w': { id: 'slave_w', label: 'Slave W Channel', state: 'idle' },
        },
        signals: [
          { source: 'master_aw', target: 'slave_aw', signal: 'AWVALID', active: true },
        ],
        log: 'Slave sees AWVALID, but slave design incorrectly waits for WVALID before asserting AWREADY.',
      },
      {
        nodes: {
          'master_aw': { id: 'master_aw', label: 'Master AW Channel', state: 'active' },
          'master_w': { id: 'master_w', label: 'Master W Channel', state: 'deadlocked', waitingFor: 'AWREADY' },
          'slave_aw': { id: 'slave_aw', label: 'Slave AW Channel', state: 'deadlocked', waitingFor: 'WVALID' },
          'slave_w': { id: 'slave_w', label: 'Slave W Channel', state: 'idle' },
        },
        signals: [
          { source: 'master_aw', target: 'slave_aw', signal: 'AWVALID', active: true },
        ],
        log: 'DEADLOCK: Master W waits for Slave AW, and Slave AW waits for Master W. System hangs forever.',
        isDeadlocked: true,
      },
    ],
  },
  {
    id: 'legal_flow',
    name: 'Legal Channel Independence',
    description: 'Master asserts WVALID without waiting. Slave asserts AWREADY independently. Flow succeeds.',
    cycles: [
      {
        nodes: {
          'master_aw': { id: 'master_aw', label: 'Master AW Channel', state: 'idle' },
          'master_w': { id: 'master_w', label: 'Master W Channel', state: 'idle' },
          'slave_aw': { id: 'slave_aw', label: 'Slave AW Channel', state: 'idle' },
          'slave_w': { id: 'slave_w', label: 'Slave W Channel', state: 'idle' },
        },
        signals: [],
        log: 'Initial state. Master wants to perform a write.',
      },
      {
        nodes: {
          'master_aw': { id: 'master_aw', label: 'Master AW Channel', state: 'active' },
          'master_w': { id: 'master_w', label: 'Master W Channel', state: 'active' },
          'slave_aw': { id: 'slave_aw', label: 'Slave AW Channel', state: 'idle' },
          'slave_w': { id: 'slave_w', label: 'Slave W Channel', state: 'idle' },
        },
        signals: [
          { source: 'master_aw', target: 'slave_aw', signal: 'AWVALID', active: true },
          { source: 'master_w', target: 'slave_w', signal: 'WVALID', active: true },
        ],
        log: 'Master asserts AWVALID and WVALID concurrently (compliant with AXI spec).',
      },
      {
        nodes: {
          'master_aw': { id: 'master_aw', label: 'Master AW Channel', state: 'idle' },
          'master_w': { id: 'master_w', label: 'Master W Channel', state: 'active' },
          'slave_aw': { id: 'slave_aw', label: 'Slave AW Channel', state: 'active' },
          'slave_w': { id: 'slave_w', label: 'Slave W Channel', state: 'idle' },
        },
        signals: [
          { source: 'slave_aw', target: 'master_aw', signal: 'AWREADY', active: true },
          { source: 'master_w', target: 'slave_w', signal: 'WVALID', active: true },
        ],
        log: 'Slave asserts AWREADY. Address handshake completes.',
      },
      {
        nodes: {
          'master_aw': { id: 'master_aw', label: 'Master AW Channel', state: 'idle' },
          'master_w': { id: 'master_w', label: 'Master W Channel', state: 'idle' },
          'slave_aw': { id: 'slave_aw', label: 'Slave AW Channel', state: 'idle' },
          'slave_w': { id: 'slave_w', label: 'Slave W Channel', state: 'active' },
        },
        signals: [
          { source: 'slave_w', target: 'master_w', signal: 'WREADY', active: true },
        ],
        log: 'Slave asserts WREADY. Data handshake completes. Success!',
      },
    ],
  },
];

// ── Component ──

export default function AxiDeadlockSimulator() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [cycle, setCycle] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const scenario = scenarios.find(s => s.id === scenarioId) ?? scenarios[0];
  const maxCycle = scenario.cycles.length - 1;
  const currentState = scenario.cycles[cycle];

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
    const timer = setTimeout(stepForward, 1800);
    return () => clearTimeout(timer);
  }, [isPlaying, cycle, maxCycle, stepForward]);

  const getNodeColor = (state: string) => {
    switch (state) {
      case 'idle': return 'bg-slate-800 border-slate-700 text-slate-400';
      case 'active': return 'bg-emerald-500/20 border-emerald-500 text-emerald-400';
      case 'waiting': return 'bg-amber-500/20 border-amber-500 text-amber-400';
      case 'deadlocked': return 'bg-rose-500/20 border-rose-500 text-rose-400';
      default: return 'bg-slate-800 border-slate-700 text-slate-400';
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden" data-testid="axi-deadlock-simulator">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">AXI Deadlock Simulator</h3>
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

      {/* Visual Graph Area */}
      <div className="p-8 relative min-h-[300px] flex items-center justify-center bg-slate-900 overflow-hidden">
        
        {/* Connection Lines (Simplified SVGs) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          {/* Top connection (AW) */}
          <line x1="30%" y1="35%" x2="70%" y2="35%" stroke="#334155" strokeWidth="2" strokeDasharray="4" />
          {/* Bottom connection (W) */}
          <line x1="30%" y1="65%" x2="70%" y2="65%" stroke="#334155" strokeWidth="2" strokeDasharray="4" />
          
          {/* Active Signals */}
          <AnimatePresence>
            {currentState.signals.map((sig, i) => {
              const isAw = sig.source.includes('aw') || sig.target.includes('aw');
              const yPos = isAw ? '35%' : '65%';
              const isForward = sig.source.includes('master');
              
              return (
                <motion.g key={`${sig.signal}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <line 
                    x1={isForward ? "35%" : "65%"} 
                    y1={yPos} 
                    x2={isForward ? "65%" : "35%"} 
                    y2={yPos} 
                    stroke={sig.active ? "#3b82f6" : "#334155"} 
                    strokeWidth="3" 
                  />
                  <circle cx="50%" cy={yPos} r="4" fill="#3b82f6" />
                  <text x="50%" y={`calc(${yPos} - 10px)`} fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">
                    {sig.signal}
                  </text>
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>

        {/* Nodes */}
        <div className="w-full max-w-2xl grid grid-cols-2 gap-16 relative z-10">
          
          {/* Master Side */}
          <div className="space-y-16">
            <div className="text-center">
              <div className="text-slate-500 font-bold tracking-widest text-sm mb-2 uppercase">Master</div>
              <motion.div 
                layout
                className={`p-4 rounded-xl border-2 shadow-lg transition-colors duration-500 ${getNodeColor(currentState.nodes['master_aw'].state)}`}
              >
                <div className="font-bold">{currentState.nodes['master_aw'].label}</div>
                <div className="text-xs mt-1 uppercase tracking-wider opacity-80">{currentState.nodes['master_aw'].state}</div>
                {currentState.nodes['master_aw'].waitingFor && (
                  <div className="text-xs mt-2 font-mono">Waiting for: {currentState.nodes['master_aw'].waitingFor}</div>
                )}
              </motion.div>
            </div>
            
            <div className="text-center">
              <motion.div 
                layout
                className={`p-4 rounded-xl border-2 shadow-lg transition-colors duration-500 ${getNodeColor(currentState.nodes['master_w'].state)}`}
              >
                <div className="font-bold">{currentState.nodes['master_w'].label}</div>
                <div className="text-xs mt-1 uppercase tracking-wider opacity-80">{currentState.nodes['master_w'].state}</div>
                {currentState.nodes['master_w'].waitingFor && (
                  <div className="text-xs mt-2 font-mono bg-black/20 p-1 rounded inline-block">Waiting for: {currentState.nodes['master_w'].waitingFor}</div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Slave Side */}
          <div className="space-y-16">
            <div className="text-center">
              <div className="text-slate-500 font-bold tracking-widest text-sm mb-2 uppercase">Slave</div>
              <motion.div 
                layout
                className={`p-4 rounded-xl border-2 shadow-lg transition-colors duration-500 ${getNodeColor(currentState.nodes['slave_aw'].state)}`}
              >
                <div className="font-bold">{currentState.nodes['slave_aw'].label}</div>
                <div className="text-xs mt-1 uppercase tracking-wider opacity-80">{currentState.nodes['slave_aw'].state}</div>
                {currentState.nodes['slave_aw'].waitingFor && (
                  <div className="text-xs mt-2 font-mono bg-black/20 p-1 rounded inline-block">Waiting for: {currentState.nodes['slave_aw'].waitingFor}</div>
                )}
              </motion.div>
            </div>
            
            <div className="text-center">
              <motion.div 
                layout
                className={`p-4 rounded-xl border-2 shadow-lg transition-colors duration-500 ${getNodeColor(currentState.nodes['slave_w'].state)}`}
              >
                <div className="font-bold">{currentState.nodes['slave_w'].label}</div>
                <div className="text-xs mt-1 uppercase tracking-wider opacity-80">{currentState.nodes['slave_w'].state}</div>
                {currentState.nodes['slave_w'].waitingFor && (
                  <div className="text-xs mt-2 font-mono bg-black/20 p-1 rounded inline-block">Waiting for: {currentState.nodes['slave_w'].waitingFor}</div>
                )}
              </motion.div>
            </div>
          </div>

        </div>

        {/* Deadlock Overlay */}
        <AnimatePresence>
          {currentState.isDeadlocked && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-rose-900/40 backdrop-blur-[2px] flex items-center justify-center z-20 pointer-events-none"
            >
              <div className="bg-rose-950 border-2 border-rose-500 p-6 rounded-2xl shadow-2xl flex flex-col items-center">
                <AlertTriangle size={48} className="text-rose-500 mb-4 animate-pulse" />
                <h2 className="text-2xl font-bold text-rose-100">DEADLOCK DETECTED</h2>
                <p className="text-rose-300 mt-2 max-w-sm text-center">Circular dependency formed. System is hung.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Event log */}
      <div className="px-4 py-4 min-h-[80px] bg-slate-800 border-t border-slate-700 flex items-center">
        <div className="text-sm font-medium text-slate-300 border-l-4 border-blue-500 pl-3">
          {currentState.log}
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
