'use client';

import React, { useState, useCallback, useMemo } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type BurstType = 'SINGLE' | 'INCR' | 'WRAP4' | 'WRAP8';
type BridgeDirection = 'ahb-to-axi' | 'axi-to-ahb';

interface AhbTransaction {
  addr: number;
  beats: number;
  size: number; // bytes per beat
  burstType: BurstType;
  write: boolean;
}

interface AxiBurst {
  addr: number;
  len: number; // AWLEN = beats - 1
  size: number;
  burstType: string;
  label: string;
  crossesBoundary: boolean;
}

interface TranslationResult {
  ahb: AhbTransaction;
  axiBursts: AxiBurst[];
  splitReason: string | null;
  totalAhbBytes: number;
  totalAxiBytes: number;
}

/* ------------------------------------------------------------------ */
/*  Scenarios                                                          */
/* ------------------------------------------------------------------ */

const SCENARIOS: { label: string; desc: string; ahb: AhbTransaction }[] = [
  {
    label: 'Simple Write (No Split)',
    desc: 'A 4-beat INCR write starting at an aligned address — fits within a single 4KB page.',
    ahb: { addr: 0x1000, beats: 4, size: 4, burstType: 'INCR', write: true },
  },
  {
    label: '4KB Boundary Split',
    desc: 'An 8-beat INCR write starting at 0x0FF0 crosses the 0x1000 boundary and must be split into two AXI bursts.',
    ahb: { addr: 0x0ff0, beats: 8, size: 4, burstType: 'INCR', write: true },
  },
  {
    label: 'Large Burst (16 beats)',
    desc: 'A 16-beat INCR read starting at 0x0F80 crosses the 4KB boundary at beat 8.',
    ahb: { addr: 0x0f80, beats: 16, size: 8, burstType: 'INCR', write: false },
  },
  {
    label: 'WRAP8 Burst',
    desc: 'An 8-beat WRAP burst starting at 0x1010 — wraps within its aligned boundary.',
    ahb: { addr: 0x1010, beats: 8, size: 4, burstType: 'WRAP8', write: false },
  },
  {
    label: 'Single Beat Transfer',
    desc: 'A single-beat write — no splitting needed, maps directly to a single AXI beat.',
    ahb: { addr: 0x2004, beats: 1, size: 4, burstType: 'SINGLE', write: true },
  },
  {
    label: 'Boundary-Aligned Start',
    desc: 'A burst starting exactly at a 4KB boundary (0x2000) — no split required.',
    ahb: { addr: 0x2000, beats: 8, size: 4, burstType: 'INCR', write: false },
  },
];

/* ------------------------------------------------------------------ */
/*  Translation Engine                                                 */
/* ------------------------------------------------------------------ */

