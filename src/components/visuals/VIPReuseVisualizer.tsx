"use client";

import React, { useState } from 'react';
import { Cpu, Repeat, Activity, FileJson, ArrowRight, Eye, PlayCircle, StopCircle, ArrowDown } from 'lucide-react';

export default function VIPReuseVisualizer() {
  const [isPassive, setIsPassive] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 font-sans my-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display text-white m-0">UVM VIP Re-use Topology</h3>
          <p className="text-sm text-slate-400 mt-1">See how agent personalities adapt from block-level testbenches to SoC-level integration.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-800 p-1.5 rounded-lg border border-slate-700">
          <button
            onClick={() => setIsPassive(false)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
              !isPassive 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            Block Level (Active)
          </button>
          <button
            onClick={() => setIsPassive(true)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
              isPassive 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-4 h-4" />
            SoC Level (Passive)
          </button>
        </div>
      </div>

      {/* Main Diagram Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative">
        
        {/* Firmware/Processor (Only visible in Passive/SoC mode) */}
        <div className={`md:col-span-3 flex flex-col justify-center transition-all duration-500 ${isPassive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none absolute md:relative'}`}>
          <div className="bg-indigo-900/40 border border-indigo-700/50 rounded-xl p-4 flex flex-col items-center text-center shadow-[0_0_20px_rgba(67,56,202,0.15)] relative z-10">
            <Cpu className="w-8 h-8 text-indigo-400 mb-2" />
            <div className="font-bold text-indigo-200">RISC-V Core</div>
            <div className="text-xs text-indigo-300 mt-1">Executing C Firmware</div>
            <div className="mt-3 text-[10px] bg-indigo-950/80 text-indigo-300/80 px-2 py-1 rounded border border-indigo-800/50 font-mono">
              write_apb(SPI_CTRL, 0x1)
            </div>
            {/* Driving Arrow */}
            <div className={`absolute -right-3 top-1/2 -translate-y-1/2 text-indigo-400 ${isPassive ? 'animate-pulse' : 'hidden'}`}>
              <ArrowRight className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* UVM Environment */}
        <div className={`flex flex-col gap-4 transition-all duration-500 ${isPassive ? 'md:col-span-5' : 'md:col-span-6'}`}>
          <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-4 relative z-0">
            <div className="absolute top-0 left-4 -translate-y-1/2 bg-slate-900 px-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
              UVM SPI Agent
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              {/* Sequencer */}
              <div className={`bg-blue-900/20 border border-blue-800/40 rounded-lg p-3 flex flex-col items-center text-center transition-all duration-500 ${isPassive ? 'opacity-30 grayscale' : 'shadow-[0_0_15px_rgba(59,130,246,0.1)]'}`}>
                <Repeat className={`w-5 h-5 mb-1.5 ${isPassive ? 'text-slate-500' : 'text-blue-400'}`} />
                <div className={`text-sm font-medium ${isPassive ? 'text-slate-500' : 'text-blue-200'}`}>Sequencer</div>
                {!isPassive && (
                  <div className="absolute top-full left-1/4 -translate-x-1/2 translate-y-2 text-blue-500 animate-bounce">
                    <ArrowDown className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* Monitor */}
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-3 flex flex-col items-center text-center shadow-[0_0_15px_rgba(16,185,129,0.1)] relative z-10">
                <Activity className="w-5 h-5 text-emerald-400 mb-1.5" />
                <div className="text-sm font-medium text-emerald-200">Monitor</div>
                <div className="absolute right-0 top-1/2 translate-x-3 translate-y-1 text-emerald-500">
                  <ArrowRight className="w-4 h-4 -rotate-45" />
                </div>
              </div>

              {/* Driver */}
              <div className={`bg-blue-900/20 border border-blue-800/40 rounded-lg p-3 flex flex-col items-center text-center transition-all duration-500 ${isPassive ? 'opacity-30 grayscale' : 'shadow-[0_0_15px_rgba(59,130,246,0.1)] relative z-10'}`}>
                <Activity className={`w-5 h-5 mb-1.5 ${isPassive ? 'text-slate-500' : 'text-blue-400'}`} />
                <div className={`text-sm font-medium ${isPassive ? 'text-slate-500' : 'text-blue-200'}`}>Driver</div>
                {!isPassive && (
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-pulse">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
                {isPassive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-slate-900/80 text-slate-400 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border border-slate-700 backdrop-blur-sm -rotate-12">
                      Disabled
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scoreboard / DUT Area */}
        <div className={`flex flex-col gap-4 transition-all duration-500 ${isPassive ? 'md:col-span-4' : 'md:col-span-6'}`}>
          <div className="flex-1 bg-slate-800/80 rounded-xl border border-slate-600 p-4 flex flex-col items-center justify-center relative">
            <h4 className="font-mono font-bold text-slate-300">DUT: SPI Peripheral</h4>
            
            <div className="mt-4 flex flex-col gap-2 w-full max-w-[200px]">
              <div className="flex justify-between text-xs font-mono text-slate-500 border-b border-slate-700 pb-1">
                <span>Signal</span>
                <span>Driver</span>
              </div>
              <div className="flex justify-between text-xs font-mono items-center">
                <span className="text-emerald-400">APB Bus</span>
                {isPassive ? (
                  <span className="text-indigo-300 bg-indigo-900/50 px-1.5 py-0.5 rounded">Processor</span>
                ) : (
                  <span className="text-blue-300 bg-blue-900/50 px-1.5 py-0.5 rounded">UVM Driver</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Log */}
      <div className="bg-black/50 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3 border-b border-slate-800 pb-2">
          <FileJson className="w-3.5 h-3.5" />
          UVM Configuration DB Status
        </div>
        <div className="font-mono text-xs overflow-x-auto whitespace-pre">
          {isPassive ? (
            <span className="text-purple-300">
              <span className="text-slate-500">{`// In soc_test::build_phase`}</span>{'\n'}
              uvm_config_db#(uvm_active_passive_enum)::set(this, "*.spi_agent", "is_active", <strong>UVM_PASSIVE</strong>);{'\n'}
              <span className="text-slate-500 mt-2 block">{`// Result:
// - Driver & Sequencer are NOT created.
// - Monitor continues observing bus traffic driven by SoC processor.`}</span>
            </span>
          ) : (
            <span className="text-blue-300">
              <span className="text-slate-500">{`// Default behavior in block_test::build_phase`}</span>{'\n'}
              <span className="text-slate-500 opacity-60">{`// uvm_config_db is not required for default active mode,`}</span>{'\n'}
              <span className="text-slate-500 opacity-60">{`// but explicitly looks like:`}</span>{'\n'}
              uvm_config_db#(uvm_active_passive_enum)::set(this, "*.spi_agent", "is_active", <strong>UVM_ACTIVE</strong>);{'\n'}
              <span className="text-slate-500 mt-2 block">{`// Result:
// - Driver & Sequencer are created.
// - Driver actively wiggles DUT pins.`}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
