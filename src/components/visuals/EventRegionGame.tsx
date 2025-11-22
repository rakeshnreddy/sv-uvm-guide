'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type Region = 'Active' | 'Inactive' | 'NBA' | 'Postponed';

interface Question {
    id: number;
    code: string;
    region: Region;
    explanation: string;
}

const QUESTIONS: Question[] = [
    {
        id: 1,
        code: 'a = b + c;',
        region: 'Active',
        explanation: 'Blocking assignments execute immediately in the Active region.'
    },
    {
        id: 2,
        code: 'q <= d;',
        region: 'NBA',
        explanation: 'Non-blocking assignments schedule updates for the NBA region to avoid races.'
    },
    {
        id: 3,
        code: '#0 a = 1;',
        region: 'Inactive',
        explanation: 'Explicit zero-delay (#0) moves execution to the Inactive region.'
    },
    {
        id: 4,
        code: '$display("Value=%0d", val);',
        region: 'Active',
        explanation: 'System tasks like $display execute immediately when encountered in the Active region.'
    },
    {
        id: 5,
        code: 'program test; ... final begin ... end',
        region: 'Postponed',
        explanation: 'The final block executes in the Postponed region, after all other activity.'
    },
    {
        id: 6,
        code: 'assert property (@(posedge clk) ...);',
        region: 'Postponed',
        explanation: 'Assertions are sampled in the Preponed region but reported/checked effectively at the end of the tick.'
    }
];

const REGIONS: { id: Region; color: string; desc: string }[] = [
    { id: 'Active', color: 'bg-blue-500', desc: 'Execute Now' },
    { id: 'Inactive', color: 'bg-gray-500', desc: '#0 Delays' },
    { id: 'NBA', color: 'bg-emerald-500', desc: 'Update Later (<=)' },
    { id: 'Postponed', color: 'bg-purple-500', desc: 'Read-Only / Final' },
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
                <div className="bg-black/40 p-6 rounded-xl border border-slate-800 font-mono text-lg text-center text-slate-200 shadow-inner min-h-[100px] flex items-center justify-center">
                    <code>{currentQuestion.code}</code>
                </div>

                {/* Region Buttons */}
                <div className="grid grid-cols-2 gap-4">
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
