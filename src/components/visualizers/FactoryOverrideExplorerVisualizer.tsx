"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Play, RotateCcw, ChevronRight, ChevronDown, Zap, Layers } from 'lucide-react';

// ── Data Model ──────────────────────────────────────────────────

interface TreeNode {
  id: string;
  path: string;       // Hierarchical path e.g. "uvm_test_top.env.agent.drv"
  label: string;
  baseType: string;
  currentType: string;
  overrideSource: 'none' | 'type' | 'instance';
  children: TreeNode[];
}

interface RegistryEntry {
  typeName: string;
  isComponent: boolean;
}

interface OverrideRecord {
  kind: 'type' | 'instance';
  baseType: string;
  overrideType: string;
  instPath?: string;
}

// ── Default Data ────────────────────────────────────────────────

const REGISTRY: RegistryEntry[] = [
  { typeName: 'my_test', isComponent: true },
  { typeName: 'my_env', isComponent: true },
  { typeName: 'my_agent', isComponent: true },
  { typeName: 'base_driver', isComponent: true },
  { typeName: 'mock_driver', isComponent: true },
  { typeName: 'error_driver', isComponent: true },
  { typeName: 'my_monitor', isComponent: true },
  { typeName: 'fast_monitor', isComponent: true },
  { typeName: 'my_sequencer', isComponent: true },
  { typeName: 'base_txn', isComponent: false },
  { typeName: 'error_txn', isComponent: false },
];

function buildDefaultTree(): TreeNode {
  return {
    id: 'test', path: 'uvm_test_top', label: 'uvm_test_top', baseType: 'my_test', currentType: 'my_test', overrideSource: 'none',
    children: [
      {
        id: 'env', path: 'uvm_test_top.env', label: 'env', baseType: 'my_env', currentType: 'my_env', overrideSource: 'none',
        children: [
          {
            id: 'agent', path: 'uvm_test_top.env.agent', label: 'agent', baseType: 'my_agent', currentType: 'my_agent', overrideSource: 'none',
            children: [
              { id: 'drv', path: 'uvm_test_top.env.agent.drv', label: 'drv', baseType: 'base_driver', currentType: 'base_driver', overrideSource: 'none', children: [] },
              { id: 'mon', path: 'uvm_test_top.env.agent.mon', label: 'mon', baseType: 'my_monitor', currentType: 'my_monitor', overrideSource: 'none', children: [] },
              { id: 'sqr', path: 'uvm_test_top.env.agent.sqr', label: 'sqr', baseType: 'my_sequencer', currentType: 'my_sequencer', overrideSource: 'none', children: [] },
            ],
          },
        ],
      },
    ],
  };
}

// ── Override logic ──────────────────────────────────────────────

