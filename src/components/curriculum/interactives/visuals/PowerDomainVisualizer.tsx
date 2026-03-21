'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Battery, Zap, ZapOff, ShieldAlert, Lock, Unlock, Cpu, Server } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

type PowerState = 'FULL_ON' | 'SAVE_CONTEXT' | 'ISOLATED' | 'POWER_OFF' | 'RESTORE_CONTEXT';

export const PowerDomainVisualizer: React.FC = () => {
  const [powerState, setPowerState] = useState<PowerState>('FULL_ON');

  const transitions: Record<PowerState, { next: PowerState; action: string; desc: string }> = {
    FULL_ON: {
      next: 'SAVE_CONTEXT',
      action: 'Save Context',
      desc: 'System is running normally. PMU initiates sleep sequence by saving core state.',
    },
    SAVE_CONTEXT: {
      next: 'ISOLATED',
      action: 'Assert Isolation',
      desc: 'Registers saved to retention cells. Next, PMU clamps boundary signals to prevent X-propagation.',
    },
    ISOLATED: {
      next: 'POWER_OFF',
      action: 'Drop Power',
      desc: 'Isolation active. It is now safe to drop the primary VDD to the PD_CPU domain.',
    },
    POWER_OFF: {
      next: 'RESTORE_CONTEXT',
      action: 'Wake Up & Restore',
      desc: 'CPU is OFF. To wake up, PMU restores VDD, un-isolates, and reloads saved context.',
    },
    RESTORE_CONTEXT: {
      next: 'FULL_ON',
      action: 'Resume Traffic',
      desc: 'Registers restored, isolation removed. Core resumes normal execution.',
    },
  };

  const isCpuOn = powerState === 'FULL_ON' || powerState === 'SAVE_CONTEXT' || powerState === 'ISOLATED' || powerState === 'RESTORE_CONTEXT';
  const isIsolated = powerState === 'ISOLATED' || powerState === 'POWER_OFF' || powerState === 'RESTORE_CONTEXT'; // often released during restore
  const isRetained = powerState === 'ISOLATED' || powerState === 'POWER_OFF';

  return (
    <Card className="w-full max-w-4xl font-mono text-sm border-2">
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle className="flex items-center gap-2">
          <Battery className="w-5 h-5 text-indigo-500" />
          <span>Interactive Power Domain Sequence</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        
        {/* SoC Diagram */}
        <div className="relative w-full h-80 bg-slate-100 dark:bg-slate-900 rounded-lg border flex items-center justify-center p-4 mb-6 overflow-hidden">
          
          {/* Always ON Domain (PD_TOP) */}
          <div className="absolute left-4 top-4 bottom-4 w-[40%] bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-400 rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <Server className="w-4 h-4" /> PD_TOP (Always ON)
              </div>
              <div className="text-xs text-muted-foreground mt-1 text-emerald-600/70">VDD: 0.8V stable</div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-800 p-2 border rounded shadow-sm text-center">
                PMU (Power Mgmt Unit)
                <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">State: {powerState}</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-2 border rounded shadow-sm text-center">
                Memory Controller
                <div className="text-xs text-emerald-600 mt-1">Status: Active</div>
              </div>
            </div>
          </div>

          {/* Switchable Domain (PD_CPU) */}
          <motion.div 
            className="absolute right-4 top-4 bottom-4 w-[40%] border-2 rounded-lg p-4 flex flex-col justify-between transition-colors duration-500"
            animate={{
              backgroundColor: isCpuOn ? 'rgba(59, 130, 246, 0.05)' : 'rgba(100, 116, 139, 0.2)',
              borderColor: isCpuOn ? 'rgb(59, 130, 246)' : 'rgb(100, 116, 139)',
            }}
          >
            <div>
              <div className={`font-bold flex items-center gap-2 transition-colors duration-500 ${isCpuOn ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                <Cpu className="w-4 h-4" /> PD_CPU (Switchable)
              </div>
              <div className={`text-xs mt-1 transition-colors duration-500 ${isCpuOn ? 'text-blue-500/70' : 'text-slate-500'}`}>
                {isCpuOn ? 'VDD_CPU: 0.8V' : 'VDD_CPU: 0.0V (OFF)'}
              </div>
            </div>

            {/* Retention Register */}
            <div className="relative">
              <div className={`p-4 border rounded shadow-sm flex items-center justify-between transition-colors duration-500 ${isCpuOn ? 'bg-white dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-800/50 opacity-50 text-slate-400'}`}>
                <span>CPU Core Registers</span>
                {isRetained ? <Lock className="w-4 h-4 text-amber-500" /> : <Unlock className="w-4 h-4 text-slate-300" />}
              </div>
              {/* Retention Cell Callout */}
              <motion.div 
                className="absolute -right-2 -top-2 bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full border border-amber-300 font-bold"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: isRetained ? 1 : 0, scale: isRetained ? 1 : 0.8 }}
              >
                Retained
              </motion.div>
            </div>
          </motion.div>

          {/* Core Power Supply Net Visualization */}
          <motion.div 
            className="absolute right-[22%] top-0 bottom-0 w-2 z-0"
            animate={{
              backgroundColor: isCpuOn ? 'rgba(239, 68, 68, 0.5)' : 'rgba(156, 163, 175, 0.2)',
            }}
          >
            {isCpuOn ? (
              <motion.div 
                className="w-full h-8 bg-red-500 rounded-full blur-sm"
                animate={{ y: [0, 200, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            ) : null}
          </motion.div>

          {/* Domain Boundary & Isolation Cells */}
          <div className="absolute left-[40%] right-[40%] top-0 bottom-0 flex items-center justify-center p-2 z-10">
            {/* Wires */}
            <div className="w-full h-1 bg-slate-300 dark:bg-slate-700 relative">
              {/* Isolation Cell Clamps */}
              <motion.div 
                className={`absolute left-1/2 -top-3 w-6 h-7 -ml-3 rounded border-2 flex items-center justify-center shadow-lg transition-colors duration-300 ${isIsolated ? 'bg-red-500 border-red-700 text-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-300'}`}
              >
                {isIsolated ? <ShieldAlert className="w-4 h-4" /> : <span className="text-[10px] leading-none text-center block" style={{lineHeight: '0.6'}}>ISO<br/>CELL</span>}
              </motion.div>

              {/* Data Flow Animation (only when ON and NOT isolated) */}
              {!isIsolated && isCpuOn && powerState !== 'SAVE_CONTEXT' && (
                <motion.div 
                  className="absolute top-1/2 -mt-1 w-2 h-2 bg-blue-500 rounded-full"
                  initial={{ left: '0%' }}
                  animate={{ left: '100%' }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              )}

              {/* Clamp value display */}
              <motion.div
                className="absolute left-1/2 ml-4 -top-4 text-xs font-bold text-red-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: (isIsolated && powerState === 'POWER_OFF') ? 1 : 0 }}
              >
                Clamp: 0
              </motion.div>
            </div>
          </div>
          
        </div>

        {/* Controls and Feedback */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          <div className="flex-1 bg-slate-50 dark:bg-slate-900 border rounded-lg p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Current Step
            </h4>
            <p className="text-slate-600 dark:text-slate-300">{transitions[powerState].desc}</p>
          </div>
          
          <button 
            onClick={() => setPowerState(transitions[powerState].next)}
            className="flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-4 rounded-lg font-bold flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 shadow-md"
          >
            <span>Action:</span>
            <span className="text-lg">{transitions[powerState].action} ➔</span>
          </button>
        </div>

      </CardContent>
    </Card>
  );
};

export default PowerDomainVisualizer;
