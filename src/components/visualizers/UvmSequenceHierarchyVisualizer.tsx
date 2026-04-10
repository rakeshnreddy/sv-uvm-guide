'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  GitBranch,
  Terminal,
  Layers,
  Cpu,
  SkipForward,
} from 'lucide-react';

// ── Data Types ──────────────────────────────────────────────────────────────────

type NodeStatus = 'idle' | 'running' | 'done';

interface SeqNode {
  id: string;
  className: string;
  sequencer: string;
  children: SeqNode[];
}

interface LogEntry {
  step: number;
  nodeId: string;
  event: string;
  detail: string;
}

// ── Preset Data ─────────────────────────────────────────────────────────────────

const BASIC_TREE: SeqNode = {
  id: 'top',
  className: 'top_sequence',
  sequencer: 'main_sqr',
  children: [
    {
      id: 'wb',
      className: 'write_burst_sequence',
      sequencer: 'main_sqr',
      children: [
        {
          id: 'wb_rw',
          className: 'base_rw_sequence',
          sequencer: 'main_sqr',
          children: [],
        },
      ],
    },
    {
      id: 'rc',
      className: 'read_check_sequence',
      sequencer: 'main_sqr',
      children: [
        {
          id: 'rc_rw',
          className: 'base_rw_sequence',
          sequencer: 'main_sqr',
          children: [],
        },
      ],
    },
  ],
};

const VIRTUAL_SEQ_TREE: SeqNode = {
  id: 'vsq',
  className: 'virtual_sequence',
  sequencer: 'v_sqr (virtual)',
  children: [
    {
      id: 'axi_w',
      className: 'axi_write_seq',
      sequencer: 'axi_sqr',
      children: [
        {
          id: 'axi_item',
          className: 'axi_base_rw',
          sequencer: 'axi_sqr',
          children: [],
        },
      ],
    },
    {
      id: 'apb_cfg',
      className: 'apb_config_seq',
      sequencer: 'apb_sqr',
      children: [
        {
          id: 'apb_item',
          className: 'apb_base_rw',
          sequencer: 'apb_sqr',
          children: [],
        },
      ],
    },
  ],
};

// ── Execution order builder ─────────────────────────────────────────────────────

