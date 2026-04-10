"use client";

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Square, Calculator, Info } from 'lucide-react';

const CONSTRAINTS = [
  { id: 'c1', label: 'addr inside {[0:3]}', eq: (a: number, d: number) => a >= 0 && a <= 3 },
  { id: 'c2', label: 'data % 2 == 0', eq: (a: number, d: number) => d % 2 === 0 },
  { id: 'c3', label: 'addr + data < 100', eq: (a: number, d: number) => a + d < 100 },
  { id: 'c4', label: 'data > 200', eq: (a: number, d: number) => d > 200 },
];

export const ConstraintSolverHeatmapVisualizer = () => {
  const [activeConstraints, setActiveConstraints] = useState<Record<string, boolean>>({
    c1: false,
    c2: false,
    c3: false,
    c4: false,
  });

  const toggleConstraint = (id: string) => {
    setActiveConstraints(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Run solver simulation
  const { grid, addrMarginal, totalValid, maxCellCount, maxMarginalCount } = useMemo(() => {
    // 16x16 grid downsampled.
    // grid[x = addr][y = dataBin] -> count
    const newGrid = Array(16).fill(0).map(() => Array(16).fill(0));
    const newAddrMarginal = Array(16).fill(0);
    let validCount = 0;
    let newMaxCellCount = 0;

    for (let addr = 0; addr < 16; addr++) {
      for (let data = 0; data < 256; data++) {
        let isValid = true;
        
        for (const constraint of CONSTRAINTS) {
          if (activeConstraints[constraint.id]) {
            if (!constraint.eq(addr, data)) {
              isValid = false;
              break;
            }
          }
        }

        if (isValid) {
          validCount++;
          const dataBin = Math.floor(data / 16);
          newGrid[addr][dataBin]++;
          newAddrMarginal[addr]++;
        }
      }
    }

    for (let addr = 0; addr < 16; addr++) {
      for (let dataBin = 0; dataBin < 16; dataBin++) {
        if (newGrid[addr][dataBin] > newMaxCellCount) {
          newMaxCellCount = newGrid[addr][dataBin];
        }
      }
    }

    const newMaxMarginalCount = Math.max(...newAddrMarginal);

    return {
      grid: newGrid,
      addrMarginal: newAddrMarginal,
      totalValid: validCount,
      maxCellCount: newMaxCellCount,
      maxMarginalCount: newMaxMarginalCount
    };
  }, [activeConstraints]);

  return (
    <div className="w-full rounded-2xl border border-border/50 bg-card p-6 shadow-sm flex flex-col md:flex-row gap-8">
      {/* Constraints Editor Panel */}
      <div className="w-full md:w-1/3 flex flex-col gap-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
            <Calculator className="w-5 h-5 text-primary" />
            Constraint Editor
          </h3>
          <p className="text-sm text-muted-foreground">
            Toggle constraints and observe how the probability space skews. In SystemVerilog, all valid combinations are equally likely unless explicitly weighted.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-foreground/80 border-b border-border/50 pb-2">
            Variables: <code className="text-xs bg-muted px-1 py-0.5 rounded text-blue-400">addr [0:15]</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded text-green-400">data [0:255]</code>
          </div>
          {CONSTRAINTS.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleConstraint(c.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                activeConstraints[c.id] 
                  ? 'bg-primary/10 border-primary text-primary' 
                  : 'bg-card border-border/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {activeConstraints[c.id] ? (
                <CheckSquare className="w-5 h-5 shrink-0" />
              ) : (
                <Square className="w-5 h-5 shrink-0" />
              )}
              <code className="text-sm font-mono">{c.label}</code>
            </button>
          ))}
        </div>

        <div className={`p-4 rounded-xl border ${totalValid === 0 ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/30 border-border/50'}`}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Solver Status</div>
          <div className="flex items-end justify-between">
            <div>
              <div className={`text-2xl font-bold ${totalValid === 0 ? 'text-destructive' : 'text-foreground'}`}>
                {totalValid} <span className="text-sm font-normal text-muted-foreground">/ 4096</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Valid Solutions</div>
            </div>
          </div>
          {totalValid === 0 && (
            <div className="flex items-start gap-2 mt-3 text-sm text-destructive bg-destructive/10 p-2 rounded-lg">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Constraint contradiction! <code>randomize()</code> would return 0.</p>
            </div>
          )}
        </div>
      </div>

      {/* Visualization Panel */}
      <div className="w-full md:w-2/3 flex flex-col items-center">
        <h3 className="text-lg font-bold mb-6 text-center">Randomization State Space Heatmap</h3>
        
        {/* Heatmap Grid */}
        <div className="relative">
          {/* Y Axis Label */}
          <div className="absolute -left-12 top-0 bottom-0 flex items-center justify-center">
            <div className="transform -rotate-90 text-sm font-semibold text-green-400/80 whitespace-nowrap">
              data [0:255]
            </div>
          </div>

          <div className="grid grid-cols-16 gap-[1px] bg-border p-[1px] rounded border border-border">
            {/* Render 16x16. We'll map dataBin=15 to top row, dataBin=0 to bottom row to follow standard positive Y UP */}
            {Array.from({ length: 16 }).map((_, rIndex) => {
              const dataBin = 15 - rIndex;
              return Array.from({ length: 16 }).map((_, addr) => {
                const count = grid[addr][dataBin];
                const opacity = maxCellCount > 0 ? (count / maxCellCount) : 0;
                
                return (
                  <motion.div
                    key={`${addr}-${dataBin}`}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="w-5 h-5 sm:w-6 sm:h-6 md:w-5 md:h-5 lg:w-7 lg:h-7 relative group"
                    style={{
                      backgroundColor: count > 0 
                        ? `hsla(var(--primary), ${opacity * 0.8 + 0.1})` 
                        : 'transparent',
                    }}
                  >
                    {!count && (
                      <div className="absolute inset-0 bg-muted/20" />
                    )}
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-max bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg border border-border">
                      <div>addr: <code>{addr}</code></div>
                      <div>data: <code>[{dataBin * 16} : {dataBin * 16 + 15}]</code></div>
                      <div className="font-bold text-accent mt-1">Hits: {count}</div>
                    </div>
                  </motion.div>
                );
              });
            })}
          </div>

          {/* X Axis Label */}
          <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground w-full">
            <span className="font-mono">0</span>
            <span className="font-semibold text-blue-400/80">addr [0:15]</span>
            <span className="font-mono">15</span>
          </div>
        </div>

        {/* Marginal Distribution Chart */}
        <div className="w-full mt-8 flex flex-col items-center">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2">
            Marginal Distribution (Probability of <code className="text-blue-400">addr</code>)
          </div>
          <div className="flex items-end gap-[1px] h-24 w-full max-w-[28rem] px-8 sm:px-6 md:px-0 lg:px-8 border-b border-border">
            {addrMarginal.map((count, addr) => {
              const heightPercent = maxMarginalCount > 0 ? (count / maxMarginalCount) * 100 : 0;
              const probPercent = totalValid > 0 ? ((count / totalValid) * 100).toFixed(1) : '0.0';
              
              return (
                <div key={addr} className="flex-1 group relative flex justify-center">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPercent}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="w-full bg-blue-500/60 rounded-t-sm"
                  />
                  <div className="absolute top-full mt-1 text-[10px] text-muted-foreground hidden lg:block font-mono">
                    {addr}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg border border-border whitespace-nowrap">
                    addr <code>{addr}</code>: <strong>{probPercent}%</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
