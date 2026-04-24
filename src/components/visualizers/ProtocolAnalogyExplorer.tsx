'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Store, FileText, Package, CheckSquare, Play, RotateCcw } from 'lucide-react';

type TransactionType = 'WRITE' | 'READ';

export function ProtocolAnalogyExplorer() {
  const [activeTab, setActiveTab] = useState<TransactionType>('WRITE');
  const [step, setStep] = useState(0);

  const reset = () => setStep(0);
  const nextStep = () => setStep((s) => Math.min(s + 1, activeTab === 'WRITE' ? 3 : 2));

  // Change tab resets the animation
  const handleTabChange = (tab: TransactionType) => {
    setActiveTab(tab);
    setStep(0);
  };

  const isWrite = activeTab === 'WRITE';
  const totalSteps = isWrite ? 3 : 2;

  return (
    <div className="my-8 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="protocol-analogy-explorer">
      {/* Header Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => handleTabChange('WRITE')}
          className={cn(
            'flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition-colors min-w-[120px]',
            activeTab === 'WRITE'
              ? 'border-blue-500 text-blue-700 bg-white'
              : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          )}
        >
          Writing Data (Sending a Package)
        </button>
        <button
          onClick={() => handleTabChange('READ')}
          className={cn(
            'flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition-colors min-w-[120px]',
            activeTab === 'READ'
              ? 'border-green-500 text-green-700 bg-white'
              : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          )}
        >
          Reading Data (Ordering a Package)
        </button>
      </div>

      <div className="flex flex-col p-6">
        {/* Description */}
        <div className="mb-6 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 border border-slate-200">
          {isWrite ? (
            <p>
              <strong>Write Transaction:</strong> You want to send a return package to the store. 
              First, you send the shipping label (<strong>AW Channel</strong>). Then, you send the actual box (<strong>W Channel</strong>). 
              Finally, the store sends you a delivery receipt (<strong>B Channel</strong>).
            </p>
          ) : (
            <p>
              <strong>Read Transaction:</strong> You want to order a new item from the store. 
              First, you send the order request (<strong>AR Channel</strong>). 
              Then, the store sends you the box, with the packing slip attached to it (<strong>R Channel</strong>).
            </p>
          )}
        </div>

        {/* Animation Stage */}
        <div className="relative h-64 w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-between px-12 overflow-hidden mb-6">
          
          {/* Master */}
          <div className="z-10 flex flex-col items-center gap-2">
            <div className={cn(
              "flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 bg-white shadow-md",
              isWrite ? "border-blue-400 text-blue-600" : "border-green-400 text-green-600"
            )}>
              <User className="h-8 w-8" />
            </div>
            <div className="text-center font-bold text-slate-700">Master<br/><span className="text-xs font-normal text-slate-500">(Customer)</span></div>
          </div>

          {/* Connective Paths */}
          <div className="absolute left-32 right-32 top-0 bottom-0 flex flex-col justify-center space-y-6 opacity-30 px-8">
            <div className="border-b-2 border-dashed border-slate-400 w-full" />
            <div className="border-b-2 border-dashed border-slate-400 w-full" />
            {isWrite && <div className="border-b-2 border-dashed border-slate-400 w-full" />}
          </div>

          {/* Animated Items */}
          <AnimatePresence>
            {isWrite && step >= 1 && (
              <motion.div
                key="aw"
                initial={{ x: -100, y: -40, opacity: 0 }}
                animate={{ x: 250, y: -40, opacity: 1 }}
                transition={{ type: "spring", stiffness: 60, damping: 15 }}
                className="absolute left-40 flex items-center gap-2 rounded-md bg-indigo-100 border border-indigo-300 px-3 py-1 text-indigo-700 shadow-sm z-20"
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs font-bold">1. AW Channel (Label)</span>
              </motion.div>
            )}

            {isWrite && step >= 2 && (
              <motion.div
                key="w"
                initial={{ x: -100, y: 0, opacity: 0 }}
                animate={{ x: 250, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 60, damping: 15 }}
                className="absolute left-40 flex items-center gap-2 rounded-md bg-blue-100 border border-blue-300 px-3 py-1 text-blue-700 shadow-sm z-20"
              >
                <Package className="h-4 w-4" />
                <span className="text-xs font-bold">2. W Channel (Box)</span>
              </motion.div>
            )}

            {isWrite && step >= 3 && (
              <motion.div
                key="b"
                initial={{ x: 300, y: 40, opacity: 0 }}
                animate={{ x: -30, y: 40, opacity: 1 }}
                transition={{ type: "spring", stiffness: 60, damping: 15 }}
                className="absolute left-40 flex items-center gap-2 rounded-md bg-purple-100 border border-purple-300 px-3 py-1 text-purple-700 shadow-sm z-20"
              >
                <CheckSquare className="h-4 w-4" />
                <span className="text-xs font-bold">3. B Channel (Receipt)</span>
              </motion.div>
            )}

            {!isWrite && step >= 1 && (
              <motion.div
                key="ar"
                initial={{ x: -100, y: -20, opacity: 0 }}
                animate={{ x: 250, y: -20, opacity: 1 }}
                transition={{ type: "spring", stiffness: 60, damping: 15 }}
                className="absolute left-40 flex items-center gap-2 rounded-md bg-orange-100 border border-orange-300 px-3 py-1 text-orange-700 shadow-sm z-20"
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs font-bold">1. AR Channel (Order)</span>
              </motion.div>
            )}

            {!isWrite && step >= 2 && (
              <motion.div
                key="r"
                initial={{ x: 300, y: 20, opacity: 0 }}
                animate={{ x: -30, y: 20, opacity: 1 }}
                transition={{ type: "spring", stiffness: 60, damping: 15 }}
                className="absolute left-40 flex flex-col items-center gap-1 rounded-md bg-emerald-100 border border-emerald-300 px-3 py-2 text-emerald-800 shadow-sm z-20"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="text-xs font-bold">2. R Channel (Box + Slip)</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Slave */}
          <div className="z-10 flex flex-col items-center gap-2">
            <div className={cn(
              "flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 bg-white shadow-md",
              isWrite ? "border-blue-400 text-blue-600" : "border-green-400 text-green-600"
            )}>
              <Store className="h-8 w-8" />
            </div>
            <div className="text-center font-bold text-slate-700">Slave<br/><span className="text-xs font-normal text-slate-500">(Warehouse)</span></div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between bg-slate-100 p-4 rounded-lg border border-slate-200">
          <div className="text-sm font-semibold text-slate-600">
            Step {step} of {totalSteps}
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              onClick={nextStep}
              disabled={step === totalSteps}
              className="flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-4 w-4" />
              Next Step
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
