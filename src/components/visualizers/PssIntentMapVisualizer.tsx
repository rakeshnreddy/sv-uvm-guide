'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Code2, ArrowRight, Globe, Layers, Zap, Settings } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────────

type CompileTarget = 'uvm' | 'c_bare_metal' | 'emulation';

interface ActionNode {
  id: string;
  label: string;
  type: 'action' | 'resource';
}

interface Edge {
  from: string;
  to: string;
  label: string;
  type: 'data' | 'ordering';
}

// ── PSS Action Graph Data ───────────────────────────────────────────────────────

const ACTION_NODES: ActionNode[] = [
  { id: 'write_mem', label: 'write_mem_action', type: 'action' },
  { id: 'read_mem', label: 'read_mem_action', type: 'action' },
  { id: 'verify', label: 'verify_data_action', type: 'action' },
];

const EDGES: Edge[] = [
  { from: 'write_mem', to: 'read_mem', label: 'ordering', type: 'ordering' },
  { from: 'read_mem', to: 'verify', label: 'data_out', type: 'data' },
  { from: 'write_mem', to: 'verify', label: 'exp_data', type: 'data' },
];

// ── Target-specific labels ──────────────────────────────────────────────────────

const TARGET_LABELS: Record<CompileTarget, { title: string; icon: React.ReactNode; color: string; bg: string }> = {
  uvm: {
    title: 'UVM Sequence',
    icon: <Layers size={16} />,
    color: 'text-violet-700',
    bg: 'bg-violet-50 border-violet-200',
  },
  c_bare_metal: {
    title: 'C Bare-Metal',
    icon: <Cpu size={16} />,
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
  },
  emulation: {
    title: 'Emulation',
    icon: <Zap size={16} />,
    color: 'text-cyan-700',
    bg: 'bg-cyan-50 border-cyan-200',
  },
};

const TARGET_NODE_LABELS: Record<CompileTarget, Record<string, string>> = {
  uvm: {
    write_mem: 'write_mem_seq\nextends uvm_sequence',
    read_mem: 'read_mem_seq\nextends uvm_sequence',
    verify: 'verify_seq\nextends uvm_sequence',
  },
  c_bare_metal: {
    write_mem: 'void write_mem(\n  uint32_t addr,\n  uint32_t data)',
    read_mem: 'uint32_t read_mem(\n  uint32_t addr)',
    verify: 'void verify(\n  uint32_t exp,\n  uint32_t act)',
  },
  emulation: {
    write_mem: 'TBA write_mem\n(emu_transactor)',
    read_mem: 'TBA read_mem\n(emu_transactor)',
    verify: 'HW checker\n(scoreboard IP)',
  },
};

// ── Generated code per target ───────────────────────────────────────────────────

const GENERATED_CODE: Record<CompileTarget, string> = {
  uvm: `// Generated UVM sequence from PSS action graph
class mem_test_seq extends uvm_sequence #(mem_txn);
  \`uvm_object_utils(mem_test_seq)

  write_mem_seq  m_write;
  read_mem_seq   m_read;
  verify_seq     m_verify;

  virtual task body();
    // Phase 1: Write
    \`uvm_do_with(m_write, {
      addr == 32'h1000;
      data == 32'hDEAD_BEEF;
    })

    // Phase 2: Read (ordering: after write)
    \`uvm_do_with(m_read, {
      addr == 32'h1000;
    })

    // Phase 3: Verify (data flow: exp + act)
    \`uvm_do_with(m_verify, {
      exp_data == m_write.data;
      act_data == m_read.read_data;
    })
  endtask
endclass`,

  c_bare_metal: `/* Generated C bare-metal test from PSS action graph */
#include "mem_utils.h"

void pss_mem_test(void) {
    uint32_t addr = 0x1000;
    uint32_t data = 0xDEADBEEF;

    /* Phase 1: Write */
    write_mem(addr, data);

    /* Phase 2: Read (ordering: after write) */
    uint32_t read_val = read_mem(addr);

    /* Phase 3: Verify (data flow: exp + act) */
    verify(data, read_val);
    printf("PSS mem_test: PASSED\\n");
}`,

  emulation: `// Generated Emulation-accelerated test from PSS
// Uses Transaction-Based Acceleration (TBA)

emu_test_config cfg;
cfg.transactor = "mem_transactor";
cfg.timeout_us = 100;

// Phase 1: TBA write via transactor
emu_write_txn(cfg, .addr(0x1000),
              .data(0xDEAD_BEEF));

// Phase 2: TBA read via transactor
emu_read_txn(cfg, .addr(0x1000),
             .expect(0xDEAD_BEEF));

// Phase 3: HW scoreboard auto-checks
// (verify_data_action compiled to
//  in-emulation checker IP)`,
};

// ── Graph Rendering ─────────────────────────────────────────────────────────────

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  write_mem: { x: 60, y: 70 },
  read_mem: { x: 230, y: 70 },
  verify: { x: 400, y: 70 },
};

