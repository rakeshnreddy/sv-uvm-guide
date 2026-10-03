'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Regions follow IEEE 1800-2023 §4.4.2. `final` blocks are deliberately absent:
// they run once at the end of simulation (§9.2.3), not in a time-slot region.
export type Region = 'Preponed' | 'Active' | 'Inactive' | 'NBA' | 'Observed' | 'Reactive' | 'Re-NBA' | 'Postponed';

export interface Question {
    id: number;
    code: string;
    /** What the learner must locate, e.g. "the write to q". */
    prompt: string;
    region: Region;
    explanation: string;
}

export const QUESTIONS: Question[] = [
    {
        id: 1,
        code: 'a = b + c;',
        prompt: 'Where is a written?',
        region: 'Active',
        explanation: 'Blocking assignments evaluate and write immediately in the Active region (§10.4.1).'
    },
    {
        id: 2,
        code: 'q <= d;',
        prompt: 'Where is q written?',
        region: 'NBA',
        explanation: 'The right side is read in Active, but the update to q is scheduled in the NBA region (§10.4.2).'
    },
    {
        id: 3,
        code: '#0 a = 1;',
        prompt: 'Where does this statement resume?',
        region: 'Inactive',
        explanation: 'An explicit #0 suspends the process into the Inactive region; it resumes only after Active is empty (§4.4.2.3).'
    },
    {
        id: 4,
        code: '$strobe("q=%0d", q);',
        prompt: 'Where is the line printed?',
        region: 'Postponed',
        explanation: '$strobe prints at the end of the time slot, in the read-only Postponed region, so it shows settled values (§21.2.2).'
    },
    {
        id: 5,
        code: 'assert property (@(posedge clk) req |-> ##1 gnt);',
        prompt: 'Where is the property evaluated?',
        region: 'Observed',
        explanation: 'Concurrent assertions are evaluated in the Observed region using values sampled in Preponed (§16.5.1). They are not checked in Postponed.'
    },
    {
        id: 6,
        code: '@(posedge clk) assert property (...)  // req, gnt',
        prompt: 'Where are req and gnt sampled?',
        region: 'Preponed',
        explanation: 'Sampled values come from the Preponed region: the values before anything changed in this time slot (§16.5.1, §4.4.2.1).'
    },
    {
        id: 7,
        code: 'vif.cb.din <= 8\'h07;  // clocking block, #0 output skew',
        prompt: 'Where does din change?',
        region: 'Re-NBA',
        explanation: 'Synchronous drives through a clocking block are scheduled in the Re-NBA region, after the design NBA updates (§14.16).'
    },
    {
        id: 8,
        code: 'program tb; initial @(posedge clk) a = 1; endprogram',
        prompt: 'Where does the program code execute?',
        region: 'Reactive',
        explanation: 'Blocking assignments in program blocks are scheduled in the Reactive region (§4.4.2.6).'
    }
];

const REGIONS: { id: Region; color: string; desc: string }[] = [
    { id: 'Preponed', color: 'bg-slate-500', desc: 'Sample (read-only)' },
    { id: 'Active', color: 'bg-blue-500', desc: '= writes, wake-ups' },
    { id: 'Inactive', color: 'bg-gray-500', desc: '#0 resumes' },
    { id: 'NBA', color: 'bg-emerald-500', desc: '<= updates' },
    { id: 'Observed', color: 'bg-sky-500', desc: 'Assertions evaluate' },
    { id: 'Reactive', color: 'bg-violet-500', desc: 'Program code' },
    { id: 'Re-NBA', color: 'bg-fuchsia-500', desc: 'Clocking drives' },
    { id: 'Postponed', color: 'bg-purple-500', desc: '$strobe (read-only)' },
];

