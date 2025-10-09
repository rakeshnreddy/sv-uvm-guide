"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Sparkles, Binary, Cpu, CircuitBoard } from "lucide-react";

interface FlowStage {
  id: string;
  label: string;
  description: string;
}

interface Methodology {
  id: string;
  name: string;
  summary: string;
  stageIndex: number;
  icon: LucideIcon;
}

const flow: FlowStage[] = [
  { id: "spec", label: "Specification", description: "Requirements, architecture, and intent." },
  { id: "rtl", label: "RTL", description: "Synthesizable logic captures the behavior." },
  { id: "netlist", label: "Netlist", description: "Gate-level view optimized for silicon." },
  { id: "gds", label: "GDSII", description: "Final layout tape-out representation." },
];

const methodologies: Methodology[] = [
  {
    id: "formal",
    name: "Formal Verification",
    summary: "Mathematical proof engines exhaustively explore state space to guarantee key properties.",
    stageIndex: 1,
    icon: Binary,
  },
  {
    id: "simulation",
    name: "Simulation",
    summary: "Scenario-driven exploration finds functional bugs before silicon ships.",
    stageIndex: 1,
    icon: Sparkles,
  },
  {
    id: "emulation",
    name: "Emulation / FPGA",
    summary: "Hardware-accelerated platforms validate software stacks and long-running workloads.",
    stageIndex: 2,
    icon: Cpu,
  },
  {
    id: "lab",
    name: "Post-Silicon Validation",
    summary: "Lab automation correlates silicon behavior to pre-silicon models.",
    stageIndex: 3,
    icon: CircuitBoard,
  },
];

const VerificationMethodologiesDiagram = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-20%" });
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!isInView) return;
    const timers = methodologies.map((_, index) =>
      setTimeout(() => {
        setActiveIndex(index);
      }, index * 2000),
    );
    return () => timers.forEach(clearTimeout);
  }, [isInView]);

  const highlightedStage = useMemo(() => {
    if (activeIndex < 0) return null;
    return methodologies[Math.min(activeIndex, methodologies.length - 1)].stageIndex;
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className="w-full space-y-6 rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-white shadow-xl backdrop-blur"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-300">
            Choosing the Right Tool for the Job
          </p>
          <h3 className="text-2xl font-bold">The Verification Landscape</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Follow the design flow from specification through tape-out. Highlighted checkpoints show where
            each methodology delivers the most leverage.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[7fr,5fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-inner">
          <div className="w-full" style={{ minHeight: 340 }}>
            <svg
              viewBox="0 0 640 240"
              className="h-auto w-full"
              preserveAspectRatio="xMidYMid meet"
            >
            <defs>
              <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                <stop offset="35%" stopColor="#22d3ee" stopOpacity="0.45" />
                <stop offset="70%" stopColor="#34d399" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.35" />
              </linearGradient>
            </defs>
            <rect x="32" y="56" width="576" height="132" rx="36" fill="url(#flowGradient)" opacity="0.25" />
            <path
              d="M96 124 C 192 52, 448 52, 544 124 C 448 196, 192 196, 96 124 Z"
              fill="url(#flowGradient)"
              opacity="0.35"
            />

            {flow.map((stage, index) => {
              const x = 96 + index * 144;
              const isHighlighted = highlightedStage === index;
              return (
                <g key={stage.id} transform={`translate(${x}, 124)`}>
                  <motion.circle
                    cx={0}
                    cy={0}
                    r={isHighlighted ? 42 : 36}
                    className="fill-black/60 stroke-white/20"
                    strokeWidth={1.5}
                    animate={{
                      r: isHighlighted ? 50 : 36,
                      stroke: isHighlighted ? "#38bdf8" : "rgba(255,255,255,0.35)",
                      strokeWidth: isHighlighted ? 4 : 1.5,
                    }}
                    transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  />
                  <text
                    x={0}
                    y={-8}
                    textAnchor="middle"
                    className="fill-white font-semibold"
                    fontSize={14}
                  >
                    {stage.label}
                  </text>
                  <foreignObject x={-70} y={6} width={140} height={72}>
                    <div className="text-center text-xs text-slate-300">{stage.description}</div>
                  </foreignObject>
                </g>
              );
            })}

            <motion.path
              d="M96 124 H 544"
              stroke="#bae6fd"
              strokeWidth={4}
              strokeDasharray="16 12"
              animate={{
                strokeDashoffset: activeIndex >= 0 ? 0 : 120,
                opacity: activeIndex >= 0 ? 1 : 0.4,
              }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />

            {methodologies.map((method, index) => {
              const x = 96 + method.stageIndex * 144;
              const isActive = index <= activeIndex;
              const Icon = method.icon;
              return (
                <motion.g
                  key={method.id}
                  transform={`translate(${x}, ${method.stageIndex === 1 ? 48 : 196})`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: isActive ? 1 : 0.25, scale: isActive ? 1 : 0.85 }}
                  transition={{ duration: 0.8, delay: index * 0.2 }}
                >
                  <circle r={26} className="fill-slate-950 stroke-sky-300/60" strokeWidth={2} />
                  <foreignObject x={-16} y={-16} width={32} height={32}>
                    <div className="flex h-full w-full items-center justify-center text-sky-200">
                      <Icon className="h-5 w-5" />
                    </div>
                  </foreignObject>
                  <rect
                    x={-74}
                    y={method.stageIndex === 1 ? -102 : 38}
                    width={148}
                    height={72}
                    rx={16}
                    className={`fill-slate-950/90 stroke-white/10 ${isActive ? "opacity-100" : "opacity-70"}`}
                  />
                  <foreignObject
                    x={-68}
                    y={method.stageIndex === 1 ? -96 : 44}
                    width={136}
                    height={60}
                  >
                    <div className="flex h-full flex-col justify-center rounded-xl text-center text-[10px] leading-relaxed text-slate-200">
                      <p className="font-semibold uppercase tracking-[0.3em] text-sky-300">{method.name}</p>
                      <p className="mt-2 text-[10px] text-slate-300">{method.summary}</p>
                    </div>
                  </foreignObject>
                </motion.g>
              );
            })}
            </svg>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-inner">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Methodology Spotlight</p>
          <div className="min-h-[160px] space-y-4">
            {methodologies.map((method, index) => {
              const isActive = index === activeIndex;
              const Icon = method.icon;
              return (
                <div
                  key={method.id}
                  className={`rounded-2xl border p-4 transition ${
                    isActive
                      ? "border-sky-400/60 bg-sky-400/10 shadow-lg"
                      : "border-white/10 bg-black/30 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/20 text-sky-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{method.name}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        {flow[method.stageIndex]?.label} Focus
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-300">{method.summary}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400">
            Layering methodologies keeps coverage rising while schedule risk falls. Simulation is the workhorse of
            this course, but the best teams blend all four to close the verification gap.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationMethodologiesDiagram;
