"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type RegionStatus = 'idle' | 'executing' | 'complete';

interface Region {
    id: string;
    name: string;
    description: string;
    items: string[];
}

const REGIONS: Region[] = [
    {
        id: 'active',
        name: 'Active',
        description: 'Evaluates blocking assignments (=) and continuous assignments.',
        items: ['assign a = b & c;', 'x = y + 1;', '$display(...)'],
    },
    {
        id: 'inactive',
        name: 'Inactive',
        description: 'Evaluates #0 blocking assignments.',
        items: ['#0 x = y;'],
    },
    {
        id: 'nba',
        name: 'NBA (Non-Blocking)',
        description: 'Updates variables cleanly sequenced via non-blocking assignments (<=).',
        items: ['q <= d;', 'count <= count + 1;'],
    },
    {
        id: 'postponed',
        name: 'Postponed',
        description: 'Executes sampling after all signals settle, preventing race conditions.',
        items: ['$strobe(...)', '$monitor(...)', 'Coverage sampling'],
    },
];

export const SVEventScheduler = () => {
    const [activeRegion, setActiveRegion] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1000); // ms per step

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isPlaying) {
            timer = setInterval(() => {
                setActiveRegion((prev) => {
                    if (!prev) return REGIONS[0].id;
                    const currentIndex = REGIONS.findIndex((r) => r.id === prev);
                    if (currentIndex === REGIONS.length - 1) {
                        setIsPlaying(false);
                        return null; // Loop finished
                    }
                    return REGIONS[currentIndex + 1].id;
                });
            }, speed);
        }
        return () => clearInterval(timer);
    }, [isPlaying, speed]);

    const handlePlayPause = () => {
        if (!activeRegion) setActiveRegion(REGIONS[0].id);
        setIsPlaying(!isPlaying);
    };

    const handleReset = () => {
        setIsPlaying(false);
        setActiveRegion(null);
    };

    return (
        <div className="flex flex-col space-y-6 rounded-2xl border border-white/10 bg-slate-900/50 p-6 font-sans">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                    <h3 className="text-xl font-semibold text-white">SystemVerilog Event Scheduler</h3>
                    <p className="text-sm text-slate-400">Time: <span className="font-mono text-emerald-400">Current Simulation Tick</span></p>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={handlePlayPause}
                        className="flex items-center space-x-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-emerald-400 transition-colors hover:bg-emerald-500/30"
                    >
                        <span>{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex items-center space-x-2 rounded-lg bg-slate-700 px-4 py-2 text-white transition-colors hover:bg-slate-600"
                    >
                        <span>↺ Reset</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {REGIONS.map((region) => {
                    const isActive = activeRegion === region.id;
                    const isPast = activeRegion && REGIONS.findIndex((r) => r.id === region.id) < REGIONS.findIndex((r) => r.id === activeRegion);

                    return (
                        <div
                            key={region.id}
                            className={`relative flex flex-col space-y-3 rounded-xl border p-4 transition-all duration-300 ${isActive
                                    ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                    : isPast
                                        ? 'border-white/10 bg-slate-800/50'
                                        : 'border-white/5 bg-slate-800/30 opacity-70'
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="active-indicator"
                                    className="absolute -top-1.5 left-1/2 h-3 w-12 -translate-x-1/2 rounded-full bg-emerald-500"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                />
                            )}

                            <div className="flex items-center justify-between">
                                <h4 className={`font-semibold ${isActive ? 'text-emerald-400' : 'text-slate-200'}`}>
                                    {region.name}
                                </h4>
                                {isActive && (
                                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                                )}
                            </div>

                            <p className="text-xs text-slate-400">{region.description}</p>

                            <div className="mt-2 flex-grow space-y-2 rounded-lg bg-slate-950 p-3 shadow-inner">
                                {region.items.map((item, idx) => (
                                    <motion.div
                                        key={idx}
                                        animate={{
                                            opacity: isActive ? 1 : 0.4,
                                            x: isActive ? [0, 5, 0] : 0,
                                        }}
                                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                                        className={`font-mono text-xs ${isActive ? 'text-emerald-300' : 'text-slate-500'}`}
                                    >
                                        {item}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-xl bg-blue-500/10 p-4 border border-blue-500/20">
                <h4 className="flex items-center space-x-2 text-sm font-medium text-blue-400">
                    <span>💡 LRM Insight: IEEE 1800-2023 Clause 4</span>
                </h4>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                    The event scheduler operates in distinct ordered regions. When variables are updated via non-blocking assignments (<code>{'<='}</code>), the update is scheduled in the NBA region, avoiding race conditions that occur when multiple initial/always blocks read and write shared variables simultaneously in the Active region. Mixing <code>{'='}</code> and <code>{'<='}</code> indiscriminately can cause infinite delta-cycle loops between these regions!
                </p>
            </div>
        </div>
    );
};
