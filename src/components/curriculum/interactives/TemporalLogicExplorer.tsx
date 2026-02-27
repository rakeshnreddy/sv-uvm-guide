"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Clock, PlayCircle } from "lucide-react";
import InterviewQuestionPlayground from "./InterviewQuestionPlayground";

type PropType = "overlap" | "non_overlap" | "window";

const NUM_CYCLES = 8;

export default function TemporalLogicExplorer() {
    const [propType, setPropType] = useState<PropType>("overlap");

    // Waveform state: 0 = low, 1 = high
    const [reqTrack, setReqTrack] = useState<number[]>([0, 1, 0, 0, 1, 0, 0, 0]);
    const [gntTrack, setGntTrack] = useState<number[]>([0, 1, 0, 0, 0, 1, 0, 0]);

    const toggleSignal = (track: "req" | "gnt", cycle: number) => {
        if (track === "req") {
            const newTrack = [...reqTrack];
            newTrack[cycle] = newTrack[cycle] === 0 ? 1 : 0;
            setReqTrack(newTrack);
        } else {
            const newTrack = [...gntTrack];
            newTrack[cycle] = newTrack[cycle] === 0 ? 1 : 0;
            setGntTrack(newTrack);
        }
    };

    const evaluateCycle = (cycle: number): "pass" | "fail" | "vacuous" | "pending" => {
        // If requirement doesn't trigger, it's vacuous pass
        if (reqTrack[cycle] === 0) return "vacuous";

        if (propType === "overlap") {
            // req |-> gnt (gnt must be 1 in the same cycle)
            return gntTrack[cycle] === 1 ? "pass" : "fail";
        }

        if (propType === "non_overlap") {
            // req |=> gnt (gnt must be 1 in cycle + 1)
            if (cycle + 1 >= NUM_CYCLES) return "pending";
            return gntTrack[cycle + 1] === 1 ? "pass" : "fail";
        }

        if (propType === "window") {
            // req |-> ##[1:2] gnt
            if (cycle + 1 >= NUM_CYCLES) return "pending";
            if (gntTrack[cycle + 1] === 1) return "pass";
            if (cycle + 2 >= NUM_CYCLES) return "pending";
            if (gntTrack[cycle + 2] === 1) return "pass";
            return "fail";
        }

        return "vacuous";
    };

    const getPropText = () => {
        switch (propType) {
            case "overlap": return "assert property (@(posedge clk) req |-> gnt);";
            case "non_overlap": return "assert property (@(posedge clk) req |=> gnt);";
            case "window": return "assert property (@(posedge clk) req |-> ##[1:2] gnt);";
        }
    };

    const getPropDesc = () => {
        switch (propType) {
            case "overlap": return "Overlapping implication: GNT must be high in the SAME cycle as REQ.";
            case "non_overlap": return "Non-overlapping implication: GNT must be high in the NEXT cycle after REQ.";
            case "window": return "Sliding window: GNT must be high 1 OR 2 cycles after REQ.";
        }
    };

    return (
        <div className="my-8 flex flex-col gap-6 font-sans">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

                {/* Header Controls */}
                <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-center dark:border-slate-800">
                    <div>
                        <h3 className="m-0 flex items-center gap-2 text-xl font-bold dark:text-slate-100">
                            <Clock className="text-blue-500" /> SVA Temporal Debugger
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Click on the waveform pulses below to toggle signals and observe the assertion evaluation.
                        </p>
                    </div>

                    <select
                        value={propType}
                        onChange={(e) => setPropType(e.target.value as PropType)}
                        className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                        <option value="overlap">req |--{">"} gnt</option>
                        <option value="non_overlap">req |=={">"} gnt</option>
                        <option value="window">req |--{">"} ##[1:2] gnt</option>
                    </select>
                </div>

                {/* Assertion Code Box */}
                <div className="mb-8 rounded-lg bg-slate-900 p-4 font-mono text-sm leading-relaxed text-blue-300 shadow-inner">
                    <pre><code>{getPropText()}</code></pre>
                    <div className="mt-2 text-xs font-sans text-slate-400">
                        {getPropDesc()}
                    </div>
                </div>

                {/* Interactive Waveform grid */}
                <div className="flex flex-col gap-1 overflow-x-auto pb-4">
                    <div className="flex min-w-[600px] flex-col gap-2">

                        {/* Clock track */}
                        <div className="flex h-10 items-center">
                            <div className="w-16 flex-shrink-0 font-mono text-sm font-bold text-slate-500">CLK</div>
                            <div className="flex flex-1">
                                {Array.from({ length: NUM_CYCLES }).map((_, i) => (
                                    <div key={i} className="relative flex flex-1 items-end justify-center border-l border-slate-200 dark:border-slate-700">
                                        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
                                        <span className="absolute -top-4 text-[10px] text-slate-400">{i}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* REQ track */}
                        <div className="flex h-12 items-center rounded bg-slate-50 dark:bg-slate-800/50">
                            <div className="w-16 flex-shrink-0 pl-2 font-mono text-sm font-bold text-blue-600 dark:text-blue-400">REQ</div>
                            <div className="flex flex-1 items-center">
                                {reqTrack.map((val, i) => (
                                    <div key={i} className="flex flex-1 cursor-pointer items-center justify-center border-l border-slate-200/50 dark:border-slate-700/50 h-full" onClick={() => toggleSignal("req", i)}>
                                        <motion.div
                                            layout
                                            className={`h-8 w-8 rounded transition-colors ${val ? "bg-blue-500 shadow-md shadow-blue-500/20" : "bg-slate-200 dark:bg-slate-700"}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* GNT track */}
                        <div className="flex h-12 items-center rounded bg-slate-50 dark:bg-slate-800/50">
                            <div className="w-16 flex-shrink-0 pl-2 font-mono text-sm font-bold text-green-600 dark:text-green-400">GNT</div>
                            <div className="flex flex-1 items-center">
                                {gntTrack.map((val, i) => (
                                    <div key={i} className="flex flex-1 cursor-pointer items-center justify-center border-l border-slate-200/50 dark:border-slate-700/50 h-full" onClick={() => toggleSignal("gnt", i)}>
                                        <motion.div
                                            layout
                                            className={`h-8 w-8 rounded transition-colors ${val ? "bg-green-500 shadow-md shadow-green-500/20" : "bg-slate-200 dark:bg-slate-700"}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Evaluation Track */}
                        <div className="mt-4 flex h-14 items-center rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                            <div className="w-16 flex-shrink-0 px-2 text-xs font-bold leading-tight text-slate-500 uppercase">Status</div>
                            <div className="flex flex-1 items-center h-full">
                                {Array.from({ length: NUM_CYCLES }).map((_, i) => {
                                    const status = evaluateCycle(i);
                                    let icon = null;
                                    let colorClass = "bg-transparent";

                                    if (status === "pass") {
                                        icon = <Check size={18} className="text-green-600 dark:text-green-400" />;
                                        colorClass = "bg-green-50 dark:bg-green-900/20";
                                    } else if (status === "fail") {
                                        icon = <X size={18} className="text-rose-600 dark:text-rose-400" />;
                                        colorClass = "bg-rose-50 dark:bg-rose-900/20";
                                    } else if (status === "pending") {
                                        icon = <PlayCircle size={16} className="text-amber-500" />;
                                    } else {
                                        icon = <span className="text-[10px] text-slate-300 dark:text-slate-600">vacuous</span>;
                                    }

                                    return (
                                        <div key={i} className={`flex flex-1 flex-col items-center justify-center border-l border-slate-100 dark:border-slate-800 h-full ${colorClass}`}>
                                            <AnimatePresence mode="popLayout">
                                                <motion.div
                                                    key={status}
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                >
                                                    {icon}
                                                </motion.div>
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <InterviewQuestionPlayground
                title="SVA Trap: |-> vs |=>"
                question={
                    <p>
                        You write <code>assert property (@(posedge clk) req |={">"} gnt);</code>.
                        If <code>req</code> is asserted at cycle 10, when exactly does the assertion check if <code>gnt</code> is asserted?
                    </p>
                }
                options={[
                    { id: "opt1", label: "In the preponed region of cycle 10.", isCorrect: false, explanation: "Incorrect. The non-overlapping implication operator |=> means the consequent occurs on the strictly subsequent clock tick." },
                    { id: "opt2", label: "In the postponed region of cycle 10.", isCorrect: false, explanation: "Incorrect. The check happens on the next clock tick entirely." },
                    { id: "opt3", label: "At the next posedge clk (cycle 11).", isCorrect: true, explanation: "Correct! The non-overlapping implication (|=>) means that if the antecedent (req) matches at cycle N, the consequent evaluation starts strictly at cycle N+1." }
                ]}
            />
        </div >
    );
}