function buildExecutionOrder(node: SeqNode): LogEntry[] {
  const entries: LogEntry[] = [];
  let step = 0;

  function walk(n: SeqNode) {
    entries.push({ step: step++, nodeId: n.id, event: 'start()', detail: `${n.className}.start() called on ${n.sequencer}` });
    entries.push({ step: step++, nodeId: n.id, event: 'body()', detail: `${n.className}.body() begins execution` });

    if (n.children.length === 0) {
      entries.push({ step: step++, nodeId: n.id, event: 'finish_item()', detail: `${n.className}: start_item → randomize → finish_item handshake` });
    } else {
      for (const child of n.children) {
        walk(child);
      }
    }

    entries.push({ step: step++, nodeId: n.id, event: 'done', detail: `${n.className}.body() completed — returning to parent` });
  }

  walk(node);
  return entries;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function getStatusForNode(
  nodeId: string,
  visibleLog: LogEntry[],
): NodeStatus {
  const events = visibleLog.filter(e => e.nodeId === nodeId);
  if (events.length === 0) return 'idle';
  const last = events[events.length - 1];
  if (last.event === 'done') return 'done';
  return 'running';
}

const statusColors: Record<NodeStatus, string> = {
  idle: 'bg-slate-100 border-slate-300 text-slate-600',
  running: 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-300',
  done: 'bg-emerald-50 border-emerald-400 text-emerald-800',
};

const statusBadge: Record<NodeStatus, string> = {
  idle: 'bg-slate-200 text-slate-600',
  running: 'bg-amber-200 text-amber-800',
  done: 'bg-emerald-200 text-emerald-800',
};

// ── Tree Node component ─────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  collapsed,
  toggleCollapse,
  visibleLog,
  isHighlighted,
}: {
  node: SeqNode;
  depth: number;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  visibleLog: LogEntry[];
  isHighlighted: boolean;
}) {
  const status = getStatusForNode(node.id, visibleLog);
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col" style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      <motion.div
        layout
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 mb-1.5 transition-all cursor-pointer
          ${statusColors[status]}
          ${isHighlighted ? 'shadow-md scale-[1.02]' : 'shadow-sm'}`}
        onClick={() => hasChildren && toggleCollapse(node.id)}
        data-testid={`seq-node-${node.id}`}
      >
        {hasChildren ? (
          isCollapsed ? (
            <ChevronRight size={14} className="shrink-0 text-slate-400" />
          ) : (
            <ChevronDown size={14} className="shrink-0 text-slate-400" />
          )
        ) : (
          <Cpu size={14} className="shrink-0 text-slate-400" />
        )}

        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs font-bold truncate">{node.className}</span>
          <span className="text-[10px] opacity-70 truncate">on: {node.sequencer}</span>
        </div>

        <span
          className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusBadge[status]}`}
          data-testid={`status-${node.id}`}
        >
          {status}
        </span>
      </motion.div>

      <AnimatePresence>
        {hasChildren && !isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-l-2 border-slate-200 ml-3 pl-1 overflow-hidden"
          >
            {node.children.map(child => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                toggleCollapse={toggleCollapse}
                visibleLog={visibleLog}
                isHighlighted={
                  visibleLog.length > 0 &&
                  visibleLog[visibleLog.length - 1].nodeId === child.id
                }
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

export function UvmSequenceHierarchyVisualizer() {
  const [preset, setPreset] = useState<'basic' | 'virtual'>('basic');
  const tree = preset === 'basic' ? BASIC_TREE : VIRTUAL_SEQ_TREE;
  const executionOrder = useMemo(() => buildExecutionOrder(tree), [tree]);

  const [currentStep, setCurrentStep] = useState(-1);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visibleLog = useMemo(
    () => (currentStep >= 0 ? executionOrder.slice(0, currentStep + 1) : []),
    [currentStep, executionOrder],
  );

  const stepForward = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, executionOrder.length - 1));
  }, [executionOrder.length]);

  const reset = useCallback(() => {
    setCurrentStep(-1);
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const switchPreset = useCallback(
    (p: 'basic' | 'virtual') => {
      setPreset(p);
      setCurrentStep(-1);
      setCollapsed(new Set());
    },
    [],
  );

  const isFinished = currentStep >= executionOrder.length - 1;

  return (
    <div className="flex flex-col border border-slate-200 rounded-lg bg-white my-8 shadow-sm font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200 bg-slate-50">
        <GitBranch size={20} className="text-violet-600" />
        <h3 className="text-lg font-bold text-slate-800 m-0">
          UVM Sequence Hierarchy Explorer
        </h3>
        <span className="text-xs text-slate-500 ml-2">
          Step through nested sequence execution
        </span>
      </div>

      {/* Preset + Controls Bar */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50/50">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Preset:
        </span>
        <button
          onClick={() => switchPreset('basic')}
          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
            preset === 'basic'
              ? 'bg-violet-600 text-white'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
          data-testid="preset-basic"
        >
          Basic Hierarchy
        </button>
        <button
          onClick={() => switchPreset('virtual')}
          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
            preset === 'virtual'
              ? 'bg-violet-600 text-white'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
          data-testid="preset-virtual"
        >
          Virtual Sequencer
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={stepForward}
            disabled={isFinished}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            data-testid="step-forward"
          >
            <SkipForward size={14} /> Step
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
            data-testid="reset-btn"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid md:grid-cols-[1fr_1fr] gap-0">
        {/* Left: Tree */}
        <div className="p-4 border-r border-slate-200 bg-slate-50/30 overflow-auto max-h-[420px]">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
            <Layers size={14} /> Sequence Call Tree
          </h4>
          <TreeNode
            node={tree}
            depth={0}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            visibleLog={visibleLog}
            isHighlighted={
              visibleLog.length > 0 &&
              visibleLog[visibleLog.length - 1].nodeId === tree.id
            }
          />
        </div>

        {/* Right: Log */}
        <div className="p-4 bg-white overflow-auto max-h-[420px]">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
            <Terminal size={14} /> Lifecycle Event Log
          </h4>

          {visibleLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <Play size={28} className="opacity-50" />
              <span className="text-sm">
                Press <strong>Step</strong> to begin execution
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              {visibleLog.map((entry, idx) => {
                const isLatest = idx === visibleLog.length - 1;
                return (
                  <motion.div
                    key={`${entry.step}-${entry.nodeId}-${entry.event}`}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`text-xs font-mono px-3 py-1.5 rounded border transition-colors ${
                      isLatest
                        ? 'bg-violet-50 border-violet-200 text-violet-900'
                        : 'bg-slate-50 border-slate-100 text-slate-600'
                    }`}
                    data-testid="log-entry"
                  >
                    <span className="text-slate-400 mr-2">[{entry.step}]</span>
                    <span
                      className={`font-bold mr-1.5 ${
                        entry.event === 'start()'
                          ? 'text-blue-600'
                          : entry.event === 'body()'
                          ? 'text-amber-600'
                          : entry.event === 'finish_item()'
                          ? 'text-emerald-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {entry.event}
                    </span>
                    <span className="opacity-80">{entry.detail}</span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {isFinished && currentStep >= 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-xs text-center text-emerald-700 bg-emerald-50 border border-emerald-200 rounded py-2 font-medium"
            >
              ✅ All sequences completed — full hierarchy executed
            </motion.div>
          )}
        </div>
      </div>

      {/* Step counter */}
      <div className="px-6 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
        <span>
          Step: {currentStep < 0 ? '—' : currentStep + 1} /{' '}
          {executionOrder.length}
        </span>
        <span>
          Preset:{' '}
          <strong>
            {preset === 'basic' ? 'Basic Hierarchy' : 'Virtual Sequencer'}
          </strong>
        </span>
      </div>
    </div>
  );
}

export default UvmSequenceHierarchyVisualizer;
