'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

// ── Types ──

interface BurstConfig {
  startAddr: number;
  axlen: number;
  axsize: number;
  axburst: number; // 0=FIXED, 1=INCR, 2=WRAP
}

interface BeatResult {
  beat: number;
  address: number;
  wstrb: number;
  crossesBoundary: boolean;
  wrapped: boolean;
}

// ── Burst math engine ──

function computeBeats(cfg: BurstConfig, busWidth: number): BeatResult[] {
  const numBeats = cfg.axlen + 1;
  const bytesPerBeat = 1 << cfg.axsize;
  const busBytes = busWidth / 8;
  const results: BeatResult[] = [];

  // Wrap boundary for WRAP bursts
  const wrapBoundary = numBeats * bytesPerBeat;
  const lowerWrap = Math.floor(cfg.startAddr / wrapBoundary) * wrapBoundary;

  for (let i = 0; i < numBeats; i++) {
    let addr: number;
    let wrapped = false;

    if (cfg.axburst === 0) {
      // FIXED
      addr = cfg.startAddr;
    } else if (cfg.axburst === 1) {
      // INCR
      addr = cfg.startAddr + i * bytesPerBeat;
    } else {
      // WRAP
      addr = cfg.startAddr + i * bytesPerBeat;
      if (addr >= lowerWrap + wrapBoundary) {
        addr = lowerWrap + (addr - lowerWrap - wrapBoundary);
        wrapped = true;
      }
    }

    // WSTRB calculation
    const startLane = (addr % busBytes);
    let wstrb = 0;
    for (let b = 0; b < bytesPerBeat && (startLane + b) < busBytes; b++) {
      wstrb |= (1 << (startLane + b));
    }

    // 4KB boundary check
    const startPage = Math.floor(cfg.startAddr / 4096);
    const thisPage = Math.floor(addr / 4096);
    const crossesBoundary = thisPage !== startPage;

    results.push({ beat: i, address: addr, wstrb, crossesBoundary, wrapped });
  }

  return results;
}

function formatHex(n: number, width: number = 8): string {
  return '0x' + n.toString(16).toUpperCase().padStart(width, '0');
}

function formatWstrb(wstrb: number, busBytes: number): string {
  return wstrb.toString(2).padStart(busBytes, '0').split('').reverse().join('');
}

// ── Presets ──

const presets = [
  { name: 'Basic INCR4 (32-bit)', config: { startAddr: 0x1000, axlen: 3, axsize: 2, axburst: 1 } },
  { name: 'WRAP4 Cache Fill', config: { startAddr: 0x1004, axlen: 3, axsize: 2, axburst: 2 } },
  { name: 'Narrow Transfer (16-bit on 32-bit bus)', config: { startAddr: 0x1000, axlen: 3, axsize: 1, axburst: 1 } },
  { name: '4KB Boundary Crossing!', config: { startAddr: 0x0FF4, axlen: 7, axsize: 2, axburst: 1 } },
  { name: 'FIXED (FIFO access)', config: { startAddr: 0x2000, axlen: 3, axsize: 2, axburst: 0 } },
  { name: 'Unaligned Start', config: { startAddr: 0x1003, axlen: 3, axsize: 2, axburst: 1 } },
];

const burstTypeNames = ['FIXED', 'INCR', 'WRAP'];
const sizeOptions = [
  { value: 0, label: '1 byte' },
  { value: 1, label: '2 bytes' },
  { value: 2, label: '4 bytes (32-bit)' },
  { value: 3, label: '8 bytes (64-bit)' },
];

// ── Component ──

