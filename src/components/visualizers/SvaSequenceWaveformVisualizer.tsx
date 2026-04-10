"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Play, RotateCcw } from 'lucide-react';

type ResultStatus = 'PASS' | 'FAIL' | 'PENDING' | 'VACUOUS' | null;

interface CycleResult {
  status: ResultStatus;
  reason: string;
}

const PRESETS = [
  { label: "Preset 1: req ##2 ack", value: "req ##2 ack" },
  { label: "Preset 2: req |-> ##[1:3] ack", value: "req |-> ##[1:3] ack" },
  { label: "Preset 3: $rose(req) |=> ack [*2]", value: "$rose(req) |=> ack [*2]" },
  { label: "Custom SVA...", value: "custom" },
];

function parseCondition(condStr: string, sigs: Record<string, number[]>, c: number): boolean {
  condStr = condStr.trim();
  if (condStr === 'req') return sigs.req[c] === 1;
  if (condStr === 'ack') return sigs.ack[c] === 1;
  if (condStr === 'data_valid') return sigs.data_valid[c] === 1;
  
  let match = condStr.match(/^\$rose\((req|ack|data_valid)\)$/);
  if (match) {
    let sig = sigs[match[1]];
    if (c === 0) return false;
    return sig[c-1] === 0 && sig[c] === 1;
  }
  match = condStr.match(/^\$fell\((req|ack|data_valid)\)$/);
  if (match) {
    let sig = sigs[match[1]];
    if (c === 0) return false;
    return sig[c-1] === 1 && sig[c] === 0;
  }
  if (condStr.startsWith('!')) {
      return !parseCondition(condStr.substring(1), sigs, c);
  }
  return false;
}