function translate(ahb: AhbTransaction): TranslationResult {
  const totalBytes = ahb.beats * ahb.size;
  const endAddr = ahb.addr + totalBytes - 1;
  const startPage = ahb.addr & 0xfffff000;
  const endPage = endAddr & 0xfffff000;

  if (ahb.burstType === 'SINGLE' || ahb.beats === 1) {
    return {
      ahb,
      axiBursts: [{
        addr: ahb.addr,
        len: 0,
        size: ahb.size,
        burstType: 'INCR',
        label: 'AXI Burst 1 (single)',
        crossesBoundary: false,
      }],
      splitReason: null,
      totalAhbBytes: totalBytes,
      totalAxiBytes: ahb.size,
    };
  }

  if (ahb.burstType.startsWith('WRAP')) {
    // WRAP bursts don't cross boundaries by definition (they wrap)
    const wrapLen = parseInt(ahb.burstType.replace('WRAP', ''));
    return {
      ahb,
      axiBursts: [{
        addr: ahb.addr,
        len: wrapLen - 1,
        size: ahb.size,
        burstType: `WRAP (${wrapLen} beats)`,
        label: 'AXI Burst 1 (WRAP)',
        crossesBoundary: false,
      }],
      splitReason: null,
      totalAhbBytes: totalBytes,
      totalAxiBytes: wrapLen * ahb.size,
    };
  }

  // INCR burst — check 4KB boundary
  if (startPage !== endPage) {
    const boundary = startPage + 0x1000;
    const bytesToBoundary = boundary - ahb.addr;
    const beatsBeforeBoundary = Math.floor(bytesToBoundary / ahb.size);
    const beatsAfterBoundary = ahb.beats - beatsBeforeBoundary;

    const bursts: AxiBurst[] = [];

    if (beatsBeforeBoundary > 0) {
      bursts.push({
        addr: ahb.addr,
        len: beatsBeforeBoundary - 1,
        size: ahb.size,
        burstType: 'INCR',
        label: `AXI Burst 1 (${beatsBeforeBoundary} beats)`,
        crossesBoundary: false,
      });
    }

    if (beatsAfterBoundary > 0) {
      bursts.push({
        addr: boundary,
        len: beatsAfterBoundary - 1,
        size: ahb.size,
        burstType: 'INCR',
        label: `AXI Burst 2 (${beatsAfterBoundary} beats)`,
        crossesBoundary: false,
      });
    }

    return {
      ahb,
      axiBursts: bursts,
      splitReason: `Crosses 4KB boundary at 0x${boundary.toString(16).toUpperCase()}`,
      totalAhbBytes: totalBytes,
      totalAxiBytes: totalBytes,
    };
  }

  // No split needed
  return {
    ahb,
    axiBursts: [{
      addr: ahb.addr,
      len: ahb.beats - 1,
      size: ahb.size,
      burstType: 'INCR',
      label: `AXI Burst 1 (${ahb.beats} beats)`,
      crossesBoundary: false,
    }],
    splitReason: null,
    totalAhbBytes: totalBytes,
    totalAxiBytes: totalBytes,
  };
}

/* ------------------------------------------------------------------ */
/*  Sub-Components                                                     */
/* ------------------------------------------------------------------ */

function HexAddr({ value }: { value: number }) {
  return (
    <span className="font-mono text-sm font-semibold text-amber-300">
      0x{value.toString(16).toUpperCase().padStart(8, '0')}
    </span>
  );
}