const NODE_COLORS: Record<CompileTarget, { fill: string; stroke: string; text: string }> = {
  uvm: { fill: '#f5f3ff', stroke: '#8b5cf6', text: '#5b21b6' },
  c_bare_metal: { fill: '#fff7ed', stroke: '#f97316', text: '#c2410c' },
  emulation: { fill: '#ecfeff', stroke: '#06b6d4', text: '#0e7490' },
};

function ActionGraph({
  target,
}: {
  target: CompileTarget;
}) {
  const colors = NODE_COLORS[target];
  const labels = TARGET_NODE_LABELS[target];

  return (
    <svg
      viewBox="0 0 520 160"
      className="w-full h-auto"
      aria-label="PSS Action Graph"
    >
      {/* Edges */}
      {EDGES.map(edge => {
        const from = NODE_POSITIONS[edge.from];
        const to = NODE_POSITIONS[edge.to];
        const isDashed = edge.type === 'data';
        const midX = (from.x + 50 + to.x) / 2;
        const midY = edge.type === 'data' ? from.y + 55 : from.y - 15;

        return (
          <g key={`${edge.from}-${edge.to}`}>
            <path
              d={`M${from.x + 100},${from.y + 25} Q${midX},${midY} ${to.x},${to.y + 25}`}
              fill="none"
              stroke={isDashed ? '#94a3b8' : colors.stroke}
              strokeWidth={isDashed ? 1.5 : 2}
              strokeDasharray={isDashed ? '4,3' : undefined}
              markerEnd="url(#arrowhead)"
            />
            <text
              x={midX}
              y={midY + (edge.type === 'data' ? 12 : -4)}
              textAnchor="middle"
              className="text-[9px] fill-slate-400"
            >
              {edge.label}
            </text>
          </g>
        );
      })}

      {/* Arrow marker */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={colors.stroke} />
        </marker>
      </defs>

      {/* Nodes */}
      {ACTION_NODES.map(node => {
        const pos = NODE_POSITIONS[node.id];
        const label = labels[node.id] || node.label;
        const lines = label.split('\n');

        return (
          <motion.g
            key={node.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            data-testid={`graph-node-${node.id}`}
          >
            <rect
              x={pos.x}
              y={pos.y}
              width={100}
              height={50}
              rx={8}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={2}
            />
            {lines.map((line, i) => (
              <text
                key={i}
                x={pos.x + 50}
                y={pos.y + 20 + i * 14}
                textAnchor="middle"
                fill={colors.text}
                className="text-[10px] font-semibold"
              >
                {line}
              </text>
            ))}
          </motion.g>
        );
      })}
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

export function PssIntentMapVisualizer() {
  const [target, setTarget] = useState<CompileTarget>('uvm');
  const info = TARGET_LABELS[target];

  const switchTarget = useCallback((t: CompileTarget) => {
    setTarget(t);
  }, []);

  return (
    <div className="flex flex-col border border-slate-200 rounded-lg bg-white my-8 shadow-sm font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200 bg-slate-50">
        <Globe size={20} className="text-teal-600" />
        <h3 className="text-lg font-bold text-slate-800 m-0">
          PSS Intent Map — Write Once, Run Anywhere
        </h3>
        <span className="text-xs text-slate-500 ml-2">
          Explore PSS portability
        </span>
      </div>

      {/* Target Selector */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50/50">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Compile Target:
        </span>
        {(Object.keys(TARGET_LABELS) as CompileTarget[]).map(t => {
          const tInfo = TARGET_LABELS[t];
          const isActive = t === target;
          return (
            <button
              key={t}
              onClick={() => switchTarget(t)}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
              data-testid={`target-${t}`}
            >
              {tInfo.icon}
              {tInfo.title}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="grid md:grid-cols-[1fr_1fr] gap-0">
        {/* Left: Action Graph */}
        <div className="p-5 border-r border-slate-200 bg-slate-50/30">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
            <Settings size={14} /> Action Graph
            <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${info.bg} ${info.color}`}>
              {info.title}
            </span>
          </h4>

          <AnimatePresence mode="wait">
            <motion.div
              key={target}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ActionGraph target={target} />
            </motion.div>
          </AnimatePresence>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-5 h-0.5 bg-slate-800 inline-block" />
              Ordering edge
            </span>
            <span className="flex items-center gap-1">
              <span className="w-5 h-0.5 border-t border-dashed border-slate-400 inline-block" />
              Data-flow edge
            </span>
          </div>
        </div>

        {/* Right: Generated Code */}
        <div className="p-5 bg-white overflow-auto max-h-[480px]">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
            <Code2 size={14} /> Generated Code
            <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${info.bg} ${info.color}`}>
              {info.title}
            </span>
          </h4>

          <AnimatePresence mode="wait">
            <motion.div
              key={target}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <pre
                className="text-[11px] font-mono bg-slate-900 text-emerald-300 p-4 rounded-lg overflow-auto leading-relaxed whitespace-pre-wrap"
                data-testid="generated-code"
              >
                {GENERATED_CODE[target]}
              </pre>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer insight */}
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
        <strong>Key concept:</strong> The same PSS action graph produces structurally different
        output for each target, yet preserves the ordering and data-flow constraints identically.
      </div>
    </div>
  );
}

export default PssIntentMapVisualizer;
