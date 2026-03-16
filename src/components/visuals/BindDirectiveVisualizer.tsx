"use client";

import React, { useState } from 'react';
import { Layers, FileCode, CheckSquare, Link as LinkIcon, AlertTriangle, ArrowRight, X } from 'lucide-react';

export default function BindDirectiveVisualizer() {
  const [bindActive, setBindActive] = useState(false);
  const [bindType, setBindType] = useState<'module' | 'instance'>('module');

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 font-sans my-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display text-white m-0">The `bind` Directive</h3>
          <p className="text-sm text-slate-400 mt-1">Attach verification logic to RTL non-intrusively.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => { setBindType('module'); setBindActive(false); }}
              className={`px-3 py-1.5 rounded-md transition-all ${
                bindType === 'module' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Bind by Target Module
            </button>
            <button
              onClick={() => { setBindType('instance'); setBindActive(false); }}
              className={`px-3 py-1.5 rounded-md transition-all ${
                bindType === 'instance' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Bind by Specific Instance
            </button>
          </div>

          <button
            onClick={() => setBindActive(!bindActive)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 border ${
              bindActive 
                ? 'bg-rose-900/50 text-rose-300 border-rose-700/50 hover:bg-rose-900/70' 
                : 'bg-emerald-600 text-white border-emerald-500 shadow-md hover:bg-emerald-500'
            }`}
          >
            {bindActive ? <X className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
            {bindActive ? 'Remove Bind' : 'Execute Bind'}
          </button>
        </div>
      </div>

      {/* Main Diagram Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Source Files Overview */}
        <div className="md:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-300">
              <FileCode className="w-4 h-4 text-blue-400" />
              Locked DUT Source (RTL)
            </div>
            <pre className="text-[10px] font-mono text-slate-400 bg-slate-900 p-2 rounded border border-slate-800 opacity-70">
{`module ahb_slave (
  input hclk,
  input hresetn,
  input [31:0] haddr,
  // ...
);
  // Implementation
endmodule`}
            </pre>
          </div>

          <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-300">
              <CheckSquare className="w-4 h-4 text-purple-400" />
              Checker Definition
            </div>
            <pre className="text-[10px] font-mono text-slate-400 bg-slate-900 p-2 rounded border border-slate-800">
{`checker ahb_protocol_chk (
  clock, reset, addr
);
  // SVA assertions
  assert property (@(posedge clock) ...);
endchecker`}
            </pre>
          </div>
        </div>

        {/* Instantiation Hierarchy */}
        <div className="md:col-span-8 flex flex-col gap-4">
          <div className="bg-slate-800/80 rounded-xl border border-slate-600 p-5 flex-1 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-300">
              <Layers className="w-4 h-4 text-emerald-400" />
              Simulation Hierarchy (Elaboration)
            </div>

            {/* Top Level */}
            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 font-mono text-sm relative">
              <div className="text-slate-300 font-bold">tb_top</div>
              
              <div className="mt-3 pl-6 border-l-2 border-slate-600 flex flex-col gap-3 relative">
                
                {/* Instance 1 */}
                <div className="bg-blue-900/20 border border-blue-800/50 rounded p-3 relative z-10 w-full max-w-sm">
                  <div className="text-blue-300 font-semibold mb-1">ahb_slave <span className="text-slate-400 font-normal">u_slave_0</span></div>
                  
                  {/* Bound checker 1 */}
                  <div className={`mt-2 transition-all duration-500 overflow-hidden ${bindActive ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="bg-purple-900/30 border border-purple-700/50 rounded flex items-center p-2 text-xs">
                      <LinkIcon className="w-3 h-3 text-purple-400 mr-2 shrink-0" />
                      <div>
                        <span className="text-purple-300 font-semibold">ahb_protocol_chk</span>{' '}
                        <span className="text-slate-400">chk_inst</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instance 2 */}
                <div className="bg-blue-900/20 border border-blue-800/50 rounded p-3 relative z-10 w-full max-w-sm">
                  <div className="text-blue-300 font-semibold mb-1">ahb_slave <span className="text-slate-400 font-normal">u_slave_1</span></div>
                  
                  {/* Bound checker 2 */}
                  <div className={`mt-2 transition-all duration-500 overflow-hidden ${bindActive && bindType === 'module' ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="bg-purple-900/30 border border-purple-700/50 rounded flex items-center p-2 text-xs">
                      <LinkIcon className="w-3 h-3 text-purple-400 mr-2 shrink-0" />
                      <div>
                        <span className="text-purple-300 font-semibold">ahb_protocol_chk</span>{' '}
                        <span className="text-slate-400">chk_inst</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Warning if trying to bind entirely new instance but missing this one */}
                  <div className={`mt-2 transition-all duration-500 overflow-hidden ${bindActive && bindType === 'instance' ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                     <div className="flex items-center text-[10px] text-slate-500 italic px-2">
                       (Not bound: specific instance targeting was used)
                     </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Bind logic animation overlay */}
            <div className={`absolute top-12 right-4 max-w-[220px] bg-slate-900/90 border-l-4 border-emerald-500 rounded-r-lg p-3 shadow-2xl backdrop-blur-sm transition-all duration-500 transform ${bindActive ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0 pointer-events-none'}`}>
              <div className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Elaboration Hook
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                The compiler seamlessly injects the checker into the target scope as if you had typed the instantiation inside the RTL itself.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Code syntax generator */}
      <div className="bg-black/50 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3 border-b border-slate-800 pb-2">
          Compile-time Directive Syntax
        </div>
        <div className="font-mono text-xs overflow-x-auto whitespace-pre">
          <span className="text-emerald-400">bind</span>{' '}
          {bindType === 'module' ? (
            <span className="text-blue-300" title="Target Module Definition">ahb_slave</span>
          ) : (
            <span className="text-blue-300" title="Target specific instance">tb_top.u_slave_0</span>
          )}
          {' '}
          <span className="text-purple-300" title="Checker name">ahb_protocol_chk</span>{' '}
          <span className="text-slate-300" title="Instance name">chk_inst</span> (
          <div className="pl-4 text-slate-400">
            .clock ( hclk ),<br/>
            .reset ( hresetn ),<br/>
            .addr  ( haddr )
          </div>
          );
        </div>
        <div className="mt-3 text-[10px] text-slate-500 flex items-start gap-1.5">
          <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>Notice how the checker's port connections can freely access the internal signals (<code className="text-slate-400">hclk</code>, <code className="text-slate-400">haddr</code>) of the target scope.</span>
        </div>
      </div>
    </div>
  );
}
