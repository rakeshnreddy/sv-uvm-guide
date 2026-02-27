"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type BinType = 'auto' | 'explicit' | 'ignore' | 'illegal';

interface BinDefinition {
    id: string;
    name: string;
    type: BinType;
    range: [number, number];
    hitCount: number;
}

export const CovergroupBuilder = () => {
    const [bins, setBins] = useState<BinDefinition[]>([
        { id: '1', name: 'low', type: 'explicit', range: [0, 3], hitCount: 0 },
        { id: '2', name: 'high', type: 'explicit', range: [12, 15], hitCount: 0 },
    ]);

    const [stimulusQueue, setStimulusQueue] = useState<number[]>([]);
    const [currentValue, setCurrentValue] = useState<number | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>("Ready to sample.");
    const [isIllegalHit, setIsIllegalHit] = useState(false);

    // Generate random stimulus between 0 and 15
    const generateStimulus = () => {
        if (isIllegalHit) return;

        // Slight bias towards middle values to show coverage holes
        const val = Math.random() > 0.3 ? Math.floor(Math.random() * 8) + 4 : Math.floor(Math.random() * 16);

        setStimulusQueue(prev => [...prev, val]);
    };

    const addBin = (type: BinType) => {
        const newId = Math.random().toString(36).substr(2, 9);
        let newBin: BinDefinition;

        if (type === 'explicit') {
            newBin = { id: newId, name: 'mid', type: 'explicit', range: [4, 11], hitCount: 0 };
        } else if (type === 'ignore') {
            newBin = { id: newId, name: 'ignore_mid', type: 'ignore', range: [4, 7], hitCount: 0 };
        } else {
            newBin = { id: newId, name: 'fatal_err', type: 'illegal', range: [15, 15], hitCount: 0 };
        }

        setBins(prev => [...prev, newBin]);
    };

    const removeBin = (id: string) => {
        setBins(prev => prev.filter(b => b.id !== id));
    };

    const resetCoverage = () => {
        setBins(prev => prev.map(b => ({ ...b, hitCount: 0 })));
        setStimulusQueue([]);
        setCurrentValue(null);
        setIsIllegalHit(false);
        setStatusMessage("Coverage reset.");
    };

    // Process stimulus queue
    useEffect(() => {
        if (stimulusQueue.length === 0 || isIllegalHit) return;

        const val = stimulusQueue[0];
        let timeoutId: NodeJS.Timeout;

        timeoutId = setTimeout(() => {
            setCurrentValue(val);

            let hitAny = false;
            let hitIllegal = false;
            let hitIgnore = false;

            // Check against bins in priority order: illegal > ignore > explicit
            const illegalBins = bins.filter(b => b.type === 'illegal');
            const ignoreBins = bins.filter(b => b.type === 'ignore');
            const explicitBins = bins.filter(b => b.type === 'explicit');

            for (const b of illegalBins) {
                if (val >= b.range[0] && val <= b.range[1]) {
                    hitIllegal = true;
                    setStatusMessage(`FATAL: Illegal bin '${b.name}' sampled value ${val}! Simulation terminated.`);
                    setIsIllegalHit(true);
                    break;
                }
            }

            if (!hitIllegal) {
                for (const b of ignoreBins) {
                    if (val >= b.range[0] && val <= b.range[1]) {
                        hitIgnore = true;
                        setStatusMessage(`Value ${val} ignored (matches '${b.name}').`);
                        break;
                    }
                }
            }

            if (!hitIllegal && !hitIgnore) {
                setBins(prev => prev.map(b => {
                    if (b.type === 'explicit' && val >= b.range[0] && val <= b.range[1]) {
                        hitAny = true;
                        return { ...b, hitCount: b.hitCount + 1 };
                    }
                    return b;
                }));

                if (hitAny) {
                    setStatusMessage(`Sampled ${val}: Hit explicit bin.`);
                } else {
                    setStatusMessage(`Sampled ${val}: Covered by default (no explicit bin).`);
                }
            }

            setStimulusQueue(prev => prev.slice(1));
        }, 400); // Animation delay

        return () => clearTimeout(timeoutId);
    }, [stimulusQueue, bins, isIllegalHit]);

    // Calculate total coverage %
    const validExplicitBins = bins.filter(b => b.type === 'explicit');
    const coveredBins = validExplicitBins.filter(b => b.hitCount > 0).length;
    const coveragePercent = validExplicitBins.length > 0 ? Math.round((coveredBins / validExplicitBins.length) * 100) : 0;

    return (
        <div className="flex flex-col space-y-6 rounded-2xl border border-white/10 bg-slate-900 p-6 font-sans shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-4 gap-4">
                <div>
                    <h3 className="text-xl font-semibold text-white">Covergroup Builder</h3>
                    <p className="text-sm text-slate-400">Construct coverage bins and see how sampled values affect your coverage metric.</p>
                </div>

                <div className="flex bg-slate-950 rounded-lg p-2 items-center space-x-4 border border-white/5">
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Total Coverage</span>
                        <span className={`text-2xl font-bold ${coveragePercent === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {coveragePercent}%
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Code Editor Side */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-slate-300">Coverage Definition</h4>
                        <div className="flex gap-2">
                            <button
                                onClick={() => addBin('explicit')}
                                disabled={isIllegalHit}
                                className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-colors disabled:opacity-50"
                            >
                                + Explicit Bin
                            </button>
                            <button
                                onClick={() => addBin('ignore')}
                                disabled={isIllegalHit}
                                className="px-2 py-1 text-xs rounded bg-slate-500/20 text-slate-300 hover:bg-slate-500/30 border border-slate-500/30 transition-colors disabled:opacity-50"
                            >
                                + Ignore Bin
                            </button>
                            <button
                                onClick={() => addBin('illegal')}
                                disabled={bins.some(b => b.type === 'illegal') || isIllegalHit}
                                className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-colors disabled:opacity-50"
                            >
                                + Illegal Bin
                            </button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-slate-950 p-4 font-mono text-sm text-slate-300 relative overflow-hidden">
                        <div className="text-pink-400 mb-2">covergroup cg_example;</div>
                        <div className="ml-4 text-blue-400 mb-2">coverpoint<span className="text-slate-300"> data_val </span>{`{`}</div>

                        <AnimatePresence>
                            {bins.map((bin) => (
                                <motion.div
                                    key={bin.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="ml-8 my-1 flex items-center justify-between group"
                                >
                                    <div>
                                        {bin.type === 'illegal' && <span className="text-red-400">illegal_bins </span>}
                                        {bin.type === 'ignore' && <span className="text-slate-400">ignore_bins </span>}
                                        {bin.type === 'explicit' && <span className="text-emerald-400">bins </span>}
                                        <span className="text-yellow-200">{bin.name}</span> = {`{`}[{bin.range[0]}:{bin.range[1]}]{`}`};
                                    </div>
                                    <button
                                        onClick={() => removeBin(bin.id)}
                                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 px-2 transition-opacity"
                                    >
                                        ×
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        <div className="ml-4 mt-2 text-slate-300">{`}`}</div>
                        <div className="text-pink-400 mt-2">endgroup</div>

                        {isIllegalHit && (
                            <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                                <div>
                                    <div className="text-4xl mb-4">💥</div>
                                    <h3 className="text-red-400 font-bold text-lg mb-2">SIMULATION FATAL</h3>
                                    <p className="text-red-200 text-sm">Illegal bin sampled. Simulator haltered.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Visualization Side */}
                <div className="space-y-4 flex flex-col">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-slate-300">Simulation Status</h4>
                        <div className="flex gap-2">
                            <button
                                onClick={generateStimulus}
                                disabled={isIllegalHit}
                                className="px-3 py-1 text-sm rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                            >
                                Sample Random ()
                            </button>
                            <button
                                onClick={resetCoverage}
                                className="px-3 py-1 text-sm rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    <div className={`p-3 rounded-lg border text-sm transition-colors duration-300 ${isIllegalHit ? 'bg-red-950/50 border-red-500/30 text-red-300' :
                            statusMessage.includes('Hit') ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300' :
                                statusMessage.includes('ignored') ? 'bg-slate-800/50 border-slate-600/30 text-slate-400' :
                                    'bg-blue-950/50 border-blue-500/30 text-blue-300'
                        }`}>
                        {statusMessage}
                    </div>

                    <div className="flex-1 rounded-xl border border-white/5 bg-slate-950 p-4">
                        <h5 className="text-xs uppercase tracking-wider text-slate-500 mb-4">Coverage Space (0-15)</h5>

                        <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: 16 }).map((_, i) => {
                                const isCurrent = currentValue === i;

                                // Determine bin classification
                                let bgType = 'bg-slate-800/50';
                                let borderType = 'border-slate-700/50';
                                let textType = 'text-slate-600';

                                let isHit = false;

                                // Identify priority: Illegal > Ignore > Explicit
                                const isIllegal = bins.some(b => b.type === 'illegal' && i >= b.range[0] && i <= b.range[1]);
                                const isIgnore = !isIllegal && bins.some(b => b.type === 'ignore' && i >= b.range[0] && i <= b.range[1]);
                                const explicitBin = !isIllegal && !isIgnore && bins.find(b => b.type === 'explicit' && i >= b.range[0] && i <= b.range[1]);

                                if (isIllegal) {
                                    bgType = 'bg-red-950/40';
                                    borderType = 'border-red-900/50';
                                    textType = 'text-red-700';
                                } else if (isIgnore) {
                                    bgType = 'bg-slate-900/80';
                                    borderType = 'border-slate-800 border-dashed';
                                    textType = 'text-slate-700';
                                } else if (explicitBin) {
                                    isHit = explicitBin.hitCount > 0;
                                    bgType = isHit ? 'bg-emerald-500/20' : 'bg-blue-500/10';
                                    borderType = isHit ? 'border-emerald-500/40' : 'border-blue-500/30';
                                    textType = isHit ? 'text-emerald-400' : 'text-blue-400';
                                }

                                return (
                                    <motion.div
                                        key={i}
                                        animate={{
                                            scale: isCurrent ? 1.1 : 1,
                                            backgroundColor: isCurrent ? 'var(--tw-colors-amber-500)' : '', // Override with direct color is rough in tailwind, fallback below
                                        }}
                                        className={`relative flex items-center justify-center p-2 rounded border transition-all duration-300 ${bgType} ${borderType} ${isCurrent ? '!bg-amber-500/40 !border-amber-400 !text-amber-200 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)] z-10' : textType}`}
                                    >
                                        <span className="font-mono text-sm">{i}</span>
                                        {isHit && !isCurrent && (
                                            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_currentColor]"></div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>

                        <div className="mt-6 flex flex-wrap gap-4 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-400"><div className="w-3 h-3 rounded bg-blue-500/10 border border-blue-500/30"></div> Unhit Explicit</div>
                            <div className="flex items-center gap-1.5 text-slate-400"><div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40"></div> Hit Explicit</div>
                            <div className="flex items-center gap-1.5 text-slate-400"><div className="w-3 h-3 rounded bg-slate-900 border border-slate-800 border-dashed"></div> Ignored</div>
                            <div className="flex items-center gap-1.5 text-slate-400"><div className="w-3 h-3 rounded bg-red-950/40 border border-red-900/50"></div> Illegal</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