function applyOverrides(tree: TreeNode, overrides: OverrideRecord[]): TreeNode {
  // Deep clone
  const clone: TreeNode = JSON.parse(JSON.stringify(tree));

  function walk(node: TreeNode) {
    // Reset
    node.currentType = node.baseType;
    node.overrideSource = 'none';

    // Apply type overrides first
    for (const ov of overrides) {
      if (ov.kind === 'type' && node.baseType === ov.baseType) {
        node.currentType = ov.overrideType;
        node.overrideSource = 'type';
      }
    }

    // Instance overrides take precedence
    for (const ov of overrides) {
      if (ov.kind === 'instance' && ov.instPath) {
        // Support wildcards: *.drv matches any path ending in .drv
        const pattern = ov.instPath.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(node.path) && node.baseType === ov.baseType) {
          node.currentType = ov.overrideType;
          node.overrideSource = 'instance';
        }
      }
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(clone);
  return clone;
}

// ── Simulate create() log ──────────────────────────────────────

function simulateCreate(node: TreeNode, overrides: OverrideRecord[]): string[] {
  const log: string[] = [];
  log.push(`factory.create("${node.label}", parent) — requested type: ${node.baseType}`);
  log.push(`  1. Checking instance overrides for path "${node.path}"...`);

  const instMatch = overrides.find(
    ov => ov.kind === 'instance' && ov.instPath &&
      new RegExp(`^${ov.instPath.replace(/\*/g, '.*')}$`).test(node.path) &&
      ov.baseType === node.baseType
  );

  if (instMatch) {
    log.push(`     ✓ MATCH: instance override → ${instMatch.overrideType}`);
    log.push(`  2. Instance override takes precedence. Skipping type overrides.`);
    log.push(`  ✅ Result: creating ${instMatch.overrideType}`);
    return log;
  }

  log.push(`     ✗ No instance override found.`);
  log.push(`  2. Checking type overrides for "${node.baseType}"...`);

  const typeMatch = overrides.find(
    ov => ov.kind === 'type' && ov.baseType === node.baseType
  );

  if (typeMatch) {
    log.push(`     ✓ MATCH: type override → ${typeMatch.overrideType}`);
    log.push(`  ✅ Result: creating ${typeMatch.overrideType}`);
  } else {
    log.push(`     ✗ No type override found.`);
    log.push(`  ✅ Result: creating ${node.baseType} (original type)`);
  }

  return log;
}

// ── TreeNodeView ───────────────────────────────────────────────

function TreeNodeView({
  node,
  overrides,
  onSimulate,
  depth = 0,
}: {
  node: TreeNode;
  overrides: OverrideRecord[];
  onSimulate: (node: TreeNode) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isOverridden = node.overrideSource !== 'none';

  return (
    <div className="relative" data-testid={`tree-node-${node.id}`}>
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
          isOverridden
            ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700'
            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
        }`}
        style={{ marginLeft: depth * 24 }}
      >
        {hasChildren && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            data-testid={`toggle-${node.id}`}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}

        <span className="font-medium text-slate-700 dark:text-slate-200">{node.label}</span>
        <span className="font-mono text-xs text-slate-400">: {node.currentType}</span>

        {isOverridden && (
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              node.overrideSource === 'instance'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            }`}
            data-testid={`badge-${node.id}`}
          >
            <Zap className="w-3 h-3" />
            {node.overrideSource === 'instance' ? 'INST' : 'TYPE'} OVERRIDE
          </span>
        )}

        {!hasChildren && (
          <button
            onClick={() => onSimulate(node)}
            className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
            data-testid={`simulate-${node.id}`}
          >
            <Play className="w-3 h-3" />
            simulate
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-1 space-y-1 overflow-hidden"
          >
            {node.children.map(child => (
              <TreeNodeView
                key={child.id}
                node={child}
                overrides={overrides}
                onSimulate={onSimulate}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────

export function FactoryOverrideExplorerVisualizer() {
  const [overrides, setOverrides] = useState<OverrideRecord[]>([]);
  const [simLog, setSimLog] = useState<string[] | null>(null);

  // Override form state
  const [overrideKind, setOverrideKind] = useState<'type' | 'instance'>('type');
  const [baseType, setBaseType] = useState('base_driver');
  const [overrideType, setOverrideType] = useState('mock_driver');
  const [instPath, setInstPath] = useState('uvm_test_top.env.agent.drv');

  const tree = applyOverrides(buildDefaultTree(), overrides);

  const componentTypes = REGISTRY.filter(r => r.isComponent).map(r => r.typeName);

  const handleApply = useCallback(() => {
    const record: OverrideRecord = {
      kind: overrideKind,
      baseType,
      overrideType,
      ...(overrideKind === 'instance' ? { instPath } : {}),
    };
    setOverrides(prev => [...prev, record]);
    setSimLog(null);
  }, [overrideKind, baseType, overrideType, instPath]);

  const handleSimulate = useCallback((node: TreeNode) => {
    setSimLog(simulateCreate(node, overrides));
  }, [overrides]);

  const handleReset = useCallback(() => {
    setOverrides([]);
    setSimLog(null);
  }, []);

  return (
    <Card className="my-8 overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm" data-testid="factory-explorer">
      <CardHeader className="bg-slate-50 dark:bg-slate-900/50 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Factory Override Explorer</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Apply type and instance overrides, then simulate the factory lookup</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} data-testid="btn-reset">
            <RotateCcw className="w-4 h-4 mr-1" /> Reset All
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ── Left: Tree + Override Form ── */}
          <div className="space-y-4">
            {/* Override Form */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Apply Override
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Kind */}
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Override Type</label>
                  <select
                    value={overrideKind}
                    onChange={e => setOverrideKind(e.target.value as 'type' | 'instance')}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-3 py-1.5"
                    data-testid="select-kind"
                  >
                    <option value="type">Type Override</option>
                    <option value="instance">Instance Override</option>
                  </select>
                </div>

                {/* Base Type */}
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Base Type</label>
                  <select
                    value={baseType}
                    onChange={e => setBaseType(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-3 py-1.5"
                    data-testid="select-base"
                  >
                    {componentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Override Type */}
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Override With</label>
                  <select
                    value={overrideType}
                    onChange={e => setOverrideType(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-3 py-1.5"
                    data-testid="select-override"
                  >
                    {componentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Instance Path (conditional) */}
                {overrideKind === 'instance' && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Instance Path</label>
                    <input
                      type="text"
                      value={instPath}
                      onChange={e => setInstPath(e.target.value)}
                      className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-3 py-1.5 font-mono"
                      placeholder="uvm_test_top.env.agent.drv"
                      data-testid="input-path"
                    />
                  </div>
                )}
              </div>

              <Button variant="default" size="sm" onClick={handleApply} className="mt-3" data-testid="btn-apply">
                Apply Override
              </Button>
            </div>

            {/* Active Overrides */}
            {overrides.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Active Overrides ({overrides.length})</h4>
                <div className="space-y-1" data-testid="override-list">
                  {overrides.map((ov, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400" data-testid={`override-${i}`}>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ov.kind === 'type'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      }`}>{ov.kind}</span>
                      {ov.baseType} → {ov.overrideType}
                      {ov.instPath && <span className="text-slate-400"> @ {ov.instPath}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Component Tree */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Component Hierarchy</h4>
              <div className="space-y-1" data-testid="component-tree">
                <TreeNodeView node={tree} overrides={overrides} onSimulate={handleSimulate} />
              </div>
            </div>
          </div>

          {/* ── Right: Registry + Sim Log ── */}
          <div className="space-y-4">
            {/* Factory Registry */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Factory Registry</h3>
              <div className="space-y-1" data-testid="factory-registry">
                {REGISTRY.map(entry => (
                  <div key={entry.typeName} className="flex items-center gap-2 text-xs rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <span className={`w-2 h-2 rounded-full ${entry.isComponent ? 'bg-sky-500' : 'bg-emerald-500'}`} />
                    <span className="font-mono text-slate-600 dark:text-slate-400">{entry.typeName}</span>
                    <span className="ml-auto text-[10px] text-slate-400">{entry.isComponent ? 'component' : 'object'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulate create() Log */}
            <AnimatePresence>
              {simLog && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4"
                  data-testid="sim-log"
                >
                  <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4" /> Simulate create()
                  </h3>
                  <div className="space-y-1">
                    {simLog.map((line, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="text-xs font-mono text-indigo-900 dark:text-indigo-200 whitespace-pre-wrap"
                        data-testid={`log-line-${i}`}
                      >
                        {line}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50 flex flex-wrap gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Component type
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Object type
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">TYPE</span> Type override
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">INST</span> Instance override
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default FactoryOverrideExplorerVisualizer;
