"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Play, FastForward, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type AddrBin = "low" | "mid" | "high";
type OpBin = "READ" | "WRITE" | "BURST";

interface CrossBin {
  addr: AddrBin;
  op: OpBin;
  hitCount: number;
  isIgnored: boolean;
}

const ADDR_BINS: AddrBin[] = ["low", "mid", "high"];
const OP_BINS: OpBin[] = ["READ", "WRITE", "BURST"];

export const CoverageCrossExplorerVisualizer: React.FC = () => {
  const [bins, setBins] = useState<CrossBin[]>(() => {
    const initialBins: CrossBin[] = [];
    ADDR_BINS.forEach((addr) => {
      OP_BINS.forEach((op) => {
        initialBins.push({ addr, op, hitCount: 0, isIgnored: false });
      });
    });
    return initialBins;
  });

  const [transactionCount, setTransactionCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const activeBins = bins.filter(b => !b.isIgnored);
  const hitActiveBins = activeBins.filter(b => b.hitCount > 0);
  const coveragePercentage = activeBins.length > 0 
    ? Math.round((hitActiveBins.length / activeBins.length) * 100) 
    : 100;

  const resetCoverage = () => {
    setBins(prev => prev.map(b => ({ ...b, hitCount: 0 })));
    setTransactionCount(0);
    setIsRunning(false);
  };

  const simulateTransactions = useCallback((count: number) => {
    const transactions = Array.from({ length: count }, () => ({
      addr: ADDR_BINS[Math.floor(Math.random() * ADDR_BINS.length)],
      op: OP_BINS[Math.floor(Math.random() * OP_BINS.length)],
    }));

    setBins(prevBins => {
      const newBins = [...prevBins];

      transactions.forEach(({ addr, op }) => {
        const binIndex = newBins.findIndex(b => b.addr === addr && b.op === op);
        if (binIndex !== -1) {
          newBins[binIndex] = { ...newBins[binIndex], hitCount: newBins[binIndex].hitCount + 1 };
        }
      });

      return newBins;
    });
    setTransactionCount(prev => prev + count);
  }, []);

  // Run until 100%
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isRunning) {
      if (coveragePercentage < 100) {
        timeoutId = setTimeout(() => {
          simulateTransactions(5); // Process in batches of 5 for visible updates
        }, 50);
      } else {
        setIsRunning(false);
      }
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isRunning, bins, coveragePercentage, simulateTransactions]);

  const toggleRunUntil100 = () => {
    if (coveragePercentage >= 100 && !isRunning) {
      // If already at 100%, reset and start running
      resetCoverage();
      // Need a slight delay to let state clear before starting
      setTimeout(() => setIsRunning(true), 0);
    } else {
      setIsRunning(!isRunning);
    }
  };

  const toggleIgnoreBin = (addr: AddrBin, op: OpBin) => {
    setBins(prev => prev.map(b => 
      b.addr === addr && b.op === op 
        ? { ...b, isIgnored: !b.isIgnored } 
        : b
    ));
  };

  const getCellColor = (bin: CrossBin) => {
    if (bin.isIgnored) return "bg-slate-800 border-slate-700 text-slate-500 opacity-50";
    if (bin.hitCount > 0) {
      // Scale green intensity slightly based on hits
      if (bin.hitCount > 5) return "bg-green-500 border-green-600 text-slate-900 font-bold";
      if (bin.hitCount > 2) return "bg-green-400 border-green-500 text-slate-900 font-bold";
      return "bg-green-300 border-green-400 text-slate-800 font-bold";
    }
    return "bg-slate-800 border-slate-700 text-slate-300";
  };

  return (
    <Card className="my-8 overflow-hidden bg-slate-950 border-slate-800" data-testid="coverage-cross-explorer">
      <CardHeader className="bg-slate-900/50 border-b border-slate-800">
        <CardTitle className="flex items-center gap-2 text-slate-100">
          Cross Coverage Explorer
        </CardTitle>
        <CardDescription className="text-slate-400">
          Observe how the combinatorial explosion of cross bins fills up. Toggle grid cells to add <code className="text-pink-400 text-xs">ignore_bins</code> and exclude them from calculations.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Left panel: Controls and Stats */}
          <div className="w-full md:w-1/3 space-y-6">
            <div className="bg-slate-900 rounded-lg p-5 border border-slate-800 flex flex-col items-center justify-center space-y-2">
              <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Functional Coverage</div>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-emerald-600">
                {coveragePercentage}%
              </div>
              <div className="text-sm text-slate-500 mt-2">
                {hitActiveBins.length} of {activeBins.length} bins hit
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Transactions:</span>
                <span className="text-lg font-mono font-bold text-slate-200">{transactionCount}</span>
              </div>
              
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <Button 
                  onClick={() => simulateTransactions(10)} 
                  disabled={isRunning}
                  className="w-full justify-start bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Randomize 10 Tx
                </Button>
                
                <Button 
                  onClick={toggleRunUntil100} 
                  variant={isRunning ? "destructive" : "default"}
                  className={`w-full justify-start ${!isRunning ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                >
                  <FastForward className="w-4 h-4 mr-2" />
                  {isRunning ? "Stop Simulation" : "Run until 100%"}
                </Button>
                
                <Button 
                  onClick={resetCoverage} 
                  disabled={isRunning && transactionCount === 0}
                  variant="outline"
                  className="w-full justify-start border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset Form
                </Button>
              </div>
            </div>
            
            <div data-testid="covergroup-code" className="bg-slate-900/50 rounded-md p-4 text-xs font-mono text-slate-400 border border-slate-800">
              <div><span className="text-fuchsia-400">covergroup</span> cg_cross;</div>
              <div className="pl-4"><span className="text-fuchsia-400">coverpoint</span> cp_addr;</div>
              <div className="pl-4"><span className="text-fuchsia-400">coverpoint</span> cp_op;</div>
              <div className="pl-4"><span className="text-blue-400">cross</span> cp_addr, cp_op &#123;</div>
              {bins.filter(b => b.isIgnored).map(b => (
                <div key={`${b.addr}-${b.op}`} className="pl-8">
                  <span className="text-pink-500">ignore_bins</span> {b.addr}_{b.op} = <br/>
                  <span className="pl-4 pr-1">binsof</span>(cp_addr) <span className="text-blue-300">intersect</span> &#123;{b.addr}&#125; &amp;&amp; <br/>
                  <span className="pl-4 pr-1">binsof</span>(cp_op) <span className="text-blue-300">intersect</span> &#123;{b.op}&#125;;
                </div>
              ))}
              <div className="pl-4">&#125;</div>
              <div><span className="text-fuchsia-400">endgroup</span></div>
            </div>
          </div>

          {/* Right panel: 3x3 Matrix */}
          <div className="w-full md:w-2/3 flex flex-col">
            <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center justify-between">
              <span>cp_addr &times; cp_op Cross Matrix</span>
              <span className="text-xs text-slate-500 font-normal italic">Click cells to ignore</span>
            </h3>
            
            <div className="flex-1 flex items-center justify-center bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-inner">
              <div className="flex flex-col">
                <div className="flex">
                  <div className="w-16"></div> {/* Empty corner */}
                  {/* Column headers (OP) */}
                  {OP_BINS.map(op => (
                    <div key={op} className="w-24 pb-3 flex justify-center items-end text-xs font-semibold text-slate-400">
                      {op}
                    </div>
                  ))}
                </div>
                
                {/* Rows (ADDR) */}
                {ADDR_BINS.map(addr => (
                  <div key={addr} className="flex mb-2 items-center">
                    {/* Row header */}
                    <div className="w-16 pr-3 flex justify-end items-center text-xs font-semibold text-slate-400">
                      {addr}
                    </div>
                    
                    {/* Cells */}
                    {OP_BINS.map(op => {
                      const bin = bins.find(b => b.addr === addr && b.op === op)!;
                      return (
                        <div 
                          key={`${addr}-${op}`} 
                          data-testid={`cross-cell-${addr}-${op}`}
                          onClick={() => toggleIgnoreBin(addr, op)}
                          className={`w-24 h-20 mx-1 flex flex-col justify-center items-center rounded-lg border-2 cursor-pointer transition-all duration-300 select-none hover:brightness-110 active:scale-95 ${getCellColor(bin)}`}
                        >
                          <span className="text-sm tracking-wide">
                            {bin.isIgnored ? "IGNORED" : `${bin.hitCount}`}
                          </span>
                          {!bin.isIgnored && <span className="text-[10px] opacity-70 mt-1 uppercase">Hits</span>}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
};
