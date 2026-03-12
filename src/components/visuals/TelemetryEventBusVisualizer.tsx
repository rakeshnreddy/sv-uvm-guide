"use client";

import React, { useState } from 'react';
import { Play, Pause, AlertTriangle, Activity, Database, Zap } from 'lucide-react';

type LogEvent = {
  id: string;
  time: number;
  source: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
  message: string;
};

type Subscriber = {
  id: string;
  name: string;
  type: 'log' | 'metric' | 'trigger';
  active: boolean;
};

export default function TelemetryEventBusVisualizer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [waveformTriggered, setWaveformTriggered] = useState(false);

  const subscribers: Subscriber[] = [
    { id: 'sub1', name: 'Text Logger', type: 'log', active: true },
    { id: 'sub2', name: 'Coverage Metric Exporter', type: 'metric', active: true },
    { id: 'sub3', name: 'Waveform Trigger (FSDB)', type: 'trigger', active: true },
  ];

  const injectEvent = (type: 'normal' | 'error' | 'hang') => {
    const newTime = currentTime + 10;
    setCurrentTime(newTime);
    
    let newLog: LogEvent;
    
    if (type === 'normal') {
      newLog = {
        id: `evt-${newTime}`,
        time: newTime,
        source: 'ENV.DRV',
        severity: 'INFO',
        message: 'Packet driven successfully (ID: 402)'
      };
      setWaveformTriggered(false);
    } else if (type === 'error') {
      newLog = {
        id: `evt-${newTime}`,
        time: newTime,
        source: 'ENV.SCB',
        severity: 'ERROR',
        message: 'Data mismatch: Expected 0xAA, got 0xAB'
      };
      setWaveformTriggered(true);
    } else {
      newLog = {
        id: `evt-${newTime}`,
        time: newTime,
        source: 'ENV.SQR',
        severity: 'FATAL',
        message: 'Watchdog Timeout: No item_done received for 500ns'
      };
      setWaveformTriggered(true);
    }
    
    setLogs(prev => [newLog, ...prev].slice(0, 5));
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 font-sans my-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display text-white m-0">Centralized Debug Event Bus</h3>
          <p className="text-sm text-slate-400 mt-1">Visualize how components publish tags and subscribers react.</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => injectEvent('normal')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-700"
          >
            Inject Traffic
          </button>
          <button 
            onClick={() => injectEvent('error')}
            className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm font-medium rounded-lg transition-colors border border-red-800/50 flex items-center gap-1.5"
          >
            <AlertTriangle className="w-4 h-4" />
            Inject Error
          </button>
          <button 
            onClick={() => injectEvent('hang')}
            className="px-3 py-1.5 bg-purple-900/40 hover:bg-purple-900/60 text-purple-300 text-sm font-medium rounded-lg transition-colors border border-purple-800/50 flex items-center gap-1.5"
          >
            <Activity className="w-4 h-4" />
            Inject Hang
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative">
        {/* Publisher Side */}
         <div className="md:col-span-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Publishers (UVM Components)</div>
          
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 relative z-10">
            <div className="font-mono text-sm text-blue-400 mb-2">uvm_driver</div>
            <div className="text-xs text-slate-400">Calls `evt_bus.publish("TLM_DONE", ...)`</div>
          </div>
          
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 relative z-10">
             <div className="font-mono text-sm text-emerald-400 mb-2">uvm_scoreboard</div>
             <div className="text-xs text-slate-400">Calls `evt_bus.publish("SCB_MATCH", ...)`</div>
          </div>
          
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 relative z-10">
             <div className="font-mono text-sm text-rose-400 mb-2">watchdog_timer</div>
             <div className="text-xs text-slate-400">Calls `evt_bus.publish("TIMEOUT", ...)`</div>
          </div>
        </div>

        {/* Central Bus */}
        <div className="md:col-span-4 flex flex-col justify-center items-center relative">
           {/* Connecting lines for desktop */}
           <div className="hidden md:block absolute left-0 right-0 top-1/2 h-0.5 bg-slate-700 -z-0"></div>
           
           <div className="bg-indigo-900/50 p-6 rounded-xl border border-indigo-500/30 text-center relative z-10 shadow-[0_0_30px_rgba(79,70,229,0.15)] flex flex-col items-center">
             <Database className="w-8 h-8 text-indigo-400 mb-2" />
             <div className="font-bold text-indigo-300">debug_event_bus</div>
             <div className="text-xs text-indigo-200/60 mt-1 max-w-[120px]">Analysis Port broadcasts to all subscribers</div>
             
             {logs.length > 0 && (
               <div className="mt-4 w-full bg-slate-900 rounded p-2 text-left">
                  <div className="text-[10px] text-slate-500 uppercase">Last Published Event</div>
                  <div className={`text-xs font-mono mt-1 ${logs[0].severity === 'ERROR' || logs[0].severity === 'FATAL' ? 'text-red-400' : 'text-slate-300'}`}>
                    [{logs[0].time}ns] {logs[0].severity}
                  </div>
               </div>
             )}
           </div>
        </div>

        {/* Subscriber Side */}
        <div className="md:col-span-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Subscribers (Analysis Exports)</div>
          
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 relative z-10 flex items-start justify-between">
            <div>
              <div className="font-mono text-sm text-slate-300 mb-1">Text Matcher Log</div>
              <div className="text-xs text-slate-500">Formats tags into simulator log</div>
            </div>
            <div className={`w-2 h-2 rounded-full ${logs.length > 0 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-600'}`}></div>
          </div>
          
          <div className={`bg-slate-800/50 p-4 rounded-lg border transition-all duration-300 relative z-10 flex items-start justify-between ${waveformTriggered ? 'border-amber-500/50 bg-amber-900/20' : 'border-slate-700'}`}>
             <div>
               <div className={`font-mono text-sm flex items-center gap-1.5 mb-1 ${waveformTriggered ? 'text-amber-400' : 'text-slate-300'}`}>
                 FSDB Trigger
                 {waveformTriggered && <Zap className="w-3.5 h-3.5" />}
               </div>
               <div className="text-xs text-slate-500">Watches for ERROR/FATAL tags</div>
               
               {waveformTriggered && (
                 <div className="mt-2 text-[10px] bg-amber-950/50 text-amber-200 px-2 py-1 rounded border border-amber-800/50 inline-block">
                   Executing $fsdbDumpvars...
                 </div>
               )}
             </div>
             <div className={`w-2 h-2 rounded-full ${waveformTriggered ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse' : 'bg-slate-600'}`}></div>
          </div>
        </div>
      </div>
      
      {/* Log Feed */}
      <div className="mt-4 bg-black/40 rounded-lg border border-slate-800 overflow-hidden">
        <div className="bg-slate-800/80 px-4 py-2 text-xs font-mono text-slate-400 border-b border-slate-800 flex justify-between">
          <span>Simulator Console</span>
          <span>Time: {currentTime}ns</span>
        </div>
        <div className="p-4 font-mono text-xs sm:text-sm flex flex-col gap-1 min-h-[120px]">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic mt-8 text-center">Awaiting simulator traffic...</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-3 hover:bg-white/5 px-2 py-1 rounded">
                <span className="text-slate-500 min-w-[60px]">[{log.time}]</span>
                <span className={`min-w-[50px] font-bold ${
                  log.severity === 'INFO' ? 'text-blue-400' : 
                  log.severity === 'WARNING' ? 'text-amber-400' : 
                  'text-red-500'
                }`}>{log.severity}</span>
                <span className="text-purple-400 min-w-[70px]">{log.source}</span>
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