export default function EventRegionGame() {
    const [started, setStarted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

    const currentQuestion = QUESTIONS[currentIndex];
    const isFinished = currentIndex >= QUESTIONS.length;

    const handleSelect = (region: Region) => {
        if (selectedRegion) return; // Prevent multiple guesses
        setSelectedRegion(region);
        const correct = region === currentQuestion.region;
        setIsCorrect(correct);
        if (correct) setScore(s => s + 1);
    };

    const nextQuestion = () => {
        setSelectedRegion(null);
        setIsCorrect(null);
        setCurrentIndex(i => i + 1);
    };

    const resetGame = () => {
        setStarted(false);
        setCurrentIndex(0);
        setScore(0);
        setSelectedRegion(null);
        setIsCorrect(null);
    };

    if (!started) {
        return (
            <Card className="w-full max-w-2xl mx-auto border-indigo-500/30 bg-indigo-950/10">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl text-indigo-400">Event Region Scheduler</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6 py-10">
                    <div className="p-6 rounded-full bg-indigo-500/20 text-indigo-300">
                        <Play size={48} />
                    </div>
                    <p className="text-center text-muted-foreground max-w-md">
                        Test your knowledge of the SystemVerilog scheduler.
                        Can you place each code snippet in the correct Event Region?
                    </p>
                    <Button onClick={() => setStarted(true)} size="lg" className="bg-indigo-600 hover:bg-indigo-500">
                        Start Challenge
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (isFinished) {
        return (
            <Card className="w-full max-w-2xl mx-auto border-emerald-500/30 bg-emerald-950/10">
                <CardContent className="flex flex-col items-center gap-6 py-10">
                    <div className="text-4xl font-bold text-emerald-400">
                        {score} / {QUESTIONS.length}
                    </div>
                    <p className="text-muted-foreground">
                        {score === QUESTIONS.length ? 'Perfect Score! You are a Scheduler Master.' : 'Good practice! Review the regions and try again.'}
                    </p>
                    <Button onClick={resetGame} variant="outline">
                        Play Again
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-2xl mx-auto border-slate-700 bg-slate-900/50">
            <CardHeader className="flex flex-row justify-between items-center pb-2">
                <span className="text-sm font-mono text-slate-400">Snippet {currentIndex + 1}/{QUESTIONS.length}</span>
                <span className="text-sm font-mono text-slate-400">Score: {score}</span>
            </CardHeader>

            <CardContent className="space-y-8">
                {/* Code Snippet Area */}
                <div className="bg-black/40 p-6 rounded-xl border border-slate-800 font-mono text-lg text-center text-slate-200 shadow-inner min-h-[100px] flex flex-col items-center justify-center gap-3">
                    <code className="break-all [font-variant-ligatures:none]">{currentQuestion.code}</code>
                    <p className="font-sans text-sm font-semibold text-amber-300">{currentQuestion.prompt}</p>
                </div>

                {/* Region Buttons */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {REGIONS.map((region) => {
                        const isSelected = selectedRegion === region.id;
                        const isTarget = currentQuestion.region === region.id;
                        const showResult = selectedRegion !== null;

                        let variantClass = "hover:opacity-90 transition-all";
                        if (showResult) {
                            if (isTarget) variantClass = "ring-2 ring-emerald-500 opacity-100";
                            else if (isSelected && !isTarget) variantClass = "opacity-50 ring-2 ring-red-500";
                            else variantClass = "opacity-30 grayscale";
                        }

                        return (
                            <button
                                key={region.id}
                                onClick={() => handleSelect(region.id)}
                                disabled={showResult}
                                className={`
                  relative p-4 rounded-lg text-left border border-white/5
                  ${region.color} ${variantClass}
                `}
                            >
                                <div className="font-bold text-white">{region.id}</div>
                                <div className="text-xs text-white/80">{region.desc}</div>

                                {showResult && isTarget && (
                                    <motion.div
                                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                                        className="absolute top-2 right-2 text-white"
                                    >
                                        <CheckCircle2 size={20} />
                                    </motion.div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Feedback Area */}
                <AnimatePresence mode="wait">
                    {selectedRegion && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`p-4 rounded-lg border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}
                        >
                            <div className="flex items-start gap-3">
                                {isCorrect ? <CheckCircle2 className="text-emerald-400 shrink-0" /> : <XCircle className="text-red-400 shrink-0" />}
                                <div className="space-y-2">
                                    <p className={`font-semibold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isCorrect ? 'Correct!' : `Incorrect. It belongs in ${currentQuestion.region}.`}
                                    </p>
                                    <p className="text-sm text-slate-300">{currentQuestion.explanation}</p>
                                    <Button onClick={nextQuestion} size="sm" className="mt-2" variant="secondary">
                                        Next <ArrowRight size={16} className="ml-2" />
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
