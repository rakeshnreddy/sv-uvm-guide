'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type PortDirection = 'input' | 'output' | 'inout' | 'none';

interface Signal {
    name: string;
    width: number;
    masterDir: PortDirection;
    slaveDir: PortDirection;
    monitorDir: PortDirection;
}

const signals: Signal[] = [
    { name: 'clk', width: 1, masterDir: 'input', slaveDir: 'input', monitorDir: 'input' },
    { name: 'addr', width: 32, masterDir: 'output', slaveDir: 'input', monitorDir: 'input' },
    { name: 'data', width: 32, masterDir: 'output', slaveDir: 'input', monitorDir: 'input' },
    { name: 'rw', width: 1, masterDir: 'output', slaveDir: 'input', monitorDir: 'input' },
    { name: 'valid', width: 1, masterDir: 'output', slaveDir: 'input', monitorDir: 'input' },
    { name: 'ready', width: 1, masterDir: 'input', slaveDir: 'output', monitorDir: 'input' },
];

export const ModportExplorer = () => {
    const [activeView, setActiveView] = useState<'master' | 'slave' | 'monitor'>('master');

    return (
        <div className="flex flex-col gap-6 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-200">Modport Explorer</h3>
                <div className="flex gap-2 rounded-lg bg-slate-900 p-1">
                    {(['master', 'slave', 'monitor'] as const).map((view) => (
                        <button
                            key={view}
                            onClick={() => setActiveView(view)}
                            className={cn(
                                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                                activeView === view
                                    ? "bg-cyan-500/20 text-cyan-400"
                                    : "text-slate-400 hover:text-slate-200"
                            )}
                        >
                            {view.charAt(0).toUpperCase() + view.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative flex items-center justify-center gap-12 py-8">
                {/* Component Box */}
                <div className="relative z-10 flex h-64 w-48 flex-col items-center justify-center rounded-xl border-2 border-slate-700 bg-slate-900 shadow-xl">
                    <span className="text-lg font-bold text-slate-300">
                        {activeView === 'master' ? 'Master Driver' :
                            activeView === 'slave' ? 'Slave DUT' : 'Monitor'}
                    </span>
                    <span className="mt-2 text-xs text-slate-500">
                        (Uses {activeView} modport)
                    </span>
                </div>

                {/* Interface Wires */}
                <div className="flex flex-col gap-3">
                    {signals.map((sig) => {
                        const dir = sig[`${activeView}Dir` as keyof Signal] as PortDirection;
                        const isInput = dir === 'input';
                        const isOutput = dir === 'output';

                        return (
                            <div key={sig.name} className="group relative flex items-center gap-4">
                                {/* Left Arrow (Input) */}
                                <div className={cn(
                                    "transition-opacity duration-300",
                                    isInput ? "opacity-100" : "opacity-0"
                                )}>
                                    <ArrowRight className="text-cyan-400" />
                                </div>

                                {/* Wire Line */}
                                <div className="relative h-8 w-64 rounded bg-slate-800/50 px-3 flex items-center justify-between border border-slate-700/50">
                                    <span className="font-mono text-xs text-slate-400">{sig.name}</span>
                                    <span className="text-[10px] text-slate-600">[{sig.width > 1 ? `${sig.width - 1}:0` : '0'}]</span>

                                    {/* Direction Indicator */}
                                    <div className={cn(
                                        "absolute inset-0 rounded border-2 transition-colors duration-300",
                                        isInput ? "border-cyan-500/30 bg-cyan-500/5" :
                                            isOutput ? "border-emerald-500/30 bg-emerald-500/5" :
                                                "border-transparent"
                                    )} />
                                </div>

                                {/* Right Arrow (Output) */}
                                <div className={cn(
                                    "transition-opacity duration-300",
                                    isOutput ? "opacity-100" : "opacity-0"
                                )}>
                                    <ArrowRight className="text-emerald-400" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-lg bg-slate-900/50 p-4 text-sm text-slate-400">
                <p>
                    <strong className="text-slate-200">Current Perspective:</strong>{' '}
                    {activeView === 'master' && "The Master drives requests (addr, data, valid) and samples responses (ready)."}
                    {activeView === 'slave' && "The Slave samples requests and drives responses (ready)."}
                    {activeView === 'monitor' && "The Monitor passively samples all signals. It cannot drive anything."}
                </p>
            </div>
        </div>
    );
};

const ArrowRight = ({ className }: { className?: string }) => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </svg>
);
