'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from 'lucide-react';

// ── Types ──

interface ChannelState {
  valid: boolean;
  ready: boolean;
  data: string;
  transferred: boolean;
}

interface CycleState {
  aw: ChannelState;
  w: ChannelState;
  b: ChannelState;
  ar: ChannelState;
  r: ChannelState;
  label: string;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  cycles: CycleState[];
}

// ── Scenario Data ──

const defaultChannel: ChannelState = { valid: false, ready: false, data: '', transferred: false };

const scenarios: Scenario[] = [
  {
    id: 'basic_write',
    name: 'Basic Write',
    description: 'A single write transaction across AW, W, and B channels.',
    cycles: [
      { aw: { ...defaultChannel }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'IDLE — Bus quiet' },
      { aw: { valid: true, ready: true, data: '0x1000', transferred: true }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'AW handshake — address accepted' },
      { aw: { ...defaultChannel }, w: { valid: true, ready: true, data: 'D0', transferred: true }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'W beat 0 — data sent' },
      { aw: { ...defaultChannel }, w: { valid: true, ready: true, data: 'D1 (WLAST)', transferred: true }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'W beat 1 — final data with WLAST' },
      { aw: { ...defaultChannel }, w: { ...defaultChannel }, b: { valid: true, ready: true, data: 'OKAY', transferred: true }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'B response — write acknowledged' },
    ],
  },
  {
    id: 'basic_read',
    name: 'Basic Read',
    description: 'A single read transaction across AR and R channels.',
    cycles: [
      { aw: { ...defaultChannel }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'IDLE — Bus quiet' },
      { aw: { ...defaultChannel }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { valid: true, ready: true, data: '0x2000', transferred: true }, r: { ...defaultChannel }, label: 'AR handshake — read address accepted' },
      { aw: { ...defaultChannel }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { valid: true, ready: true, data: 'D0', transferred: true }, label: 'R beat 0 — data returned' },
      { aw: { ...defaultChannel }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { valid: true, ready: true, data: 'D1 (RLAST)', transferred: true }, label: 'R beat 1 — final data with RLAST' },
    ],
  },
  {
    id: 'backpressure',
    name: 'Backpressure',
    description: 'The slave stalls the W channel while the read path proceeds independently.',
    cycles: [
      { aw: { ...defaultChannel }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'IDLE' },
      { aw: { valid: true, ready: true, data: '0x1000', transferred: true }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { valid: true, ready: true, data: '0x2000', transferred: true }, r: { ...defaultChannel }, label: 'AW + AR — both accepted simultaneously' },
      { aw: { ...defaultChannel }, w: { valid: true, ready: false, data: 'D0', transferred: false }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { valid: true, ready: true, data: 'R0', transferred: true }, label: 'W stalled (WREADY=0) — R proceeds independently!' },
      { aw: { ...defaultChannel }, w: { valid: true, ready: false, data: 'D0', transferred: false }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { valid: true, ready: true, data: 'R1 (RLAST)', transferred: true }, label: 'W still stalled — R completes with RLAST' },
      { aw: { ...defaultChannel }, w: { valid: true, ready: true, data: 'D0', transferred: true }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'W resumes — slave buffer freed' },
      { aw: { ...defaultChannel }, w: { valid: true, ready: true, data: 'D1 (WLAST)', transferred: true }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'W final beat with WLAST' },
      { aw: { ...defaultChannel }, w: { ...defaultChannel }, b: { valid: true, ready: true, data: 'OKAY', transferred: true }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'B response — write acknowledged' },
    ],
  },
  {
    id: 'valid_before_ready',
    name: 'VALID before READY',
    description: 'Demonstrates VALID assertion before READY — the sender must hold VALID and data stable.',
    cycles: [
      { aw: { ...defaultChannel }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'IDLE' },
      { aw: { valid: true, ready: false, data: '0x3000', transferred: false }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'AWVALID asserted — slave not ready yet' },
      { aw: { valid: true, ready: false, data: '0x3000', transferred: false }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'Master holds AWVALID + AWADDR stable (required!)' },
      { aw: { valid: true, ready: true, data: '0x3000', transferred: true }, w: { ...defaultChannel }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'AWREADY rises — handshake completes!' },
      { aw: { ...defaultChannel }, w: { valid: true, ready: true, data: 'D0 (WLAST)', transferred: true }, b: { ...defaultChannel }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'W data follows' },
      { aw: { ...defaultChannel }, w: { ...defaultChannel }, b: { valid: true, ready: true, data: 'OKAY', transferred: true }, ar: { ...defaultChannel }, r: { ...defaultChannel }, label: 'B response' },
    ],
  },
];

