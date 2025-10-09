"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue } from "framer-motion";

interface Milestone {
  id: string;
  label: string;
  cost: number;
  description: string;
}

const milestones: Milestone[] = [
  {
    id: "spec",
    label: "Specification",
    cost: 1,
    description: "A wording tweak or requirement clarification – negligible cost when caught early.",
  },
  {
    id: "design",
    label: "Design",
    cost: 10,
    description: "Updating RTL and re-running designer unit tests – still manageable but adds churn.",
  },
  {
    id: "verification",
    label: "Verification",
    cost: 100,
    description: "Debugging failures, triaging logs, and re-running regressions across the farm.",
  },
  {
    id: "post-silicon",
    label: "Post-Silicon",
    cost: 1_000_000,
    description: "Mask re-spin, lab validation, and launch delays – measured in millions of dollars.",
  },
  {
    id: "in-field",
    label: "In-Field",
    cost: 100_000_000,
    description: "Recalls, lawsuits, brand damage, and emergency patches shipped to customers.",
  },
];

const minLogCost = Math.log10(milestones[0].cost);
const maxLogCost = Math.log10(milestones[milestones.length - 1].cost);

const formatCost = (value: number) => {
  if (value >= 100_000_000) {
    return "$" + (value / 100_000_000).toFixed(1) + "B+";
  }
  if (value >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(1) + "M";
  }
  if (value >= 1_000) {
    return "$" + (value / 1_000).toFixed(0) + "K";
  }
  return `$${value.toFixed(0)}`;
};

const getCostAtPosition = (position: number) => {
  if (position <= 0) return milestones[0].cost;
  if (position >= 1) return milestones[milestones.length - 1].cost;

  const segmentLength = 1 / (milestones.length - 1);
  const rawIndex = position / segmentLength;
  const lowerIndex = Math.floor(rawIndex);
  const upperIndex = Math.min(lowerIndex + 1, milestones.length - 1);
  const innerProgress = rawIndex - lowerIndex;

  const lowerLog = Math.log10(milestones[lowerIndex].cost);
  const upperLog = Math.log10(milestones[upperIndex].cost);
  const interpolatedLog = lowerLog + innerProgress * (upperLog - lowerLog);

  return 10 ** interpolatedLog;
};

const getNearestMilestone = (position: number) => {
  const segmentLength = 1 / (milestones.length - 1);
  const index = Math.round(position / segmentLength);
  return milestones[Math.min(Math.max(index, 0), milestones.length - 1)];
};

const InteractiveCostOfBugGraph = () => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [constraints, setConstraints] = useState({ left: 0, right: 0 });
  const [bugPosition, setBugPosition] = useState(0);
  const dragX = useMotionValue(0);

  useEffect(() => {
    const computeConstraints = () => {
      const track = trackRef.current;
      if (!track) return;
      const width = track.offsetWidth - 48; // subtract handle width for bounds
      setConstraints({ left: 0, right: Math.max(width, 0) });
      const clampedX = Math.min(Math.max(dragX.get(), 0), Math.max(width, 0));
      dragX.set(clampedX);
      setBugPosition(width > 0 ? clampedX / width : 0);
    };

    computeConstraints();
    window.addEventListener("resize", computeConstraints);
    return () => window.removeEventListener("resize", computeConstraints);
  }, [dragX]);

  useEffect(() => {
    const unsub = dragX.on("change", (latest) => {
      const range = constraints.right - constraints.left;
      if (range <= 0) {
        setBugPosition(0);
        return;
      }
      const normalized = (latest - constraints.left) / range;
      setBugPosition(Math.min(Math.max(normalized, 0), 1));
    });
    return () => {
      unsub?.();
    };
  }, [constraints.left, constraints.right, dragX]);

  const activeMilestone = useMemo(() => getNearestMilestone(bugPosition), [bugPosition]);
  const currentCost = useMemo(() => getCostAtPosition(bugPosition), [bugPosition]);

  const chartPoints = useMemo(() => {
    const samples = 32;
    const coords: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const logCost = Math.log10(getCostAtPosition(t));
      const y = 1 - (logCost - minLogCost) / (maxLogCost - minLogCost);
      coords.push({ x: t, y });
    }
    return coords;
  }, []);

  return (
    <div className="w-full space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-xl dark:from-slate-900 dark:via-slate-950 dark:to-black">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-xl font-semibold uppercase tracking-[0.15em] text-emerald-300">
            An Ounce of Prevention is Worth a Ton of Silicon
          </h3>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Drag the bug across the product lifecycle. Every step you wait adds orders of magnitude
            in cost and risk.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/80">Estimated Impact</p>
          <p className="text-3xl font-bold text-emerald-300">{formatCost(currentCost)}</p>
          <p className="text-xs text-emerald-200/80">{activeMilestone.label}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <div ref={trackRef} className="relative h-24 w-full">
            <div className="absolute left-0 right-0 top-10 h-2 rounded-full bg-slate-700/60">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 opacity-70" />
            </div>

            {milestones.map((milestone, index) => {
              const position = index / (milestones.length - 1);
              return (
                <div
                  key={milestone.id}
                  className="group absolute top-6 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${position * 100}%` }}
                >
                  <div className="h-2 w-2 rounded-full bg-white/80 shadow-md" />
                  <div className="mt-4 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                    {milestone.label}
                  </div>
                  <div className="pointer-events-none absolute bottom-16 w-52 origin-bottom scale-95 transform rounded-xl border border-white/10 bg-slate-900/90 p-3 text-xs opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
                    {milestone.description}
                  </div>
                </div>
              );
            })}

            <motion.div
              className="absolute top-0 flex h-12 w-12 -translate-y-4 transform cursor-grab items-center justify-center rounded-full border-2 border-emerald-300 bg-slate-950 text-2xl shadow-emerald-500/30"
              style={{ x: dragX }}
              drag="x"
              dragConstraints={constraints}
              dragElastic={0.05}
              dragMomentum={false}
              whileTap={{ scale: 0.95 }}
            >
              🐞
            </motion.div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[3fr,2fr]">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner">
            <svg viewBox="0 0 100 60" className="h-40 w-full">
              <defs>
                <linearGradient id="bugCostGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <rect x={0} y={0} width={100} height={60} rx={12} fill="url(#bugCostGradient)" opacity={0.2} />
              <polyline
                fill="none"
                stroke="#34d399"
                strokeWidth={1.5}
                strokeLinecap="round"
                points={chartPoints.map((point) => `${point.x * 100},${point.y * 50 + 5}`).join(" ")}
              />
              <circle
                cx={bugPosition * 100}
                cy={(() => {
                  const logValue = Math.log10(currentCost);
                  const normalized = 1 - (logValue - minLogCost) / (maxLogCost - minLogCost);
                  return normalized * 50 + 5;
                })()}
                r={3}
                fill="#facc15"
                stroke="#fde68a"
                strokeWidth={1.2}
              />
              <g>
                <line x1={0} y1={55} x2={100} y2={55} stroke="#475569" strokeWidth={0.5} />
                <text x={0} y={58} className="fill-slate-400" fontSize={4}>
                  Early discovery
                </text>
                <text x={60} y={58} className="fill-slate-400" fontSize={4}>
                  Catastrophic
                </text>
              </g>
            </svg>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Current Stage</p>
              <p className="text-lg font-semibold text-white">{activeMilestone.label}</p>
            </div>
            <p className="text-sm text-slate-300">{activeMilestone.description}</p>
            <p className="text-sm text-emerald-300">
              Every week of delay multiplies debug cost, consumes lab time, and risks customer trust.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveCostOfBugGraph;
