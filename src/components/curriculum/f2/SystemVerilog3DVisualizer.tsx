"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Tone = "primary" | "accent" | "muted" | "warning" | "success";

type StructureNode = {
  id: string;
  label: string;
  detail?: string;
  position: { x: number; y: number; z: number };
  tone: Tone;
};

type StructureDefinition = {
  id: string;
  label: string;
  summary: string;
  context: string;
  axes: { x: string; y: string; z: string };
  nodes: StructureNode[];
  insights: Array<{ title: string; body: string }>;
  suggestedNext?: { href: string; label: string };
};

const toneClasses: Record<Tone, string> = {
  primary: "from-sky-500/80 via-sky-400/70 to-sky-600/80 border-sky-300/60 text-sky-50",
  accent: "from-fuchsia-500/75 via-pink-500/70 to-rose-500/80 border-fuchsia-300/60 text-rose-50",
  muted: "from-slate-600/80 via-slate-500/70 to-slate-700/80 border-slate-300/60 text-slate-50",
  warning: "from-amber-500/75 via-amber-400/70 to-orange-500/80 border-amber-300/60 text-amber-50",
  success: "from-emerald-500/70 via-emerald-400/60 to-teal-500/80 border-emerald-300/60 text-emerald-50",
};

const UNIT = 3.6; // rem-based spacing between nodes

