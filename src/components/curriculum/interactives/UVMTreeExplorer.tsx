"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Box, ArrowDown, ArrowUp, Activity } from "lucide-react";
import InterviewQuestionPlayground from "./InterviewQuestionPlayground";

type Phase = "build" | "connect" | "run";
type PhaseDir = "top-down" | "bottom-up" | "parallel";

type UVMNode = {
    id: string;
    name: string;
    type: string;
    depth: number;
    children?: UVMNode[];
};

const treeData: UVMNode = {
    id: "root",
    name: "uvm_root",
    type: "uvm_root",
    depth: 0,
    children: [
        {
            id: "test",
            name: "uvm_test_top",
            type: "base_test",
            depth: 1,
            children: [
                {
                    id: "env",
                    name: "env",
                    type: "base_env",
                    depth: 2,
                    children: [
                        {
                            id: "agt",
                            name: "agent",
                            type: "active_agent",
                            depth: 3,
                            children: [
                                { id: "sqr", name: "sqr", type: "uvm_sequencer", depth: 4 },
                                { id: "drv", name: "drv", type: "uvm_driver", depth: 4 },
                                { id: "mon", name: "mon", type: "uvm_monitor", depth: 4 }
                            ]
                        },
                        {
                            id: "sb",
                            name: "sb",
                            type: "uvm_scoreboard",
                            depth: 3
                        }
                    ]
                }
            ]
        }
    ]
};

const flattenTree = (node: UVMNode): UVMNode[] => {
    let list = [node];
    if (node.children) {
        node.children.forEach(child => {
            list = [...list, ...flattenTree(child)];
        });
    }
    return list;
};

const flatNodes = flattenTree(treeData);