// ── Channel colors ──
const channelConfig = {
  aw: { label: 'AW', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dir: 'M → S' },
  w:  { label: 'W',  color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', dir: 'M → S' },
  b:  { label: 'B',  color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dir: 'S → M' },
  ar: { label: 'AR', color: 'from-amber-500 to-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dir: 'M → S' },
  r:  { label: 'R',  color: 'from-rose-500 to-rose-600', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', dir: 'S → M' },
};

type ChannelKey = keyof typeof channelConfig;

// ── Component ──

export default function AxiChannelHandshakeVisualizer() {
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

  // Auto-play
  React.useEffect(() => {
    if (!isPlaying) return;
    if (cycle >= maxCycle) { setIsPlaying(false); return; }
    const timer = setTimeout(stepForward, 1200);
    return () => clearTimeout(timer);
  }, [isPlaying, cycle, maxCycle, stepForward]);

  const handleScenarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setScenarioId(e.target.value);
    setCycle(0);
    setIsPlaying(false);
  };

  const renderChannelRow = (key: ChannelKey) => {
    const conf = channelConfig[key];
    const ch = currentState[key];

    return (
      <div key={key} className={`flex items-center gap-3 p-3 rounded-lg border ${conf.border} ${conf.bg} transition-all duration-300`}>
        {/* Channel label */}
        <div className="w-16 flex-shrink-0 text-center">
          <span className={`font-mono font-bold text-lg ${conf.text}`}>{conf.label}</span>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{conf.dir}</div>
        </div>

        {/* VALID indicator */}
        <div className="flex flex-col items-center w-16 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">VALID</span>
          <motion.div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              ch.valid ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-slate-700 text-slate-500'
            }`}
            animate={{ scale: ch.valid ? [1, 1.15, 1] : 1 }}
            transition={{ duration: 0.3 }}
          >
            {ch.valid ? '1' : '0'}
          </motion.div>
        </div>

        {/* READY indicator */}
        <div className="flex flex-col items-center w-16 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">READY</span>
          <motion.div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              ch.ready ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-slate-700 text-slate-500'
            }`}
            animate={{ scale: ch.ready ? [1, 1.15, 1] : 1 }}
            transition={{ duration: 0.3 }}
          >
            {ch.ready ? '1' : '0'}
          </motion.div>
        </div>

        {/* Data / Payload */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {ch.data ? (
              <motion.div
                key={`${key}-${cycle}-${ch.data}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`px-3 py-1.5 rounded font-mono text-sm truncate ${
                  ch.transferred
                    ? `bg-gradient-to-r ${conf.color} text-white shadow-md`
                    : `border ${conf.border} ${conf.text}`
                }`}
              >
                {ch.data}
              </motion.div>
            ) : (
              <motion.div
                key={`${key}-${cycle}-idle`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                className="px-3 py-1.5 text-slate-600 dark:text-slate-500 text-sm italic"
              >
                —
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Transfer status */}
        <div className="w-20 flex-shrink-0 text-center">
          {ch.valid && ch.ready && ch.transferred ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-block px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold"
            >
              ✓ XFER
            </motion.span>
          ) : ch.valid && !ch.ready ? (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="inline-block px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold"
            >
              WAIT
            </motion.span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden" data-testid="axi-channel-handshake-visualizer">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">AXI Channel Handshake Visualizer</h3>
        <select
          value={scenarioId}
          onChange={handleScenarioChange}
          className="bg-slate-700 text-slate-200 text-sm rounded px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {scenarios.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="px-4 py-2 text-sm text-slate-400 bg-slate-800/30 border-b border-slate-700/50">
        {scenario.description}
      </div>

      {/* Channel rows */}
      <div className="p-4 space-y-2">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-semibold">Write Path</div>
        {renderChannelRow('aw')}
        {renderChannelRow('w')}
        {renderChannelRow('b')}
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 mt-4 font-semibold">Read Path</div>
        {renderChannelRow('ar')}
        {renderChannelRow('r')}
      </div>

      {/* Status bar */}
      <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-slate-500">Cycle {cycle}</span>
          <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
              animate={{ width: `${maxCycle > 0 ? (cycle / maxCycle) * 100 : 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs font-mono text-slate-500">Cycle {maxCycle}</span>
        </div>
        <p className="text-sm text-slate-300 font-medium">{currentState.label}</p>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 bg-slate-800/30 border-t border-slate-700 flex items-center justify-center gap-2">
        <button onClick={reset} title="Reset" aria-label="Reset simulation" className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
          <RotateCcw size={16} />
        </button>
        <button onClick={stepBackward} title="Step Backward" aria-label="Step Backward" disabled={cycle <= 0} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <SkipBack size={16} />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={cycle >= maxCycle}
          title={isPlaying ? "Pause" : "Play"}
          aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
          className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:text-slate-400 text-white font-bold flex items-center justify-center gap-2 transition-colors w-32"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={stepForward} title="Step Forward" aria-label="Step Forward" disabled={cycle >= maxCycle} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
}