const structures: StructureDefinition[] = [
  {
    id: "dynamic-array",
    label: "Dynamic Array",
    summary:
      "Visualize how a dynamic array expands contiguously in memory. Reserve slots line up along a single axis while unused capacity remains allocated for future growth.",
    context:
      "Each block is a packed byte. Capacity lives further down the axis so push_back can stay O(1) until the buffer fills.",
    axes: { x: "Index", y: "Value Heat", z: "Capacity" },
    nodes: [
      { id: "arr-slot-0", label: "idx 0", detail: "0x10", position: { x: -2, y: 1, z: 0 }, tone: "primary" },
      { id: "arr-slot-1", label: "idx 1", detail: "0x22", position: { x: -1, y: 0.6, z: 0 }, tone: "primary" },
      { id: "arr-slot-2", label: "idx 2", detail: "0x38", position: { x: 0, y: 0.3, z: 0 }, tone: "primary" },
      { id: "arr-slot-3", label: "idx 3", detail: "0x44", position: { x: 1, y: -0.2, z: 0 }, tone: "primary" },
      { id: "arr-capacity-4", label: "reserve", detail: "capacity", position: { x: 2, y: -0.8, z: 0 }, tone: "muted" },
      { id: "arr-resize-shadow", label: "resize", detail: "next buffer", position: { x: 3.1, y: -1.4, z: 1.2 }, tone: "warning" },
    ],
    insights: [
      {
        title: "Auto-expansion",
        body: "SystemVerilog doubles capacity when new[] grows past the current allocation. The translucent block shows the next buffer waiting to copy values across.",
      },
      {
        title: "Contiguous bytes",
        body: "Packed bytes keep cache hits high. Even when you delete() elements, memory stays hot unless you explicitly resize lower.",
      },
    ],
    suggestedNext: {
      href: "/practice/visualizations/memory-hub",
      label: "Study heap growth in the Memory Hub",
    },
  },
  {
    id: "queue",
    label: "Queue",
    summary:
      "See how a queue keeps head and tail pointers marching forward. Entries fan out on the Z-axis to represent temporal ordering.",
    context: "Front of queue sits closest to you; each pop_front advances the head and shifts the view forward.",
    axes: { x: "Depth", y: "Priority", z: "Age" },
    nodes: [
      { id: "queue-front", label: "front", detail: "0x12A", position: { x: -1.5, y: 0.5, z: -1.2 }, tone: "accent" },
      { id: "queue-mid", label: "idx 1", detail: "0x0F4", position: { x: -0.5, y: 0.2, z: -0.6 }, tone: "primary" },
      { id: "queue-tail", label: "tail", detail: "0x07C", position: { x: 0.6, y: -0.1, z: 0 }, tone: "primary" },
      { id: "queue-next", label: "+ push_back", detail: "pending", position: { x: 1.6, y: -0.5, z: 0.8 }, tone: "warning" },
      { id: "queue-bound", label: "bound", detail: "max depth=4", position: { x: 2.4, y: -0.8, z: 1.4 }, tone: "muted" },
    ],
    insights: [
      {
        title: "Head and tail markers",
        body: "Tracking head/tail indices is cheaper than shuffling data. SystemVerilog queues use pointers so inserts stay O(1).",
      },
      {
        title: "Depth bounds",
        body: "Bounds live just beyond the active elements. Once depth==bound, the warning block lights up to signal backpressure.",
      },
    ],
    suggestedNext: {
      href: "/practice/visualizations/uvm-agent-builder",
      label: "Map queues to UVM sequencer mailboxes",
    },
  },
  {
    id: "associative",
    label: "Associative Array",
    summary:
      "Hash lookups turn sparse keys into hashed buckets. Each pillar shows a bucket with any stored key/value pairs stacked vertically.",
    context: "The height reflects hashed occupancy. Empty buckets are left translucent to highlight hot spots.",
    axes: { x: "Hash bucket", y: "Load", z: "Key space" },
    nodes: [
      { id: "assoc-bucket-0", label: "hash 02", detail: "addr_ff10", position: { x: -2.2, y: -0.6, z: -0.4 }, tone: "muted" },
      { id: "assoc-bucket-1", label: "hash 17", detail: "pkt_1024", position: { x: -1.2, y: 0.2, z: 0.2 }, tone: "accent" },
      { id: "assoc-bucket-1b", label: "hash 17", detail: "pkt_3055", position: { x: -1.2, y: 1.2, z: 0.2 }, tone: "accent" },
      { id: "assoc-bucket-3", label: "hash 2B", detail: "cfg_mode", position: { x: -0.1, y: 0.4, z: 0.8 }, tone: "primary" },
      { id: "assoc-bucket-4", label: "hash 31", detail: "dma_live", position: { x: 1.1, y: 1.4, z: 1.4 }, tone: "success" },
      { id: "assoc-bucket-ghost", label: "empty bucket", detail: "rehash candidate", position: { x: 2.3, y: -1.2, z: 2 }, tone: "muted" },
    ],
    insights: [
      {
        title: "Buckets stack vertically",
        body: "When two keys hash to the same bucket, SystemVerilog chains entries. Our second block shows the collision stack visually.",
      },
      {
        title: "Rehash decisions",
        body: "If too many buckets stay empty, pre-sized associative arrays waste space. Track load factor to decide when to rebuild.",
      },
    ],
    suggestedNext: {
      href: "/practice/visualizations/concurrency",
      label: "Explore hashed mailboxes in the Concurrency studio",
    },
  },
  {
    id: "packed-matrix",
    label: "Packed/Unpacked Combo",
    summary:
      "Packed vectors unfold along the X axis while unpacked dimensions layer along Z. This grid mirrors the lane_matrix example from the lesson.",
    context: "Each layer is an unpacked slot; bits inside are grouped by packed nibble and lane.",
    axes: { x: "Packed bit", y: "Lane", z: "Channel" },
    nodes: [
      { id: "matrix-ch0-bit7", label: "[3][1]", detail: "ch 0", position: { x: -2.4, y: 1, z: -1.4 }, tone: "primary" },
      { id: "matrix-ch0-bit6", label: "[3][0]", detail: "ch 0", position: { x: -1.6, y: 0.6, z: -1.4 }, tone: "primary" },
      { id: "matrix-ch0-bit5", label: "[2][1]", detail: "ch 0", position: { x: -0.8, y: 0.2, z: -1.4 }, tone: "primary" },
      { id: "matrix-ch0-bit4", label: "[2][0]", detail: "ch 0", position: { x: 0, y: -0.2, z: -1.4 }, tone: "primary" },
      { id: "matrix-ch1-bit7", label: "[3][1]", detail: "ch 1", position: { x: -2.4, y: 1, z: -0.2 }, tone: "accent" },
      { id: "matrix-ch1-bit6", label: "[3][0]", detail: "ch 1", position: { x: -1.6, y: 0.6, z: -0.2 }, tone: "accent" },
      { id: "matrix-ch1-bit5", label: "[2][1]", detail: "ch 1", position: { x: -0.8, y: 0.2, z: -0.2 }, tone: "accent" },
      { id: "matrix-ch1-bit4", label: "[2][0]", detail: "ch 1", position: { x: 0, y: -0.2, z: -0.2 }, tone: "accent" },
      { id: "matrix-ch1-bit3", label: "[1][1]", detail: "ch 1", position: { x: 0.8, y: -0.6, z: -0.2 }, tone: "accent" },
      { id: "matrix-ch1-bit2", label: "[1][0]", detail: "ch 1", position: { x: 1.6, y: -1, z: -0.2 }, tone: "accent" },
      { id: "matrix-ch1-bit1", label: "[0][1]", detail: "ch 1", position: { x: 2.4, y: -1.4, z: -0.2 }, tone: "accent" },
      { id: "matrix-ch1-bit0", label: "[0][0]", detail: "ch 1", position: { x: 3.2, y: -1.8, z: -0.2 }, tone: "accent" },
      { id: "matrix-ch0-bit3", label: "[1][1]", detail: "ch 0", position: { x: 0.8, y: -0.6, z: -1.4 }, tone: "primary" },
      { id: "matrix-ch0-bit2", label: "[1][0]", detail: "ch 0", position: { x: 1.6, y: -1, z: -1.4 }, tone: "primary" },
      { id: "matrix-ch0-bit1", label: "[0][1]", detail: "ch 0", position: { x: 2.4, y: -1.4, z: -1.4 }, tone: "primary" },
      { id: "matrix-ch0-bit0", label: "[0][0]", detail: "ch 0", position: { x: 3.2, y: -1.8, z: -1.4 }, tone: "primary" },
    ],
    insights: [
      {
        title: "Unpacked first",
        body: "Layers marching toward you represent the unpacked dimension. Select the channel, then read across the packed grid for nibble and lane.",
      },
      {
        title: "Lane emphasis",
        body: "Color swap highlights per-channel packing — perfect for explaining why [1:0] flips fastest in the memory walk.",
      },
    ],
    suggestedNext: {
      href: "/practice/visualizations/uvm-component-relationships",
      label: "Relate packed lanes to analysis fan-out",
    },
  },
];

