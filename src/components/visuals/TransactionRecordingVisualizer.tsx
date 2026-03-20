"use client";

import React, { useState, useEffect } from 'react';
import { Database, Activity, Box, Play, Pause, ScrollText, Cpu } from 'lucide-react';

type Transaction = {
  id: string;
  type: 'READ' | 'WRITE';
  addr: string;
  data: string;
  startTime: number;
  endTime: number | null;
  status: 'PENDING' | 'COMPLETE';
};

export default function TransactionRecordingVisualizer() {
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [logs, setLogs] = useState<{t: number, source: string, msg: string}[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setTime(prev => {
          const nextTime = prev + 10;
          
          setTransactions(current => {
            let updated = false;
            const nextTxs = current.map(tx => {
              if (tx.status === 'PENDING' && nextTime - tx.startTime >= 60) {
                updated = true;
                setLogs(l => [...l, { t: nextTime, source: 'uvm_driver', msg: `end_tr(req_${tx.id}) -> Invoking do_record()` }].slice(-6));
                return { 
                  ...tx, 
                  status: 'COMPLETE' as const, 
                  endTime: nextTime,
                  data: tx.type === 'READ' ? '0x' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase() : tx.data
                };
              }
              return tx;
            });
            return updated ? nextTxs : current;
          });
          
          if (nextTime >= 1000) {
             setIsPlaying(false);
          }
          return nextTime;
        });
      }, 400); // 400ms per 10ns tick
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const sendTransaction = (type: 'READ' | 'WRITE') => {
    if (!isPlaying) setIsPlaying(true);
    if (time >= 950) return; // Almost out of time
    
    const id = Math.random().toString(36).substr(2, 4).toUpperCase();
    const addr = '0x' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase();
    const data = type === 'WRITE' ? '0x' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase() : '(Pending)';
    
    setLogs(prev => [...prev, { t: time, source: 'uvm_driver', msg: `begin_tr(req_${id}, "axi_stream")` }].slice(-6));
    
    setTransactions(prev => [...prev, {
      id,
      type,
      addr,
      data,
      startTime: time,
      endTime: null,
      status: 'PENDING'
    }]);
  };

  const reset = () => {
    setIsPlaying(false);
    setTime(0);
    setTransactions([]);
    setLogs([]);
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 font-sans my-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display text-white m-0">Transaction Recording Flow</h3>
          <p className="text-sm text-slate-400 mt-1">See how `begin_tr`/`end_tr` translate standard objects into waveform blocks.</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => sendTransaction('WRITE')}
            disabled={time >= 950}
            className="px-3 py-1.5 bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-300 text-sm font-medium rounded-lg transition-colors border border-indigo-800/50 disabled:opacity-50"
          >
            Send WRITE
          </button>
          <button 
            onClick={() => sendTransaction('READ')}
            disabled={time >= 950}
            className="px-3 py-1.5 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 text-sm font-medium rounded-lg transition-colors border border-emerald-800/50 disabled:opacity-50"
          >
            Send READ
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 ml-2"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: UVM Architecture */}
        <div className="flex flex-col gap-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>UVM Testbench Memory</span>
            <span className="text-blue-400 font-mono text-[10px] bg-blue-900/20 px-2 py-0.5 rounded">Object Domain</span>
          </div>

          <div className="border border-slate-700 bg-slate-800/30 rounded-lg p-4 relative">
             <div className="flex items-center gap-2 mb-3 text-slate-300 font-medium">
                <Cpu className="w-5 h-5 text-indigo-400" />
                uvm_driver #(axi_transfer)
             </div>
             
             <div className="space-y-2 h-32 overflow-y-auto pr-2 custom-scrollbar">
               {transactions.filter(t => t.status === 'PENDING').length === 0 ? (
                 <div className="text-xs text-slate-500 italic h-full flex items-center justify-center">Idle (Waiting for sequence item)</div>
               ) : (
                 transactions.filter(t => t.status === 'PENDING').map(tx => (
                   <div key={tx.id} className="text-xs bg-slate-800 border border-slate-700 rounded p-2 flex gap-3 shadow-sm animate-in fade-in zoom-in duration-300">
                     <Box className={`w-4 h-4 mt-0.5 ${tx.type === 'WRITE' ? 'text-indigo-400' : 'text-emerald-400'}`} />
                     <div className="font-mono flex-1">
                       <div className="text-blue-300">req_{tx.id}</div>
                       <div className="text-slate-400 mt-1 grid grid-cols-2 gap-x-2 gap-y-1">
                         <span>ADDR: {tx.addr}</span>
                         <span>CMD: {tx.type}</span>
                         <span className="col-span-2">DATA: {tx.data}</span>
                       </div>
                     </div>
                   </div>
                 ))
               )}
             </div>
             
             {/* Connecting abstraction line */}
             <div className="absolute -right-4 top-1/2 w-8 border-b-2 border-dashed border-slate-600 hidden md:block"></div>
          </div>
          
          {/* Recorder Engine */}
          <div className="border border-slate-700 bg-slate-800/50 rounded-lg p-4 mt-2">
             <div className="flex items-center gap-2 mb-2 text-slate-300 font-medium">
                <Database className="w-5 h-5 text-amber-400" />
                uvm_recorder / uvm_tr_stream
             </div>
             <p className="text-[11px] text-slate-400 mb-3">Serializes active objects to the simulator database.</p>
             
             <div className="bg-black/40 rounded p-2 h-[120px] overflow-y-auto font-mono text-[10px] space-y-1">
               {logs.map((log, i) => (
                 <div key={i} className="flex gap-2">
                   <span className="text-slate-500 whitespace-nowrap">[{log.t}ns]</span>
                   <span className="text-purple-400">{log.source}:</span>
                   <span className="text-slate-300">{log.msg}</span>
                 </div>
               ))}
               {logs.length === 0 && <span className="text-slate-600 italic">No recording API calls yet...</span>}
             </div>
          </div>
        </div>

        {/* Right Side: External / Waveform Database */}
        <div className="flex flex-col gap-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
             <span>Simulation Waveform (FSDB/TRDB)</span>
             <span className="text-amber-400 font-mono text-[10px] bg-amber-900/20 px-2 py-0.5 rounded">Timeline Domain</span>
          </div>
          
          <div className="border border-slate-700 bg-slate-900 rounded-lg overflow-hidden flex flex-col h-full shadow-inner relative">
            <div className="border-b border-slate-800 bg-slate-800/80 px-3 py-2 flex justify-between items-center text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>viewer_gui</span>
              </div>
              <span>Time: {time} ns</span>
            </div>
            
            <div className="p-4 flex-1 relative overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTIwIDIwaDIwdjIwSDIwdi0yMHptLTIwIDBoMjB2MjBIMHYtMjB6IiBmaWxsPSIjMWUxZTFlIiBmaWxsLW9wYWNpdHk9IjAuMDUiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvc3ZnPg==')]">
              
              {/* Timeline marker line */}
              <div className="absolute top-0 bottom-0 border-l border-red-500/50 z-20 transition-all duration-300 ease-linear shadow-[0_0_10px_rgba(239,68,68,0.3)]" style={{ left: `${(time / 1000) * 100}%` }}></div>

              <div className="space-y-6 relative mt-4">
                {/* AXI Stream Trace */}
                <div className="relative h-12 border-b border-slate-800/50">
                  <div className="absolute -left-2 top-0 text-[10px] font-mono text-slate-500">axi_stream @ axi_driver</div>
                  <div className="absolute left-0 top-6 right-0 h-0.5 bg-slate-800 w-full z-0"></div>
                  
                  {transactions.map(tx => {
                    const startPct = (tx.startTime / 1000) * 100;
                    const endPct = tx.endTime ? (tx.endTime / 1000) * 100 : (time / 1000) * 100;
                    const widthPct = Math.max(endPct - startPct, 0.5);
                    
                    return (
                      <div 
                        key={tx.id}
                        className={`absolute top-2 h-8 rounded-sm text-[10px] font-mono flex flex-col justify-center px-1 overflow-hidden transition-all duration-300 z-10 
                          ${tx.type === 'WRITE' ? 'bg-indigo-900/80 border border-indigo-500 text-indigo-200' : 'bg-emerald-900/80 border border-emerald-500 text-emerald-200'}
                          ${tx.status === 'PENDING' ? 'opacity-80 border-r-transparent border-r-0 rounded-r-none' : ''}`}
                        style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                      >
                         <span className="truncate">{tx.type} {tx.status === 'COMPLETE' ? tx.data : '...'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Database state explanation */}
              <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm border border-slate-800 rounded p-3 text-xs text-slate-400">
                {transactions.length === 0 ? (
                  "Database is empty. Click to record a transaction."
                ) : transactions.some(t => t.status === 'PENDING') ? (
                  <span className="text-amber-400">1 open transaction streaming. `uvm_recorder` is collecting fields...</span>
                ) : (
                  <span className="text-emerald-400">All streams closed. Database indices updated for GUI fast-search.</span>
                )}
              </div>
            </div>
            
            {/* Timeline axis */}
            <div className="h-6 bg-slate-900/80 border-t border-slate-800 w-full flex text-[9px] text-slate-600 font-mono relative">
              <div className="absolute left-0 w-full flex justify-between px-2 pt-1">
                <span>0</span>
                <span>250</span>
                <span>500</span>
                <span>750</span>
                <span>1000ns</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {time >= 1000 && (
        <div className="flex justify-center mt-2">
          <button 
             onClick={reset}
             className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-700"
          >
            Reset Simulation
          </button>
        </div>
      )}
    </div>
  );
}
