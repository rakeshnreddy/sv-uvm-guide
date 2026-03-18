"use client";

import React, { useState, useMemo } from 'react';
import { Cpu, Play, Layers, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, AlertTriangle, Zap } from 'lucide-react';

type ViewMode = 'generate' | 'runtime';

interface ElaboratedInstance {
  name: string;
  label: string;
}

export default function GenerateElaborationVisualizer() {
  const [mode, setMode] = useState<ViewMode>('generate');
  const [numChannels, setNumChannels] = useState(2);

  const elaboratedInstances: ElaboratedInstance[] = useMemo(() => {
    return Array.from({ length: numChannels }, (_, i) => ({
      name: `chan_chk[${i}]`,
      label: `Channel ${i} Checker`,
    }));
  }, [numChannels]);

  const generateCode = useMemo(() => {
    const lines = [
      `module tb_top;`,
      `  parameter NUM_CH = ${numChannels};`,
      ``,
      `  // Elaboration-time: compiler unrolls`,
      `  generate`,
      `    for (genvar i = 0; i < NUM_CH; i++) begin : gen_chk`,
      `      protocol_checker chk_inst (`,
      `        .clk  (clk),`,
      `        .data (data_bus[i])`,
      `      );`,
      `    end`,
      `  endgenerate`,
      `endmodule`,
    ];
    return lines;
  }, [numChannels]);

  const runtimeCode = useMemo(() => {
    const lines = [
      `module tb_top;`,
      `  parameter NUM_CH = ${numChannels};`,
      ``,
      `  // Runtime: sequential execution each cycle`,
      `  always_ff @(posedge clk) begin`,
      `    for (int i = 0; i < NUM_CH; i++) begin`,
      `      if (data_bus[i] !== expected[i])`,
      `        $error("Mismatch on ch %0d", i);`,
      `    end`,
      `  end`,
      `endmodule`,
    ];
    return lines;
  }, [numChannels]);

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 font-sans my-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display text-white m-0">Generate vs Runtime</h3>
          <p className="text-sm text-slate-400 mt-1">See how <code className="text-sky-400">generate&nbsp;for</code> creates hardware at elaboration versus a runtime <code className="text-sky-400">for</code> loop.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Mode toggle */}
          <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setMode('generate')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                mode === 'generate' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Generate (Elaboration)
            </button>
            <button
              onClick={() => setMode('runtime')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                mode === 'runtime' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              Runtime Loop
            </button>
          </div>

          {/* Channel count control */}
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setNumChannels(Math.max(1, numChannels - 1))}
              disabled={numChannels <= 1}
              className="p-0.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Decrease channels"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-300 font-mono min-w-[6rem] text-center">
              NUM_CH = <span className="text-amber-400 font-bold">{numChannels}</span>
            </span>
            <button
              onClick={() => setNumChannels(Math.min(4, numChannels + 1))}
              disabled={numChannels >= 4}
              className="p-0.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Increase channels"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Area: Code + Visualization */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Source Code Panel */}
        <div className="md:col-span-5">
          <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-300">
              {mode === 'generate' ? (
                <><Cpu className="w-4 h-4 text-emerald-400" /> SystemVerilog Source (generate)</>
              ) : (
                <><Play className="w-4 h-4 text-blue-400" /> SystemVerilog Source (runtime loop)</>
              )}
            </div>
            <pre className="text-[11px] font-mono text-slate-300 bg-slate-900 p-3 rounded border border-slate-800 overflow-x-auto leading-relaxed">
              {(mode === 'generate' ? generateCode : runtimeCode).map((line, i) => (
                <div key={i}>
                  <span className="text-slate-600 select-none mr-3 inline-block w-4 text-right">{i + 1}</span>
                  {line.includes('generate') || line.includes('genvar') ? (
                    <span className="text-emerald-400">{line}</span>
                  ) : line.includes('always_ff') || line.includes('for (int') ? (
                    <span className="text-blue-400">{line}</span>
                  ) : line.includes('//') ? (
                    <span className="text-slate-500">{line}</span>
                  ) : (
                    <span>{line}</span>
                  )}
                </div>
              ))}
            </pre>
          </div>
        </div>

        {/* Elaboration / Runtime Result Panel */}
        <div className="md:col-span-7 flex flex-col gap-4">
          <div className="bg-slate-800/80 rounded-xl border border-slate-600 p-5 flex-1 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-300">
              <Layers className="w-4 h-4 text-amber-400" />
              {mode === 'generate' ? 'Elaborated Hardware (Compile Time)' : 'Runtime Execution (Simulation Time)'}
            </div>

            {mode === 'generate' ? (
              /* Generate mode: show physical instances */
              <div className="space-y-3">
                <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 font-mono text-sm">
                  <div className="text-slate-300 font-bold mb-3">tb_top (elaborated)</div>
                  <div className="pl-4 border-l-2 border-emerald-800/50 flex flex-col gap-2">
                    {elaboratedInstances.map((inst, i) => (
                      <div
                        key={inst.name}
                        className="bg-emerald-900/20 border border-emerald-800/50 rounded p-3 transition-all duration-300"
                        style={{ animationDelay: `${i * 100}ms` }}
                      >
                        <div className="flex items-center gap-2">
                          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300 font-semibold text-xs">gen_chk[{i}].chk_inst</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 pl-5">
                          protocol_checker — monitors <code className="text-slate-300">data_bus[{i}]</code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-emerald-400/80 bg-emerald-900/10 border border-emerald-900/30 rounded-lg p-3">
                  <Zap className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Each iteration creates a <strong>distinct hardware instance</strong> with its own scope (<code>gen_chk[i]</code>). These exist as independent concurrent blocks — they all run in parallel, not sequentially.</span>
                </div>
              </div>
            ) : (
              /* Runtime mode: show sequential execution */
              <div className="space-y-3">
                <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 font-mono text-sm">
                  <div className="text-slate-300 font-bold mb-3">tb_top (runtime behavior)</div>
                  <div className="pl-4 border-l-2 border-blue-800/50">
                    <div className="bg-blue-900/20 border border-blue-800/50 rounded p-3">
                      <div className="flex items-center gap-2 text-blue-300 font-semibold text-xs mb-2">
                        <Play className="w-3.5 h-3.5" />
                        always_ff @(posedge clk)
                      </div>
                      <div className="space-y-1.5 pl-4 border-l border-blue-900/50">
                        {Array.from({ length: numChannels }, (_, i) => (
                          <div key={i} className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span className="text-blue-400 font-semibold">→ i={i}:</span>
                            <span>check data_bus[{i}] vs expected[{i}]</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-blue-400/80 bg-blue-900/10 border border-blue-900/30 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>A runtime loop executes <strong>sequentially in one process</strong>. No new hardware is created — the same process iterates {numChannels} times each clock edge. You <em>cannot</em> instantiate modules or checkers inside a runtime loop.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Insight Footer */}
      <div className="bg-black/50 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-800 pb-2">
          {mode === 'generate' ? (
            <><ToggleLeft className="w-3.5 h-3.5 text-emerald-400" /> Key Insight: Elaboration Phase</>
          ) : (
            <><ToggleRight className="w-3.5 h-3.5 text-blue-400" /> Key Insight: Simulation Phase</>
          )}
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {mode === 'generate' ? (
            <>The compiler evaluates <code className="text-emerald-400">generate for</code> before simulation begins, unrolling it into {numChannels} independent <code className="text-emerald-400">protocol_checker</code> instances. Each lives in its own named scope (<code className="text-emerald-400">gen_chk[0]</code>, <code className="text-emerald-400">gen_chk[1]</code>, …) and can be individually referenced in hierarchical paths.</>
          ) : (
            <>A runtime <code className="text-blue-400">for</code> loop inside <code className="text-blue-400">always_ff</code> is procedural code. It runs {numChannels} iterations <em>sequentially</em> at each clock edge. It cannot create structural elements like module instances, checkers, or covergroups — only perform runtime checks and assignments.</>
          )}
        </p>
      </div>
    </div>
  );
}