const containerVariants = {
  initial: { opacity: 0, rotateX: -20, rotateY: -20 },
  animate: { opacity: 1, rotateX: -18, rotateY: -32 },
  exit: { opacity: 0, rotateX: -22, rotateY: -10 },
};

const nodeVariants = {
  initial: { opacity: 0, scale: 0.7 },
  animate: { opacity: 1, scale: 1 },
};

export const SystemVerilog3DVisualizer: React.FC = () => {
  const [activeId, setActiveId] = useState<string>(structures[0]?.id ?? "");

  const activeStructure = useMemo(
    () => structures.find((structure) => structure.id === activeId) ?? structures[0],
    [activeId],
  );

  return (
    <div className="space-y-6" data-testid="sv-3d-visualizer">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold">SystemVerilog Data Structures – 3D Explorer</h4>
          <p className="text-sm text-muted-foreground" data-testid="sv-3d-summary">
            {activeStructure.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Select data structure">
          {structures.map((structure) => {
            const isActive = structure.id === activeStructure.id;
            return (
              <Button
                key={structure.id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveId(structure.id)}
                data-testid={`sv-3d-select-${structure.id}`}
              >
                {structure.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-950/90 p-6 shadow-2xl">
          <div
            className="relative mx-auto h-[360px] max-w-[520px]"
            style={{ perspective: "1100px" }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStructure.id}
                variants={containerVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="absolute inset-0"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div
                  className="absolute left-1/2 top-1/2 h-0 w-0"
                  style={{ transform: "translate3d(-50%, -50%, 0)" }}
                >
                  <div className="absolute h-[260px] w-[1px] bg-slate-500/30" style={{ transform: "translateZ(-140px)" }} />
                  <div className="absolute w-[320px] border border-dashed border-slate-500/20"
                    style={{
                      transform: "translateZ(-140px) rotateX(90deg)",
                      height: "320px",
                    }}
                  />
                </div>

                {(["x", "y", "z"] as const).map((axis) => (
                  <motion.div
                    key={`${activeStructure.id}-${axis}`}
                    className="absolute text-[0.65rem] font-semibold uppercase tracking-wide text-slate-300/80"
                    style={{
                      transform:
                        axis === "x"
                          ? "translate3d(140px, 120px, -120px) rotateX(0deg) rotateY(0deg)"
                          : axis === "y"
                            ? "translate3d(-160px, -140px, -120px) rotateX(0deg) rotateY(0deg)"
                            : "translate3d(-200px, 60px, -20px) rotateX(0deg) rotateY(0deg)",
                    }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 0.9, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                  >
                    {axis.toUpperCase()} · {activeStructure.axes[axis]}
                  </motion.div>
                ))}

                {activeStructure.nodes.map((node, index) => (
                  <motion.div
                    key={node.id}
                    variants={nodeVariants}
                    initial="initial"
                    animate="animate"
                    transition={{ duration: 0.35, delay: index * 0.05 }}
                    className={cn(
                      "absolute flex h-16 w-32 flex-col justify-center rounded-xl border px-3 py-2 text-xs font-semibold shadow-lg shadow-slate-950/40",
                      "bg-gradient-to-br",
                      toneClasses[node.tone],
                    )}
                    style={{
                      transform: `translate3d(-50%, -50%, 0) translate3d(calc(${node.position.x} * ${UNIT}rem), calc(${node.position.y} * ${UNIT}rem), calc(${node.position.z} * ${UNIT}rem))`,
                      transformStyle: "preserve-3d",
                      top: "50%",
                      left: "50%",
                    }}
                    data-testid={`sv-3d-node-${node.id}`}
                  >
                    <span>{node.label}</span>
                    {node.detail && <span className="text-[0.6rem] font-medium opacity-80">{node.detail}</span>}
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-4 rounded-xl border border-slate-600/40 bg-slate-900/70 p-4 text-xs text-slate-300" data-testid="sv-3d-context">
            {activeStructure.context}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            {activeStructure.insights.map((insight) => (
              <div
                key={`${activeStructure.id}-${insight.title}`}
                className="rounded-2xl border border-border/60 bg-muted/30 p-4"
              >
                <Badge variant="secondary" className="mb-2 uppercase tracking-wide">
                  {insight.title}
                </Badge>
                <p className="text-sm text-muted-foreground">{insight.body}</p>
              </div>
            ))}
          </div>
          {activeStructure.suggestedNext ? (
            <Button
              asChild
              variant="secondary"
              data-testid="sv-3d-suggested"
              className="w-full justify-between"
            >
              <a href={activeStructure.suggestedNext.href}>
                {activeStructure.suggestedNext.label}
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SystemVerilog3DVisualizer;
