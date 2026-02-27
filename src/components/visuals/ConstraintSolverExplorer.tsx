"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ConstraintMode = 'none' | 'dist' | 'soft' | 'solve_before';

interface DataPoint {
    id: number;
    length: number;
    payload_size: number;
    isValid: boolean;
    probability: number;
}

export const ConstraintSolverExplorer = () => {
    const [mode, setMode] = useState<ConstraintMode>('none');
    const [points, setPoints] = useState<DataPoint[]>([]);
    const [isSolving, setIsSolving] = useState(false);

    // Generate the solution space
    const generateSpace = (currentMode: ConstraintMode) => {
        setIsSolving(true);
        setPoints([]);

        setTimeout(() => {
            const newPoints: DataPoint[] = [];
            let idCount = 0;

            for (let l = 1; l <= 16; l++) {
                for (let p = 1; p <= 16; p++) {
                    let isValid = false;
                    let prob = 1.0;

                    // Base constraint: length must be between 4 and 16
                    // payload_size must match length
                    if (l >= 4 && l <= 16 && p === l) {
                        isValid = true;
                    }

                    if (currentMode === 'dist' && isValid) {
                        // Skew probability: length 8 is very common
                        if (l === 8) prob = 0.8;
                        else prob = 0.2 / 12;
                    }

                    if (currentMode === 'soft' && isValid) {
                        // Soft constraint: prefer length 16 unless overridden
                        if (l === 16) prob = 0.9;
                        else prob = 0.1 / 12;
                    }

                    if (currentMode === 'solve_before' && isValid) {
                        // Even distribution across lengths, rather than skewed by payload permutations
                        // (Simplified visual representation: all valid points are equal size/opacity)
                        prob = 1.0 / 13;
                    }

                    if (currentMode === 'none' && isValid) {
                        // Default flat distribution
                        prob = 1.0 / 13;
                    }

                    if (isValid || currentMode === 'none') {
                        // If mode is none, show the whole 16x16 grid to demonstrate pruning
                        newPoints.push({
                            id: idCount++,
                            length: l,
                            payload_size: p,
                            isValid: isValid,
                            probability: prob
                        });
                    }
                }
            }
            setPoints(newPoints);
            setIsSolving(false);
        }, 600);
    };

    return (
        <div className="flex flex-col space-y-6 rounded-2xl border border-white/10 bg-slate-900/50 p-6 font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-4 gap-4">
                <div>
                    <h3 className="text-xl font-semibold text-white">Constraint Solver Space Explorer</h3>
                    <p className="text-sm text-slate-400">Visualize how constraints prune and shape the solution space.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => { setMode('none'); generateSpace('none'); }}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${mode === 'none' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                        Base Constraints
                    </button>
                    <button
                        onClick={() => { setMode('dist'); generateSpace('dist'); }}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${mode === 'dist' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                        dist (Weights)
                    </button>
                    <button
                        onClick={() => { setMode('soft'); generateSpace('soft'); }}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${mode === 'soft' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                        soft (Defaults)
                    </button>
                    <button
                        onClick={() => { setMode('solve_before'); generateSpace('solve_before'); }}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${mode === 'solve_before' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                        solve...before
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <div className="rounded-xl border border-white/5 bg-slate-950 p-4 font-mono text-xs md:text-sm text-slate-300">
                        <div className="text-pink-400">class</div> packet;
                        <br />&nbsp;&nbsp;<div className="inline text-blue-400">rand byte</div> length;
                        <br />&nbsp;&nbsp;<div className="inline text-blue-400">rand byte</div> payload[];
                        <br /><br />
                        <div className="text-yellow-400">constraint</div> c_base {'{'}
                        <br />&nbsp;&nbsp;length <div className="inline text-emerald-400">inside</div> {'{[4:16]};'}
                        <br />&nbsp;&nbsp;payload.size() == length;
                        <br />{'}'}

                        <AnimatePresence mode="popLayout">
                            {mode === 'dist' && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 text-purple-300">
                                    <div className="text-yellow-400">constraint</div> c_dist {'{'}
                                    <br />&nbsp;&nbsp;length <div className="inline text-emerald-400">dist</div> {'{ 8 := 80, [4:16] :/ 20 };'}
                                    <br />{'}'}
                                </motion.div>
                            )}
                            {mode === 'soft' && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 text-emerald-300">
                                    <div className="text-yellow-400">constraint</div> c_soft {'{'}
                                    <br />&nbsp;&nbsp;<div className="inline text-emerald-400">soft</div> length == 16;
                                    <br />{'}'}
                                </motion.div>
                            )}
                            {mode === 'solve_before' && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 text-amber-300">
                                    <div className="text-yellow-400">constraint</div> c_order {'{'}
                                    <br />&nbsp;&nbsp;<div className="inline text-emerald-400">solve</div> length <div className="inline text-emerald-400">before</div> payload;
                                    <br />{'}'}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="rounded-xl bg-blue-500/10 p-4 border border-blue-500/20">
                        <h4 className="flex items-center space-x-2 text-sm font-medium text-blue-400">
                            <span>💡 LRM Insight</span>
                        </h4>
                        <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                            {mode === 'none' && "The solver finds all valid intersections of variables. Initially, without constraints, all combinations (1-16) are possible. The base constraints prune illegal states."}
                            {mode === 'dist' && "IEEE 1800-2023 Clause 18.5.4: 'dist' allows specifying weighted distributions. The solver will hit length=8 80% of the time, shaping the solution space."}
                            {mode === 'soft' && "Clause 18.5.10: Soft constraints act as overridable defaults. The solver treats length=16 as a strong preference, but higher-priority hard constraints can override it."}
                            {mode === 'solve_before' && "Clause 18.5.11: Guides the solver's probability distribution when arrays are involved, forcing independent flat distribution for the 'before' variable."}
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-2 relative h-[300px] md:h-[400px] rounded-xl border border-white/10 bg-slate-950 overflow-hidden flex items-center justify-center p-8">
                    {points.length === 0 && !isSolving && (
                        <div className="text-slate-500 flex flex-col items-center">
                            <span className="text-4xl mb-2">🎯</span>
                            <p>Select a constraint mode to visualize</p>
                        </div>
                    )}

                    {isSolving && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                        </div>
                    )}

                    <div className="relative w-full h-full">
                        {/* Axis labels */}
                        <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-slate-500">payload_size</div>
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-500">length</div>

                        {/* Points */}
                        {points.map((pt) => {
                            // Map 1-16 to percentages (0-100%)
                            const left = ((pt.length - 1) / 15) * 100;
                            const bottom = ((pt.payload_size - 1) / 15) * 100;

                            // Scale size/opacity based on probability weight
                            const scale = mode === 'dist' || mode === 'soft'
                                ? 0.5 + (pt.probability * 3)
                                : 1;

                            const opacity = pt.isValid
                                ? (mode === 'dist' || mode === 'soft' ? 0.4 + pt.probability : 1)
                                : 0.1;

                            const color = pt.isValid
                                ? (mode === 'dist' ? 'bg-purple-500' : mode === 'soft' ? 'bg-emerald-500' : mode === 'solve_before' ? 'bg-amber-500' : 'bg-blue-500')
                                : 'bg-red-500';

                            return (
                                <motion.div
                                    key={pt.id}
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity, scale: pt.isValid ? scale : 0.5 }}
                                    transition={{ duration: 0.4, delay: pt.id * 0.005 }}
                                    className={`absolute h-3 w-3 -ml-1.5 -mb-1.5 rounded-full ${color} shadow-[0_0_10px_currentColor]`}
                                    style={{ left: `${left}%`, bottom: `${bottom}%` }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