function MemoryMap({ result }: { result: TranslationResult }) {
  const { ahb, axiBursts } = result;
  const totalBytes = ahb.beats * ahb.size;
  const startAddr = ahb.addr;
  const endAddr = startAddr + totalBytes - 1;

  // Calculate the 4KB boundary in the range
  const startPage = startAddr & 0xfffff000;
  const boundary = startPage + 0x1000;
  const hasBoundary = boundary > startAddr && boundary <= endAddr;

  const mapWidth = 100; // percentage

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Memory Map
      </p>

      {/* Address range bar */}
      <div className="relative h-12 rounded-lg bg-slate-800 overflow-hidden">
        {axiBursts.map((burst, i) => {
          const burstStart = burst.addr;
          const burstBytes = (burst.len + 1) * burst.size;
          const leftPct = ((burstStart - startAddr) / totalBytes) * mapWidth;
          const widthPct = (burstBytes / totalBytes) * mapWidth;
          const colors = i === 0
            ? 'bg-gradient-to-r from-blue-500/80 to-blue-600/80 border-blue-400/50'
            : 'bg-gradient-to-r from-emerald-500/80 to-emerald-600/80 border-emerald-400/50';

          return (
            <div
              key={i}
              className={`absolute top-1 bottom-1 rounded-md border ${colors} flex items-center justify-center`}
              style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 5)}%` }}
            >
              <span className="text-[10px] font-bold text-white/90 truncate px-1">
                Burst {i + 1}
              </span>
            </div>
          );
        })}

        {/* 4KB boundary marker */}
        {hasBoundary && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{ left: `${((boundary - startAddr) / totalBytes) * mapWidth}%` }}
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
              4KB: 0x{boundary.toString(16).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* Address labels */}
      <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-500">
        <span>0x{startAddr.toString(16).toUpperCase()}</span>
        <span>0x{endAddr.toString(16).toUpperCase()}</span>
      </div>
    </div>
  );
}

function BurstCard({ burst, index }: { burst: AxiBurst; index: number }) {
  const beats = burst.len + 1;
  const totalBytes = beats * burst.size;
  const endAddr = burst.addr + totalBytes - 1;
  const isFirst = index === 0;

  return (
    <div className={`rounded-xl border p-4 ${
      isFirst
        ? 'border-blue-500/30 bg-blue-500/5'
        : 'border-emerald-500/30 bg-emerald-500/5'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-3 w-3 rounded-full ${isFirst ? 'bg-blue-400' : 'bg-emerald-400'}`} />
        <span className="text-sm font-bold text-slate-200">{burst.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-slate-500">AWADDR:</span>{' '}
          <HexAddr value={burst.addr} />
        </div>
        <div>
          <span className="text-slate-500">End:</span>{' '}
          <HexAddr value={endAddr} />
        </div>
        <div>
          <span className="text-slate-500">AWLEN:</span>{' '}
          <span className="font-mono text-sm font-semibold text-cyan-300">{burst.len}</span>
          <span className="text-slate-500 ml-1">({beats} beat{beats > 1 ? 's' : ''})</span>
        </div>
        <div>
          <span className="text-slate-500">AWSIZE:</span>{' '}
          <span className="font-mono text-sm font-semibold text-cyan-300">
            {Math.log2(burst.size)}
          </span>
          <span className="text-slate-500 ml-1">({burst.size}B)</span>
        </div>
        <div>
          <span className="text-slate-500">Type:</span>{' '}
          <span className="text-sm font-semibold text-purple-300">{burst.burstType}</span>
        </div>
        <div>
          <span className="text-slate-500">Bytes:</span>{' '}
          <span className="font-mono text-sm font-semibold text-orange-300">{totalBytes}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function BridgeTranslationExplorer() {
  const [scenarioIndex, setScenarioIndex] = useState(1); // Start on the 4KB split scenario
  const [animStep, setAnimStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const scenario = SCENARIOS[scenarioIndex];
  const result = useMemo(() => translate(scenario.ahb), [scenario.ahb]);

  const resetAnim = useCallback(() => {
    setAnimStep(0);
    setIsAnimating(false);
  }, []);

  const handleScenarioChange = useCallback((idx: number) => {
    setScenarioIndex(idx);
    resetAnim();
  }, [resetAnim]);

  const animSteps = useMemo(() => {
    const steps: string[] = [];
    const { ahb, axiBursts, splitReason } = result;
    
    steps.push(`AHB Master issues ${ahb.burstType} ${ahb.write ? 'WRITE' : 'READ'}: ${ahb.beats} beats × ${ahb.size}B at 0x${ahb.addr.toString(16).toUpperCase()}`);
    steps.push(`Bridge receives AHB address phase: HADDR=0x${ahb.addr.toString(16).toUpperCase()}, HTRANS=NONSEQ, HBURST=${ahb.burstType}`);

    if (splitReason) {
      steps.push(`⚠️ Bridge detects 4KB boundary crossing! ${splitReason}`);
      steps.push(`Bridge splits into ${axiBursts.length} AXI burst${axiBursts.length > 1 ? 's' : ''}`);
    } else {
      steps.push(`✓ No 4KB boundary crossing — direct translation`);
    }

    axiBursts.forEach((burst, i) => {
      steps.push(`Bridge issues AXI Burst ${i + 1}: AWADDR=0x${burst.addr.toString(16).toUpperCase()}, AWLEN=${burst.len}, ${burst.burstType}`);
    });

    steps.push(`✓ Translation complete — ${result.totalAhbBytes} AHB bytes → ${result.totalAxiBytes} AXI bytes`);
    return steps;
  }, [result]);

  const handleAnimate = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setAnimStep(0);

    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      if (step >= animSteps.length) {
        clearInterval(timer);
        setIsAnimating(false);
        setAnimStep(animSteps.length - 1);
      } else {
        setAnimStep(step);
      }
    }, 1200);
  }, [isAnimating, animSteps.length]);

  return (
    <div className="space-y-5" data-testid="bridge-translation-explorer">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-slate-100">
          Bridge Translation Explorer
        </h3>
        <p className="text-sm text-slate-400">
          See how an AHB-to-AXI bridge translates burst requests, including 4KB boundary splitting.
        </p>
      </div>

      {/* Scenario Selector */}
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s, i) => (
          <button
            key={i}
            onClick={() => handleScenarioChange(i)}
            data-testid={`scenario-btn-${i}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              i === scenarioIndex
                ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/50'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="rounded-lg bg-slate-800/50 px-4 py-2.5 text-sm text-slate-300 border border-white/5">
        {scenario.desc}
      </p>

      {/* AHB Input Card */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3 w-3 rounded-full bg-violet-400" />
          <span className="text-sm font-bold text-slate-200">AHB Transaction (Input)</span>
          <span className="ml-auto rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300 uppercase">
            {scenario.ahb.write ? 'Write' : 'Read'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <span className="text-slate-500">HADDR:</span>{' '}
            <HexAddr value={scenario.ahb.addr} />
          </div>
          <div>
            <span className="text-slate-500">Beats:</span>{' '}
            <span className="font-mono text-sm font-semibold text-cyan-300">{scenario.ahb.beats}</span>
          </div>
          <div>
            <span className="text-slate-500">Size:</span>{' '}
            <span className="font-mono text-sm font-semibold text-cyan-300">{scenario.ahb.size}B</span>
          </div>
          <div>
            <span className="text-slate-500">HBURST:</span>{' '}
            <span className="text-sm font-semibold text-purple-300">{scenario.ahb.burstType}</span>
          </div>
        </div>
      </div>

      {/* Arrow + Split Indicator */}
      <div className="flex items-center justify-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
        <div className={`rounded-full px-4 py-1.5 text-xs font-bold ${
          result.splitReason
            ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
            : 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30'
        }`}>
          {result.splitReason
            ? `⚠ SPLIT: ${result.splitReason}`
            : '✓ Direct Translation (no split)'
          }
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
      </div>

      {/* AXI Output Cards */}
      <div className="grid gap-3 sm:grid-cols-2" data-testid="axi-bursts-container">
        {result.axiBursts.map((burst, i) => (
          <BurstCard key={i} burst={burst} index={i} />
        ))}
      </div>

      {/* Memory Map */}
      <MemoryMap result={result} />

      {/* Animation Panel */}
      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Step-by-Step Translation
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleAnimate}
              disabled={isAnimating}
              data-testid="animate-btn"
              className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/30 disabled:opacity-50"
            >
              {isAnimating ? 'Animating…' : '▶ Animate'}
            </button>
            <button
              onClick={resetAnim}
              data-testid="reset-btn"
              className="rounded-lg bg-white/5 px-3 py-1 text-xs font-semibold text-slate-400 transition hover:bg-white/10"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="space-y-1.5 font-mono text-xs" data-testid="anim-log">
          {animSteps.map((step, i) => (
            <div
              key={i}
              className={`rounded px-2 py-1 transition-all duration-300 ${
                i <= animStep
                  ? step.startsWith('⚠')
                    ? 'bg-red-500/10 text-red-300'
                    : step.startsWith('✓')
                    ? 'bg-green-500/10 text-green-300'
                    : 'bg-white/5 text-slate-300'
                  : 'text-slate-600'
              }`}
            >
              <span className="text-slate-500 mr-2">[{i + 1}]</span>
              {step}
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-white/5 bg-white/5 p-3">
          <div className="text-2xl font-bold text-violet-300">{result.ahb.beats}</div>
          <div className="text-[10px] font-semibold uppercase text-slate-500">AHB Beats</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/5 p-3">
          <div className="text-2xl font-bold text-blue-300">{result.axiBursts.length}</div>
          <div className="text-[10px] font-semibold uppercase text-slate-500">AXI Bursts</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/5 p-3">
          <div className="text-2xl font-bold text-orange-300">{result.totalAhbBytes}B</div>
          <div className="text-[10px] font-semibold uppercase text-slate-500">Total Data</div>
        </div>
      </div>
    </div>
  );
}

export default BridgeTranslationExplorer;