function checkConsequent(consStr: string, sigs: Record<string, number[]>, c: number): 'PASS' | 'FAIL' | 'PENDING' {
  consStr = consStr.trim();
  
  let matchDel = consStr.match(/^##(\d+)\s+(.+)$/);
  if (matchDel) {
     let n = parseInt(matchDel[1]);
     let B = matchDel[2];
     if (c + n >= 16) return 'PENDING';
     return checkConsequent(B, sigs, c + n);
  }
  
  let matchRng = consStr.match(/^##\[(\d+):(\d+)\]\s+(.+)$/);
  if (matchRng) {
     let n = parseInt(matchRng[1]);
     let m = parseInt(matchRng[2]);
     let B = matchRng[3];
     
     let allCheckedFail = true;
     for (let i = n; i <= m; i++) {
        if (c + i >= 16) {
           allCheckedFail = false;
           continue;
        }
        let res = checkConsequent(B, sigs, c + i);
        if (res === 'PASS') return 'PASS';
        if (res === 'PENDING') allCheckedFail = false;
     }
     if (allCheckedFail) return 'FAIL';
     return 'PENDING';
  }
  
  let matchRep = consStr.match(/^(.+?)\s+\[\*(\d+)\]$/);
  if (matchRep) {
      let B = matchRep[1].trim();
      let n = parseInt(matchRep[2]);
      for (let i = 0; i < n; i++) {
         if (c + i >= 16) return 'PENDING';
         if (!parseCondition(B, sigs, c + i)) return 'FAIL';
      }
      return 'PASS';
  }
  
  if (c >= 16) return 'PENDING';
  if (parseCondition(consStr, sigs, c)) {
      return 'PASS';
  } else {
      return 'FAIL';
  }
}

function evaluateProperty(prop: string, sigs: Record<string, number[]>, c: number): CycleResult {
   let p = prop.trim();
   if (!p) return { status: 'VACUOUS', reason: 'Empty property' };

   try {
       // Is it A |-> B ?
       let matchImpl = p.match(/^(.+?)\s*\|->\s*(.+)$/);
       if (matchImpl) {
           let A = matchImpl[1];
           let B = matchImpl[2];
           if (!parseCondition(A, sigs, c)) return { status: 'VACUOUS', reason: `Antecedent '${A}' is false` };
           let res = checkConsequent(B, sigs, c);
           return { 
               status: res, 
               reason: res === 'PASS' ? `Matched: consequent passed` : 
                       res === 'FAIL' ? `Failed: antecedent true, but consequent failed` : 
                       `Pending: not enough cycles` 
           };
       }
       
       // A |=> B
       matchImpl = p.match(/^(.+?)\s*\|=>\s*(.+)$/);
       if (matchImpl) {
           let A = matchImpl[1];
           let B = matchImpl[2];
           if (!parseCondition(A, sigs, c)) return { status: 'VACUOUS', reason: `Antecedent '${A}' is false` };
           let res = checkConsequent(B, sigs, c + 1);
           return { 
               status: res, 
               reason: res === 'PASS' ? `Matched: consequent passed` : 
                       res === 'FAIL' ? `Failed: antecedent true, but consequent failed` : 
                       `Pending: not enough cycles` 
           };
       }
       
       // A ##N B sequence
       let matchSeq = p.match(/^(.+?)\s+##(\d+)\s+(.+)$/);
       if (matchSeq) {
           let A = matchSeq[1];
           let n = parseInt(matchSeq[2]);
           let B = matchSeq[3];
           if (!parseCondition(A, sigs, c)) return { status: 'VACUOUS', reason: `Antecedent '${A}' is false` };
           let res = checkConsequent(B, sigs, c + n);
           return { 
               status: res, 
               reason: res === 'FAIL' ? `Failed: unmatched sequence` : 
                       res === 'PASS' ? `Matched sequence` : 
                       `Pending` 
           };
       }
       
       // A ##[N:M] B sequence
       matchSeq = p.match(/^(.+?)\s+##\[(\d+):(\d+)\]\s+(.+)$/);
       if (matchSeq) {
           let A = matchSeq[1];
           let n = parseInt(matchSeq[2]);
           let m = parseInt(matchSeq[3]);
           let B = matchSeq[4];
           if (!parseCondition(A, sigs, c)) return { status: 'VACUOUS', reason: `Antecedent '${A}' is false` };
           let allCheckedFail = true;
           for (let i = n; i <= m; i++) {
              if (c + i >= 16) {
                  allCheckedFail = false;
                  continue;
              }
              let res = checkConsequent(B, sigs, c + i);
              if (res === 'PASS') return { status: 'PASS', reason: `Matched sequence at cycle ${c+i}` };
              if (res === 'PENDING') allCheckedFail = false;
           }
           if (allCheckedFail) return { status: 'FAIL', reason: `Failed: unmatched sequence in range` };
           return { status: 'PENDING', reason: `Pending data for range` };
       }
       
       if (!parseCondition(p, sigs, c)) return { status: 'FAIL', reason: `'${p}' evaluated to false` };
       return { status: 'PASS', reason: `'${p}' evaluated to true` };
   } catch (e) {
       return { status: 'FAIL', reason: 'Parse Error' };
   }
}

export const SvaSequenceWaveformVisualizer = () => {
    const [propertyValue, setPropertyValue] = useState<string>(PRESETS[0].value);
    const [customProperty, setCustomProperty] = useState<string>('');
    
    // 16 cycles of state
    const numCycles = 16;
    const [signals, setSignals] = useState<Record<string, number[]>>({
        req: Array(numCycles).fill(0),
        ack: Array(numCycles).fill(0),
        data_valid: Array(numCycles).fill(0),
    });

    const [results, setResults] = useState<CycleResult[] | null>(null);

    const toggleSignal = (sig: string, cycle: number) => {
        setSignals(prev => {
            const newSig = [...prev[sig]];
            newSig[cycle] = newSig[cycle] ? 0 : 1;
            return { ...prev, [sig]: newSig };
        });
        // Clear results when user changes state
        setResults(null);
    };

    const handleEvaluate = () => {
        const propToEval = propertyValue === 'custom' ? customProperty : propertyValue;
        const newResults: CycleResult[] = [];
        for (let i = 0; i < numCycles; i++) {
            newResults.push(evaluateProperty(propToEval, signals, i));
        }
        setResults(newResults);
    };

    const handleReset = () => {
        setSignals({
            req: Array(numCycles).fill(0),
            ack: Array(numCycles).fill(0),
            data_valid: Array(numCycles).fill(0),
        });
        setResults(null);
    };

    const drawGridLines = () => {
        let lines = [];
        for (let i = 1; i <= numCycles; i++) {
            lines.push(<line key={i} x1={i * 40} y1={0} x2={i * 40} y2={50} stroke="rgba(255,255,255,0.05)" />);
        }
        return lines;
    };

    const renderWaveform = (name: string, data: number[], isEditable: boolean) => {
        return (
            <div className="flex items-center mb-2">
                <div className="w-24 text-sm font-mono text-slate-400 text-right pr-4">{name}</div>
                <div className="relative border border-slate-700 bg-slate-900 rounded" style={{ width: numCycles * 40, height: 50 }}>
                    <svg width={numCycles * 40} height={50} className="absolute inset-0 pointer-events-none stroke-blue-500 fill-transparent stroke-2">
                        {drawGridLines()}
                        {data.map((cVal, c) => {
                            const x = c * 40;
                            const prevVal = c > 0 ? data[c - 1] : 0;
                            const y = cVal ? 10 : 40;
                            const prevY = prevVal ? 10 : 40;
                            
                            // SVG origin is top-left
                            return (
                                <React.Fragment key={c}>
                                    {c > 0 && cVal !== prevVal && <line x1={x} y1={prevY} x2={x} y2={y} className="stroke-indigo-400" />}
                                    <line x1={x} y1={y} x2={x + 40} y2={y} className="stroke-indigo-400" />
                                </React.Fragment>
                            );
                        })}
                    </svg>
                    {isEditable && (
                        <div className="absolute inset-0 flex">
                            {data.map((_, c) => (
                                <div 
                                    key={c}
                                    className="w-[40px] h-full cursor-pointer hover:bg-white/10"
                                    onClick={() => toggleSignal(name, c)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderClockWaveform = () => {
        return (
            <div className="flex items-center mb-2">
                <div className="w-24 text-sm font-mono text-slate-400 text-right pr-4">clk</div>
                <div className="relative border border-slate-700 bg-slate-900 rounded" style={{ width: numCycles * 40, height: 50 }}>
                    <svg width={numCycles * 40} height={50} className="absolute inset-0 pointer-events-none fill-transparent stroke-2">
                        {drawGridLines()}
                        {Array.from({ length: numCycles }).map((_, c) => {
                            const x = c * 40;
                            return (
                                <React.Fragment key={c}>
                                    {c > 0 && <line x1={x} y1={40} x2={x} y2={10} className="stroke-slate-500" />}
                                    {c === 0 && <line x1={x} y1={40} x2={x} y2={10} className="stroke-slate-500" />}
                                    <line x1={x} y1={10} x2={x + 20} y2={10} className="stroke-slate-500" />
                                    <line x1={x + 20} y1={10} x2={x + 20} y2={40} className="stroke-slate-500" />
                                    <line x1={x + 20} y1={40} x2={x + 40} y2={40} className="stroke-slate-500" />
                                </React.Fragment>
                            );
                        })}
                    </svg>
                    <div className="absolute inset-0 flex">
                        {Array.from({ length: numCycles }).map((_, c) => (
                            <div key={c} className="w-[40px] h-full flex flex-col justify-end">
                                <span className="text-[10px] text-slate-500 ml-1 mb-1 select-none">{c}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderResults = () => {
        if (!results) return null;
        return (
            <div className="flex items-center mt-4">
                <div className="w-24 text-sm font-mono font-bold text-slate-300 text-right pr-4">Result</div>
                <div className="flex" style={{ width: numCycles * 40 }}>
                    {results.map((res, c) => {
                        let bgColor = 'bg-slate-800';
                        let symbol = '-';
                        if (res.status === 'PASS') { bgColor = 'bg-green-600/80'; symbol = '✓'; }
                        else if (res.status === 'FAIL') { bgColor = 'bg-red-600/80'; symbol = '✗'; }
                        else if (res.status === 'PENDING') { bgColor = 'bg-yellow-600/80'; symbol = '⌛'; }
                        
                        return (
                            <div 
                                key={c} 
                                className={`w-[40px] h-8 flex items-center justify-center border-r border-slate-700/50 ${bgColor} cursor-help`}
                                title={res.reason}
                                data-testid={`cycle-result-${c}`}
                            >
                                <span className="text-white font-bold text-xs">{symbol}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <Card className="my-8 overflow-hidden w-full max-w-4xl mx-auto shadow-md" data-testid="sva-waveform-visualizer">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <CardTitle>SVA Property Evaluator</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Interactive SystemVerilog Assertion sequence evaluation</p>
            </CardHeader>
            <CardContent className="p-6 bg-slate-950">
                <div className="flex flex-col md:flex-row gap-4 mb-6 relative z-10">
                    <div className="flex-grow">
                        <label className="block text-sm font-medium border-slate-300 text-slate-400 mb-1">Select Property:</label>
                        <select 
                            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded p-2 text-sm font-mono"
                            value={propertyValue}
                            onChange={e => {
                                setPropertyValue(e.target.value);
                                setResults(null);
                            }}
                        >
                            {PRESETS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                        {propertyValue === 'custom' && (
                            <input 
                                type="text"
                                className="w-full mt-2 bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm font-mono"
                                placeholder="Enter simplified SVA (e.g. req |-> ##2 ack)"
                                value={customProperty}
                                onChange={e => {
                                    setCustomProperty(e.target.value);
                                    setResults(null);
                                }}
                            />
                        )}
                    </div>
                    <div className="flex items-end gap-2 shrink-0">
                        <Button variant="default" onClick={handleEvaluate} className="w-32 bg-indigo-600 hover:bg-indigo-700">
                            <Play className="w-4 h-4 mr-2" />
                            Evaluate
                        </Button>
                        <Button variant="outline" onClick={handleReset} className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700" title="Reset Waveform">
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto">
                    <div className="min-w-[700px] pb-2">
                        {renderClockWaveform()}
                        {renderWaveform('req', signals.req, true)}
                        {renderWaveform('ack', signals.ack, true)}
                        {renderWaveform('data_valid', signals.data_valid, true)}
                        {renderResults()}
                    </div>
                </div>
                
                <div className="mt-4 flex gap-4 text-xs text-slate-400">
                    <div className="flex items-center"><span className="w-3 h-3 bg-green-600 inline-block mr-1 rounded-sm"/> PASS</div>
                    <div className="flex items-center"><span className="w-3 h-3 bg-red-600 inline-block mr-1 rounded-sm"/> FAIL</div>
                    <div className="flex items-center"><span className="w-3 h-3 bg-yellow-600 inline-block mr-1 rounded-sm"/> PENDING</div>
                    <div className="flex items-center"><span className="w-3 h-3 bg-slate-800 inline-block mr-1 rounded-sm border border-slate-700"/> VACUOUS</div>
                    <div className="ml-auto text-slate-500 italic">Click signal traces to toggle values, then Evaluate. Hover over results to see why.</div>
                </div>
            </CardContent>
        </Card>
    );
};