export default function UVMTreeExplorer() {
    const [activePhase, setActivePhase] = useState<Phase>("build");
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);

    const phases: Record<Phase, { title: string, dir: PhaseDir, desc: string }> = {
        build: { title: "Build Phase", dir: "top-down", desc: "Executes top-down. Parent creates children." },
        connect: { title: "Connect Phase", dir: "bottom-up", desc: "Executes bottom-up. Components connect ports/exports." },
        run: { title: "Run Phase", dir: "parallel", desc: "Time-consuming phase. Executes in parallel via fork-join_none." }
    };

    useEffect(() => {
        if (!isPlaying) return;

        let timers: NodeJS.Timeout[] = [];
        const delays: string[] = [];

        if (activePhase === "run") {
            setActiveNodeIds(flatNodes.map(n => n.id));
            const t = setTimeout(() => setIsPlaying(false), 3000);
            timers.push(t);
        } else {
            const isTopDown = activePhase === "build";
            const maxDepth = Math.max(...flatNodes.map(n => n.depth));

            let stepTime = 600;

            for (let d = 0; d <= maxDepth; d++) {
                const currentDepth = isTopDown ? d : maxDepth - d;
                const nodesAtDepth = flatNodes.filter(n => n.depth === currentDepth).map(n => n.id);

                const t = setTimeout(() => {
                    setActiveNodeIds(prev => isTopDown ? [...prev, ...nodesAtDepth] : [...nodesAtDepth, ...prev]);
                }, d * stepTime);

                timers.push(t);
            }

            const tEnd = setTimeout(() => setIsPlaying(false), (maxDepth + 1.5) * stepTime);
            timers.push(tEnd);
        }

        return () => timers.forEach(clearTimeout);
    }, [isPlaying, activePhase]);

    const resetPhase = () => {
        setIsPlaying(false);
        setActiveNodeIds([]);
    };

    const startPhase = () => {
        setActiveNodeIds([]);
        setIsPlaying(false);
        setTimeout(() => setIsPlaying(true), 100);
    };

    const renderNode = (node: UVMNode) => {
        const isActive = activeNodeIds.includes(node.id);
        const isCompleted = !isPlaying && activeNodeIds.length > 0 && activePhase !== "run" && isActive;

        return (
            <div key={node.id} className="relative flex flex-col items-center">
                <motion.div
                    animate={
                        isActive && isPlaying
                            ? { scale: [1, 1.05, 1], borderColor: "#3b82f6", backgroundColor: "#eff6ff" }
                            : isCompleted
                                ? { borderColor: "#22c55e", backgroundColor: "#f0fdf4" }
                                : { scale: 1, borderColor: "#e2e8f0", backgroundColor: "#ffffff" }
                    }
                    className="relative z-10 flex min-w-[140px] flex-col items-center justify-center rounded-lg border-2 p-3 shadow-sm transition-colors dark:bg-slate-900"
                    style={{
                        borderColor: "var(--tw-colors)",
                        backgroundColor: "var(--tw-colors)"
                    }}
                >
                    <Box size={16} className={`mb-1 ${isActive ? "text-blue-500" : "text-slate-400"}`} />
                    <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">{node.name}</span>
                    <span className="mt-0.5 text-[10px] tracking-wide text-slate-500 uppercase">{node.type}</span>

                    <AnimatePresence>
                        {isActive && isPlaying && activePhase === "run" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900"
                            >
                                <Activity size={12} className="text-blue-600 dark:text-blue-400 animate-pulse" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {node.children && (
                    <div className="flex gap-4 pt-6 md:gap-8">
                        {/* The vertical connecting line to children container */}
                        <div className="absolute left-1/2 top-[72px] h-6 w-px -translate-x-1/2 bg-slate-300 dark:bg-slate-700" />

                        {/* The horizontal connecting line */}
                        {node.children.length > 1 && (
                            <div
                                className="absolute left-0 top-[96px] h-px bg-slate-300 dark:bg-slate-700"
                                style={{
                                    width: `calc(100% - ${100 / node.children.length}%)`,
                                    left: `${50 / node.children.length}%`
                                }}
                            />
                        )}

                        {node.children.map((child, i) => (
                            <div key={child.id} className="relative pt-6">
                                {/* Vertical drops to each child */}
                                <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-slate-300 dark:bg-slate-700" />
                                {renderNode(child)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="my-8 flex flex-col gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-6 flex flex-col flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-center dark:border-slate-800">
                    <div>
                        <h3 className="m-0 text-xl font-bold dark:text-slate-100">UVM Component Phase Explorer</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Visualize how standard UVM phases propagate through the component hierarchy.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <select
                            disabled={isPlaying}
                            value={activePhase}
                            onChange={(e) => {
                                setActivePhase(e.target.value as Phase);
                                resetPhase();
                            }}
                            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                            <option value="build">Build Phase (Top-Down)</option>
                            <option value="connect">Connect Phase (Bottom-Up)</option>
                            <option value="run">Run Phase (Parallel)</option>
                        </select>

                        <button
                            onClick={isPlaying ? resetPhase : startPhase}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors \${
                isPlaying 
                  ? "bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700" 
                  : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              }`}
                        >
                            {isPlaying ? <RotateCcw size={16} /> : <Play size={16} />}
                            {isPlaying ? "Stop" : "Simulate"}
                        </button>
                    </div>
                </div>

                <div className="mb-8 flex items-start gap-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                    <div className="mt-1 text-blue-500 dark:text-blue-400">
                        {phases[activePhase].dir === "top-down" && <ArrowDown size={20} />}
                        {phases[activePhase].dir === "bottom-up" && <ArrowUp size={20} />}
                        {phases[activePhase].dir === "parallel" && <Activity size={20} />}
                    </div>
                    <div>
                        <h4 className="m-0 font-semibold text-blue-900 dark:text-blue-300">
                            {phases[activePhase].title} Direction: {phases[activePhase].dir}
                        </h4>
                        <p className="m-0 mt-1 text-sm text-blue-800 dark:text-blue-400">
                            {phases[activePhase].desc}
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto pb-8 pt-4">
                    <div className="flex min-w-[600px] justify-center">
                        {renderNode(treeData)}
                    </div>
                </div>
            </div>

            <InterviewQuestionPlayground
                title="UVM Phasing Pitfall"
                question={
                    <p>
                        You have a <code>uvm_agent</code> that instantiates a <code>uvm_driver</code>. If the agent's <code>build_phase</code> fails to call <code>super.build_phase(phase)</code>, what happens to the driver?
                    </p>
                }
                options={[
                    {
                        id: "opt1",
                        label: "The driver is created anyway because uvm_component automatically traverses children in build_phase.",
                        isCorrect: false,
                        explanation: "Incorrect. While traversal is automatic down the hierarchy, auto-configuration (apply_config_settings) relies on super.build_phase(). However, instantiation is manual in user code, so the driver isn't created automatically anyway—unless using the field macros which require super.build_phase()."
                    },
                    {
                        id: "opt2",
                        label: "The driver's build_phase doesn't execute, but it is still instantiated.",
                        isCorrect: false,
                        explanation: "Incorrect. If it's instantiated via factory, its build_phase will execute. But omitting super.build_phase() affects automatic config and field macros."
                    },
                    {
                        id: "opt3",
                        label: "The field macros for the driver won't be automatically extracted, and standard UVM base setup is skipped.",
                        isCorrect: true,
                        explanation: "Correct! If you don't call super.build_phase(phase), the base uvm_component::build_phase() doesn't execute. This means apply_config_settings() is skipped, and any `uvm_field` macro automation fails."
                    }
                ]}
            />
        </div>
    );
}
