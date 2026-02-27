"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Factory, XCircle, ArrowRight, Cog } from "lucide-react";
import InterviewQuestionPlayground from "./InterviewQuestionPlayground";

type Override = {
    id: string;
    type: "type" | "inst";
    original: string;
    replacement: string;
    instPath?: string;
    active: boolean;
};

type Requester = {
    id: string;
    path: string;
    requestedType: string;
};

const defaultOverrides: Override[] = [
    { id: "o1", type: "type", original: "packet", replacement: "bad_packet", active: true },
    { id: "o2", type: "inst", original: "packet", replacement: "good_packet", instPath: "uvm_test_top.env.agt.*", active: false },
    { id: "o3", type: "inst", original: "packet", replacement: "secure_packet", instPath: "uvm_test_top.env.agt.sqr", active: false },
];

const requesters: Requester[] = [
    { id: "r1", path: "uvm_test_top", requestedType: "packet" },
    { id: "r2", path: "uvm_test_top.env.agt", requestedType: "packet" },
    { id: "r3", path: "uvm_test_top.env.agt.sqr", requestedType: "packet" },
];

export default function FactoryOverrideVisualizer() {
    const [overrides, setOverrides] = useState<Override[]>(defaultOverrides);

    const toggleOverride = (id: string) => {
        setOverrides(prev => prev.map(o => o.id === id ? { ...o, active: !o.active } : o));
    };

    // UVM Factory override resolution:
    // 1. Instance overrides checked first. Longest matching path wins.
    // 2. Type overrides checked next.
    // 3. Returns original if no match.
    const resolveType = (path: string, requestedType: string) => {
        const activeOverrides = overrides.filter(o => o.active && o.original === requestedType);

        // Check instance overrides
        const instOverrides = activeOverrides.filter(o => o.type === "inst");

        let bestMatch: Override | null = null;
        let longestMatchLen = -1;

        instOverrides.forEach(o => {
            if (!o.instPath) return;
            const regexStr = "^" + o.instPath.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$";
            const regex = new RegExp(regexStr);

            if (regex.test(path)) {
                if (o.instPath.length > longestMatchLen) {
                    longestMatchLen = o.instPath.length;
                    bestMatch = o;
                }
            }
        });

        if (bestMatch) {
            return { resolved: (bestMatch as Override).replacement, by: bestMatch as Override };
        }

        // Check type overrides
        const typeOverride = activeOverrides.find(o => o.type === "type");
        if (typeOverride) {
            return { resolved: typeOverride.replacement, by: typeOverride };
        }

        return { resolved: requestedType, by: null };
    };

    return (
        <div className="my-8 flex flex-col gap-6 font-sans">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left: Overrides Control */}
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
                        <Factory className="text-purple-600 dark:text-purple-400" size={24} />
                        <h3 className="m-0 text-xl font-semibold text-slate-800 dark:text-slate-100">
                            UVM Factory Overrides
                        </h3>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Toggle the overrides below to see how the factory resolves creation requests across different hierarchical paths.
                    </p>

                    <div className="flex flex-col gap-3">
                        {overrides.map(o => (
                            <div
                                key={o.id}
                                onClick={() => toggleOverride(o.id)}
                                className={`group cursor-pointer flex items-center justify-between rounded-lg border p-3 transition-all ${o.active
                                        ? "border-purple-300 bg-purple-50 dark:border-purple-800/50 dark:bg-purple-900/20"
                                        : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                                    }`}
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${o.type === "inst" ? "text-amber-600 dark:text-amber-500" : "text-blue-600 dark:text-blue-500"
                                            }`}>
                                            {o.type} override
                                        </span>
                                    </div>
                                    <code className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        {o.original} <ArrowRight className="inline" size={12} /> {o.replacement}
                                    </code>
                                    {o.type === "inst" && (
                                        <code className="text-xs text-slate-500 dark:text-slate-400">
                                            Path: {o.instPath}
                                        </code>
                                    )}
                                </div>
                                <div>
                                    {o.active
                                        ? <CheckCircle2 className="text-purple-600 dark:text-purple-400" size={24} />
                                        : <div className="h-6 w-6 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Resolution Visualization */}
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                        <Cog className="text-slate-600 dark:text-slate-400" size={20} />
                        <h3 className="m-0 text-lg font-semibold dark:text-slate-100">Factory Resolution</h3>
                    </div>

                    <div className="flex flex-col gap-4">
                        {requesters.map((req, idx) => {
                            const { resolved, by } = resolveType(req.path, req.requestedType);

                            return (
                                <div key={req.id} className="relative pl-6">
                                    {idx > 0 && (
                                        <div className="absolute left-3 top-[-24px] h-6 w-px bg-slate-300 dark:bg-slate-700" />
                                    )}
                                    <div className="absolute left-3 top-3 h-px w-3 bg-slate-300 dark:bg-slate-700" />

                                    <motion.div
                                        layout
                                        className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                                    >
                                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                            {req.path}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="text-sm text-slate-400 line-through">
                                                {req.requestedType}
                                            </code>
                                            <ArrowRight size={14} className="text-slate-400" />
                                            <AnimatePresence mode="popLayout">
                                                <motion.code
                                                    key={resolved}
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className={`rounded px-1.5 py-0.5 text-sm font-bold ${by ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                                                        }`}
                                                >
                                                    {resolved}
                                                </motion.code>
                                            </AnimatePresence>
                                        </div>
                                        {by && (
                                            <div className="text-[10px] uppercase text-slate-400 flex items-center gap-1">
                                                Resolved by {by.type} override
                                                {by.type === "inst" && <span className="text-amber-600 dark:text-amber-500">[{by.instPath}]</span>}
                                            </div>
                                        )}
                                    </motion.div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <InterviewQuestionPlayground
                title="Override Resolution Precedence"
                question={
                    <p>
                        If both a <strong>type override</strong> and an <strong>instance override</strong> apply to the exact same component creation request, which one wins?
                    </p>
                }
                options={[
                    { id: "opt1", label: "Type Override wins over Instance Override.", isCorrect: false, explanation: "Incorrect. Type overrides are global fallbacks, they are deliberately weaker than targeted instance overrides." },
                    { id: "opt2", label: "Instance Override wins over Type Override.", isCorrect: true, explanation: "Correct! The UVM Factory checks instance overrides first. If an instance matches the path, it applies that override and completely ignores the type override for that specific instance." },
                    { id: "opt3", label: "The last one registered in the build_phase wins.", isCorrect: false, explanation: "Incorrect. While registration order matters for identical overrides of the same category, category precedence (Instance > Type) strictly applies first regardless of registration order." },
                ]}
            />
        </div>
    );
}