export default function AxiMemoryMathVisualizer() {
  const [config, setConfig] = useState<BurstConfig>(presets[0].config);
  const [busWidth, setBusWidth] = useState(32);
  const [selectedBeat, setSelectedBeat] = useState<number | null>(null);

  const busBytes = busWidth / 8;
  const beats = useMemo(() => computeBeats(config, busWidth), [config, busWidth]);
  const totalBytes = (config.axlen + 1) * (1 << config.axsize);
  const has4KBViolation = beats.some(b => b.crossesBoundary);
  const isAligned = (config.startAddr % (1 << config.axsize)) === 0;

  const reset = useCallback(() => {
    setConfig(presets[0].config);
    setSelectedBeat(null);
  }, []);

  const applyPreset = (idx: number) => {
    setConfig(presets[idx].config);
    setSelectedBeat(null);
  };

  // 4KB page visualization
  const startPage = Math.floor(config.startAddr / 4096) * 4096;
  const pageEnd = startPage + 4096;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">AXI Burst Memory Math</h3>
        <button onClick={reset} title="Reset" className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Presets */}
      <div className="px-4 py-2 border-b border-slate-700/50 flex flex-wrap gap-1.5">
        {presets.map((p, i) => (
          <button
            key={i}
            onClick={() => applyPreset(i)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              JSON.stringify(config) === JSON.stringify(p.config)
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-0">
        {/* Left: Controls */}
        <div className="p-4 border-b lg:border-b-0 lg:border-r border-slate-700/50">
          <div className="space-y-3">
            {/* Start Address */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Start Address (hex)</label>
              <input
                type="text"
                value={formatHex(config.startAddr)}
                onChange={(e) => {
                  const v = parseInt(e.target.value.replace('0x', ''), 16);
                  if (!isNaN(v)) setConfig(c => ({ ...c, startAddr: v }));
                }}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* AxLEN */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">AxLEN (beats = {config.axlen + 1})</label>
              <input
                type="range"
                min={0}
                max={15}
                value={config.axlen}
                onChange={(e) => setConfig(c => ({ ...c, axlen: parseInt(e.target.value) }))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0 (1 beat)</span><span>15 (16 beats)</span>
              </div>
            </div>

            {/* AxSIZE */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">AxSIZE</label>
              <select
                value={config.axsize}
                onChange={(e) => setConfig(c => ({ ...c, axsize: parseInt(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {sizeOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* AxBURST */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">AxBURST</label>
              <div className="flex gap-2">
                {burstTypeNames.map((name, i) => (
                  <button
                    key={name}
                    onClick={() => setConfig(c => ({ ...c, axburst: i }))}
                    className={`flex-1 text-xs py-1.5 rounded transition-colors font-medium ${
                      config.axburst === i
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Bus Width */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data Bus Width</label>
              <div className="flex gap-2">
                {[32, 64].map(w => (
                  <button
                    key={w}
                    onClick={() => setBusWidth(w)}
                    className={`flex-1 text-xs py-1.5 rounded transition-colors font-medium ${
                      busWidth === w
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {w}-bit
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
              Total: {totalBytes} bytes
            </span>
            {!isAligned && (
              <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 font-medium">
                ⚠ Unaligned
              </span>
            )}
            {has4KBViolation && (
              <motion.span
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 font-bold"
              >
                ✗ 4KB VIOLATION
              </motion.span>
            )}
            {!has4KBViolation && (
              <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 font-medium">
                ✓ 4KB OK
              </span>
            )}
          </div>
        </div>

        {/* Right: Beat table */}
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700">
                <th className="py-1.5 px-2 text-left">Beat</th>
                <th className="py-1.5 px-2 text-left">Address</th>
                <th className="py-1.5 px-2 text-left">WSTRB</th>
                <th className="py-1.5 px-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {beats.map((beat) => (
                  <motion.tr
                    key={`${beat.beat}-${beat.address}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: beat.beat * 0.05 }}
                    onClick={() => setSelectedBeat(beat.beat === selectedBeat ? null : beat.beat)}
                    className={`border-b border-slate-800 cursor-pointer transition-colors ${
                      beat.crossesBoundary
                        ? 'bg-red-500/10 hover:bg-red-500/20'
                        : selectedBeat === beat.beat
                        ? 'bg-blue-500/15'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-1.5 px-2 font-mono text-slate-300">{beat.beat}</td>
                    <td className="py-1.5 px-2 font-mono text-slate-200">{formatHex(beat.address)}</td>
                    <td className="py-1.5 px-2">
                      {/* WSTRB visual */}
                      <div className="flex gap-0.5">
                        {Array.from({ length: busBytes }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-5 h-5 rounded text-[10px] flex items-center justify-center font-mono ${
                              (beat.wstrb >> i) & 1
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-700 text-slate-500'
                            }`}
                          >
                            {(beat.wstrb >> i) & 1}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      {beat.crossesBoundary && (
                        <span className="text-xs text-red-400 font-bold">4KB ✗</span>
                      )}
                      {beat.wrapped && (
                        <span className="text-xs text-amber-400 font-bold">WRAP</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>

          {/* 4KB page bar visualization */}
          <div className="mt-4">
            <div className="text-xs text-slate-400 mb-1">4 KB Page: {formatHex(startPage)} – {formatHex(pageEnd - 1)}</div>
            <div className="h-6 bg-slate-800 rounded-full overflow-hidden relative border border-slate-700">
              {beats.map((beat) => {
                const offset = beat.address - startPage;
                const leftPct = Math.max(0, Math.min(100, (offset / 4096) * 100));
                const widthPct = Math.max(0.5, ((1 << config.axsize) / 4096) * 100);
                return (
                  <motion.div
                    key={beat.beat}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`absolute top-0 h-full rounded-sm ${
                      beat.crossesBoundary ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`Beat ${beat.beat}: ${formatHex(beat.address)}`}
                  />
                );
              })}
              {/* 4KB boundary marker */}
              <div className="absolute top-0 right-0 h-full w-px bg-red-400/50" title="4KB boundary" />
            </div>
          </div>
        </div>
      </div>

      {/* Selected beat detail */}
      <AnimatePresence>
        {selectedBeat !== null && beats[selectedBeat] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700 bg-slate-800/30 px-4 py-3 overflow-hidden"
          >
            <div className="text-sm text-slate-300">
              <span className="font-semibold text-white">Beat {selectedBeat}:</span>{' '}
              Address = <span className="font-mono text-blue-400">{formatHex(beats[selectedBeat].address)}</span>,{' '}
              WSTRB = <span className="font-mono text-emerald-400">{formatWstrb(beats[selectedBeat].wstrb, busBytes)}</span>,{' '}
              Byte lanes {Array.from({ length: busBytes }).filter((_, i) => (beats[selectedBeat].wstrb >> i) & 1).map((_,i) => i).join(', ')} active
              {beats[selectedBeat].wrapped && <span className="text-amber-400 ml-2">(wrapped)</span>}
              {beats[selectedBeat].crossesBoundary && <span className="text-red-400 ml-2">(crosses 4KB!)</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
