"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertOctagon, Info, ArrowRight } from "lucide-react";
import InterviewQuestionPlayground from "./InterviewQuestionPlayground";

type Scenario = "base" | "solve_before" | "soft_hard" | "contradiction";

export default function ConstraintSolverVisualizer() {
    const [scenario, setScenario] = useState<Scenario>("base");
    const [step, setStep] = useState(0);

    // Define 4x4 state space for variables A and B (0 to 3)
    const grid = Array.from({ length: 4 }, (_, a) =>
        Array.from({ length: 4 }, (_, b) => ({ a, b }))
    ).flat();

    const scenarios = {
        base: {
            title: "Basic Pruning",
            code: `class Packet;
  rand bit [1:0] A, B;
  constraint c { A + B < 4; }
endclass`,
            steps: [
                { desc: "Initial State Space: 16 possibilities." },
                { desc: "Evaluating constraint: A + B < 4" },
                { desc: "Pruning invalid states where A + B >= 4." },
                { desc: "Randomizer will pick uniformly from remaining valid states." }
            ],
            getState: (a: number, b: number, step: number) => {
                if (step < 2) return "untested";
                if (a + b < 4) return "valid";
                return step >= 2 ? "pruned" : "untested";
            }
        },
        solve_before: {
            title: "Solve Before",
            code: `class Packet;
  rand bit [1:0] A, B;
  constraint c1 { (A == 0) -> (B == 3); }
  constraint order { solve A before B; }
endclass`,
            steps: [
                { desc: "Without solve before, A=0, B=3 is 1/13 probability." },
                { desc: "Evaluating A first: A picked from {0, 1, 2, 3} (25% each)." },
                { desc: "If A=0, B must be 3. Prob is 25%." },
                { desc: "Solve before changes probability distribution drastically." }
            ],
            getState: (a: number, b: number, step: number) => {
                if (a === 0 && b !== 3) return step >= 1 ? "pruned" : "untested";
                if (step === 2 && a === 0 && b === 3) return "highlight";
                if (step >= 1) return "valid";
                return "untested";
            }
        },
        soft_hard: {
            title: "Soft vs Hard",
            code: `class Packet;
  rand bit [1:0] A, B;
  constraint hard_c { A > 1; }
  constraint soft_c { soft B == 0; }
  constraint override { B == 3; } // From inline randomize with
endclass`,
            steps: [
                { desc: "Evaluating hard constraint: A > 1." },
                { desc: "Evaluating soft constraint: B == 0." },
                { desc: "Hard constraint overrides soft constraint: B == 3." },
                { desc: "Soft constraints are discarded if they conflict with hard." }
            ],
            getState: (a: number, b: number, step: number) => {
                if (step >= 0 && a <= 1) return "pruned"; // hard constraint
                if (step === 1 && b !== 0) return "soft-pruned"; // soft constraint effect shown temporarily
                if (step >= 2 && b !== 3) return "pruned"; // hard override
                if (step >= 2 && b === 3 && a > 1) return "valid";
                return "untested";
            }
        },
        contradiction: {
            title: "Contradiction",
            code: `class Packet;
  rand bit [1:0] A, B;
  constraint c1 { A == 3; }
  constraint c2 { A < 2; }
endclass`,
            steps: [
                { desc: "Evaluating constraint c1: A == 3." },
                { desc: "Evaluating constraint c2: A < 2." },
                { desc: "Contradiction! Solution space is empty." },
                { desc: "randomize() returns 0. State space collapsed." }
            ],
            getState: (a: number, b: number, step: number) => {
                if (step === 0 && a !== 3) return "pruned";
                if (step >= 1) return "pruned-all";
                return "untested";
            }
        }
    };

    const current = scenarios[scenario];

    return (
        <div className="my-8 flex flex-col gap-6 font-sans">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                {/* Left Column: Code and Controls */}
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                        <h3 className="m-0 text-lg font-semibold dark:text-slate-100">Solver Engine</h3>
                        <select
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            value={scenario}
                            onChange={(e) => {
                                setScenario(e.target.value as Scenario);
                                setStep(0);
                            }}
                        >
                            <option value="base">Basic Pruning</option>
                            <option value="solve_before">Solve Before</option>
                            <option value="soft_hard">Soft vs Hard</option>
                            <option value="contradiction">Contradiction</option>
                        </select>
                    </div>

                    <div className="rounded-lg bg-slate-900 p-4 font-mono text-sm leading-relaxed text-slate-300 shadow-inner">
                        <pre><code>{current.code}</code></pre>
                    </div>

                    <div className="flex flex-1 flex-col justify-end gap-3">
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
                            <div className="mb-2 flex items-center gap-2 font-medium text-blue-900 dark:text-blue-200">
                                <Info size={16} />
                                <span>Step {step + 1} of 4</span>
                            </div>
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                {current.steps[step].desc}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setStep(Math.max(0, step - 1))}
                                disabled={step === 0}
                                className="flex-1 rounded-md border border-slate-300 bg-white py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setStep(Math.min(3, step + 1))}
                                disabled={step === 3}
                                className="flex-[2] flex items-center justify-center gap-2 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-800"
                            >
                                {step === 3 ? "Finished" : "Next Step"} <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: State Space Grid */}
                <div className="relative flex min-h-[400px] flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-slate-500">
                        State Space (A x B)
                    </h3>

                    <div className="flex flex-1 items-center justify-center">
                        <div className="grid grid-cols-4 gap-2 sm:gap-4">
                            <AnimatePresence>
                                {grid.map(({ a, b }) => {
                                    const state = current.getState(a, b, step);

                                    let bgColor = "bg-slate-100 dark:bg-slate-800";
                                    let borderColor = "border-slate-200 dark:border-slate-700";
                                    let textColor = "text-slate-600 dark:text-slate-400";
                                    let icon = null;

                                    if (state === "valid") {
                                        bgColor = "bg-green-100 dark:bg-green-900/30";
                                        borderColor = "border-green-400 dark:border-green-600";
                                        textColor = "text-green-700 dark:text-green-400";
                                        icon = <Check size={16} className="absolute right-1 top-1 opacity-50" />;
                                    } else if (state === "pruned") {
                                        bgColor = "bg-slate-50 dark:bg-slate-900";
                                        borderColor = "border-slate-200 dark:border-slate-800";
                                        textColor = "text-slate-300 dark:text-slate-600";
                                        icon = <X size={16} className="absolute right-1 top-1 opacity-20" />;
                                    } else if (state === "pruned-all") {
                                        bgColor = "bg-rose-50 dark:bg-rose-950/30";
                                        borderColor = "border-rose-200 dark:border-rose-900";
                                        textColor = "text-rose-400 dark:text-rose-700";
                                        icon = <AlertOctagon size={16} className="absolute right-1 top-1 opacity-40 text-rose-500" />;
                                    } else if (state === "soft-pruned") {
                                        bgColor = "bg-amber-50 dark:bg-amber-900/20";
                                        borderColor = "border-amber-300 dark:border-amber-700";
                                        textColor = "text-amber-600 dark:text-amber-500";
                                        icon = <X size={16} className="absolute right-1 top-1 opacity-50" />;
                                    } else if (state === "highlight") {
                                        bgColor = "bg-blue-100 dark:bg-blue-900/40";
                                        borderColor = "border-blue-400 dark:border-blue-500";
                                        textColor = "text-blue-700 dark:text-blue-300";
                                        icon = <Check size={16} className="absolute right-1 top-1 text-blue-500" />;
                                    }

                                    return (
                                        <motion.div
                                            key={`${a}-${b}`}
                                            layout
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{
                                                scale: state.includes("pruned") ? 0.95 : 1,
                                                opacity: 1,
                                                backgroundColor: "var(--tw-colors)",
                                            }}
                                            transition={{ duration: 0.3 }}
                                            className={`relative flex h-14 w-14 sm:h-16 sm:w-16 flex-col items-center justify-center rounded-lg border-2 ${bgColor} ${borderColor} ${textColor}`}
                                        >
                                            {icon}
                                            <span className="font-mono text-xs font-bold sm:text-sm">A:{a}</span>
                                            <span className="font-mono text-xs font-bold sm:text-sm">B:{b}</span>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            <InterviewQuestionPlayground
                title="Constraint Solver Pitfall"
                question={
                    <p>
                        You have a class with <code>rand bit A; rand bit B;</code> and a constraint <code>A == 0 -{'>'} B == 1;</code>.
                        If you do not use <code>solve A before B;</code>, what is the probability that <code>A</code> evaluates to 0?
                    </p>
                }
                options={[
                    {
                        id: "opt1",
                        label: "50%, because A is a 1-bit variable (0 or 1).",
                        isCorrect: false,
                        explanation: "Incorrect. The solver looks at the entire valid solution space at once unless 'solve before' is used."
                    },
                    {
                        id: "opt2",
                        label: "33.3%, because there are 3 valid global states.",
                        isCorrect: true,
                        explanation: "Correct! The valid states are (A=0, B=1), (A=1, B=0), and (A=1, B=1). The solver picks uniformly from these 3 states, so P(A=0) = 1/3."
                    },
                    {
                        id: "opt3",
                        label: "100%, implication forces A to be 0 first.",
                        isCorrect: false,
                        explanation: "Incorrect. Implication A -> B means 'if A is true, B must be true', but it does not force A to be true."
                    }
                ]}
            />
        </div>
    );
}
