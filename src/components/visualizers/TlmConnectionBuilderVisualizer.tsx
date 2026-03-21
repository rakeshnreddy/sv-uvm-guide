"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckCircle, Eye, RotateCcw, AlertTriangle, Zap, X } from 'lucide-react';

// ── Data Model ──────────────────────────────────────────────────

type PortKind = 'port' | 'export' | 'analysis_port' | 'analysis_export';

interface PortDef {
  id: string;
  label: string;
  kind: PortKind;
  /** side of the node the port is on */
  side: 'left' | 'right' | 'bottom';
}

interface ComponentNode {
  id: string;
  label: string;
  subtitle: string;
  ports: PortDef[];
  /** Grid position [col, row] */
  pos: [number, number];
}

interface ExpectedConnection {
  from: string; // portId
  to: string;   // portId
}

interface Scenario {
  name: string;
  description: string;
  nodes: ComponentNode[];
  expected: ExpectedConnection[];
}

// ── Compatibility Rules ────────────────────────────────────────

function arePortsCompatible(a: PortKind, b: PortKind): boolean {
  // port → export, analysis_port → analysis_export
  if (a === 'port' && b === 'export') return true;
  if (a === 'export' && b === 'port') return true;
  if (a === 'analysis_port' && b === 'analysis_export') return true;
  if (a === 'analysis_export' && b === 'analysis_port') return true;
  return false;
}

function getPortColor(kind: PortKind): string {
  switch (kind) {
    case 'port': return '#3b82f6';           // blue
    case 'export': return '#22c55e';         // green
    case 'analysis_port': return '#f97316';  // orange
    case 'analysis_export': return '#a855f7'; // purple
  }
}

function getPortColorClass(kind: PortKind): string {
  switch (kind) {
    case 'port': return 'bg-blue-500';
    case 'export': return 'bg-green-500';
    case 'analysis_port': return 'bg-orange-500';
    case 'analysis_export': return 'bg-purple-500';
  }
}

// ── Scenarios ──────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  {
    name: 'Basic Agent',
    description: 'Connect sequencer, driver, and monitor within a basic UVM agent.',
    nodes: [
      {
        id: 'sequencer', label: 'Sequencer', subtitle: 'uvm_sequencer',
        ports: [
          { id: 'sqr_export', label: 'seq_item_export', kind: 'export', side: 'right' },
        ],
        pos: [0, 0],
      },
      {
        id: 'driver', label: 'Driver', subtitle: 'uvm_driver',
        ports: [
          { id: 'drv_port', label: 'seq_item_port', kind: 'port', side: 'left' },
        ],
        pos: [2, 0],
      },
      {
        id: 'monitor', label: 'Monitor', subtitle: 'uvm_monitor',
        ports: [
          { id: 'mon_ap', label: 'analysis_port', kind: 'analysis_port', side: 'right' },
        ],
        pos: [0, 1],
      },
      {
        id: 'scoreboard', label: 'Scoreboard', subtitle: 'uvm_scoreboard',
        ports: [
          { id: 'sb_imp', label: 'analysis_imp', kind: 'analysis_export', side: 'left' },
        ],
        pos: [2, 1],
      },
    ],
    expected: [
      { from: 'drv_port', to: 'sqr_export' },
      { from: 'mon_ap', to: 'sb_imp' },
    ],
  },
  {
    name: 'Scoreboard Checker',
    description: 'Wire monitor analysis ports through a FIFO to a scoreboard.',
    nodes: [
      {
        id: 'monitor', label: 'Monitor', subtitle: 'uvm_monitor',
        ports: [
          { id: 'mon_ap', label: 'analysis_port', kind: 'analysis_port', side: 'right' },
        ],
        pos: [0, 0],
      },
      {
        id: 'fifo', label: 'Analysis FIFO', subtitle: 'uvm_tlm_analysis_fifo',
        ports: [
          { id: 'fifo_ae', label: 'analysis_export', kind: 'analysis_export', side: 'left' },
          { id: 'fifo_get', label: 'get_export', kind: 'export', side: 'right' },
        ],
        pos: [1, 0],
      },
      {
        id: 'scoreboard', label: 'Scoreboard', subtitle: 'uvm_scoreboard',
        ports: [
          { id: 'sb_get_port', label: 'get_port', kind: 'port', side: 'left' },
        ],
        pos: [2, 0],
      },
    ],
    expected: [
      { from: 'mon_ap', to: 'fifo_ae' },
      { from: 'sb_get_port', to: 'fifo_get' },
    ],
  },
  {
    name: 'Coverage Collector',
    description: 'Fan out a monitor\'s analysis port to both a scoreboard and a coverage collector.',
    nodes: [
      {
        id: 'monitor', label: 'Monitor', subtitle: 'uvm_monitor',
        ports: [
          { id: 'mon_ap', label: 'analysis_port', kind: 'analysis_port', side: 'right' },
        ],
        pos: [0, 0],
      },
      {
        id: 'scoreboard', label: 'Scoreboard', subtitle: 'uvm_scoreboard',
        ports: [
          { id: 'sb_imp', label: 'analysis_imp', kind: 'analysis_export', side: 'left' },
        ],
        pos: [2, 0],
      },
      {
        id: 'coverage', label: 'Coverage', subtitle: 'uvm_subscriber',
        ports: [
          { id: 'cov_imp', label: 'analysis_imp', kind: 'analysis_export', side: 'left' },
        ],
        pos: [2, 1],
      },
    ],
    expected: [
      { from: 'mon_ap', to: 'sb_imp' },
      { from: 'mon_ap', to: 'cov_imp' },
    ],
  },
];

// ── Geometry helpers ───────────────────────────────────────────

const NODE_W = 180;
const NODE_H = 80;
const COL_GAP = 60;
const ROW_GAP = 40;
const PORT_R = 8;

function nodeTopLeft(col: number, row: number): { x: number; y: number } {
  return {
    x: col * (NODE_W + COL_GAP) + 20,
    y: row * (NODE_H + ROW_GAP) + 20,
  };
}

function portPos(node: ComponentNode, port: PortDef, portIndex: number, totalOnSide: number): { x: number; y: number } {
  const { x, y } = nodeTopLeft(node.pos[0], node.pos[1]);
  const portsOnSide = node.ports.filter(p => p.side === port.side);
  const idx = portsOnSide.indexOf(port);
  const count = portsOnSide.length;

  switch (port.side) {
    case 'left':
      return { x: x - PORT_R, y: y + (NODE_H / (count + 1)) * (idx + 1) };
    case 'right':
      return { x: x + NODE_W + PORT_R, y: y + (NODE_H / (count + 1)) * (idx + 1) };
    case 'bottom':
      return { x: x + (NODE_W / (count + 1)) * (idx + 1), y: y + NODE_H + PORT_R };
  }
}

// ── Connection type ────────────────────────────────────────────

interface Connection {
  from: string;
  to: string;
}

// ── Component ──────────────────────────────────────────────────

export function TlmConnectionBuilderVisualizer() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [missingPorts, setMissingPorts] = useState<Set<string>>(new Set());
  const [showSolution, setShowSolution] = useState(false);
  const [validationResult, setValidationResult] = useState<'pass' | 'fail' | null>(null);
  const [errorFlashPort, setErrorFlashPort] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scenario = SCENARIOS[scenarioIndex];

  // Build a lookup from portId → { node, port }
  const portLookup = React.useMemo(() => {
    const map = new Map<string, { node: ComponentNode; port: PortDef }>();
    for (const node of scenario.nodes) {
      for (const port of node.ports) {
        map.set(port.id, { node, port });
      }
    }
    return map;
  }, [scenario]);

  // Reset state when scenario changes
  const resetState = useCallback(() => {
    setConnections([]);
    setSelectedPort(null);
    setErrorMsg(null);
    setMissingPorts(new Set());
    setShowSolution(false);
    setValidationResult(null);
    setErrorFlashPort(null);
  }, []);

  useEffect(() => {
    resetState();
  }, [scenarioIndex, resetState]);

  // Calculate SVG canvas size
  const maxCol = Math.max(...scenario.nodes.map(n => n.pos[0]));
  const maxRow = Math.max(...scenario.nodes.map(n => n.pos[1]));
  const svgW = (maxCol + 1) * (NODE_W + COL_GAP) + 40;
  const svgH = (maxRow + 1) * (NODE_H + ROW_GAP) + 60;

  const handlePortClick = useCallback((portId: string) => {
    if (showSolution) return;

    const clicked = portLookup.get(portId);
    if (!clicked) return;

    if (!selectedPort) {
      // First click — select the port
      setSelectedPort(portId);
      setErrorMsg(null);
      return;
    }

    if (selectedPort === portId) {
      // Deselect
      setSelectedPort(null);
      return;
    }

    // Second click — attempt connection
    const source = portLookup.get(selectedPort);
    if (!source) {
      setSelectedPort(null);
      return;
    }

    if (arePortsCompatible(source.port.kind, clicked.port.kind)) {
      // Check if connection already exists
      const duplicate = connections.some(
        c => (c.from === selectedPort && c.to === portId) || (c.from === portId && c.to === selectedPort)
      );
      if (!duplicate) {
        setConnections(prev => [...prev, { from: selectedPort!, to: portId }]);
        setValidationResult(null);
        setMissingPorts(new Set());
      }
      setSelectedPort(null);
      setErrorMsg(null);
    } else {
      // Incompatible — flash error
      setErrorMsg(`Cannot connect ${source.port.kind.replace('_', ' ')} to ${clicked.port.kind.replace('_', ' ')}`);
      setErrorFlashPort(portId);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        setErrorFlashPort(null);
        setErrorMsg(null);
      }, 1500);
      setSelectedPort(null);
    }
  }, [selectedPort, portLookup, connections, showSolution]);

  const handleCheck = useCallback(() => {
    const missing = new Set<string>();
    let allFound = true;

    for (const exp of scenario.expected) {
      const found = connections.some(
        c => (c.from === exp.from && c.to === exp.to) || (c.from === exp.to && c.to === exp.from)
      );
      if (!found) {
        allFound = false;
        missing.add(exp.from);
        missing.add(exp.to);
      }
    }

    setMissingPorts(missing);
    setValidationResult(allFound ? 'pass' : 'fail');
  }, [connections, scenario.expected]);

  const handleShowSolution = useCallback(() => {
    setConnections(scenario.expected.map(e => ({ from: e.from, to: e.to })));
    setShowSolution(true);
    setMissingPorts(new Set());
    setValidationResult('pass');
    setSelectedPort(null);
  }, [scenario.expected]);

  const handleScenarioChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setScenarioIndex(Number(e.target.value));
  }, []);

  return (
    <Card className="my-8 overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm" data-testid="tlm-builder">
      <CardHeader className="bg-slate-50 dark:bg-slate-900/50 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>TLM Connection Builder</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Click a source port, then click a matching destination to connect them</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={scenarioIndex}
              onChange={handleScenarioChange}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              data-testid="scenario-select"
            >
              {SCENARIOS.map((s, i) => (
                <option key={s.name} value={i}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {/* ── Scenario Description ── */}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4" data-testid="scenario-description">
          {scenario.description}
        </p>

        {/* ── SVG Canvas ── */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 mb-4">
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="min-w-[500px]"
            data-testid="tlm-canvas"
          >
            {/* ── Connection Lines ── */}
            {connections.map((conn, idx) => {
              const fromEntry = portLookup.get(conn.from);
              const toEntry = portLookup.get(conn.to);
              if (!fromEntry || !toEntry) return null;
              const p1 = portPos(fromEntry.node, fromEntry.port, 0, 1);
              const p2 = portPos(toEntry.node, toEntry.port, 0, 1);
              const midX = (p1.x + p2.x) / 2;
              return (
                <g key={`conn-${idx}`} data-testid={`connection-${conn.from}-${conn.to}`}>
                  <motion.path
                    d={`M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`}
                    fill="none"
                    stroke={showSolution ? '#22c55e' : '#6366f1'}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.4 }}
                  />
                  {/* Arrowhead */}
                  <circle cx={p2.x} cy={p2.y} r={4} fill={showSolution ? '#22c55e' : '#6366f1'} />
                </g>
              );
            })}

            {/* ── Component Nodes ── */}
            {scenario.nodes.map(node => {
              const { x, y } = nodeTopLeft(node.pos[0], node.pos[1]);
              return (
                <g key={node.id} data-testid={`node-${node.id}`}>
                  {/* Node box */}
                  <rect
                    x={x}
                    y={y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={12}
                    ry={12}
                    fill="white"
                    stroke="#cbd5e1"
                    strokeWidth={1.5}
                    className="dark:fill-slate-800 dark:stroke-slate-600"
                  />
                  {/* Label */}
                  <text
                    x={x + NODE_W / 2}
                    y={y + 30}
                    textAnchor="middle"
                    className="fill-slate-800 dark:fill-slate-200 text-sm font-semibold"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    {node.label}
                  </text>
                  {/* Subtitle */}
                  <text
                    x={x + NODE_W / 2}
                    y={y + 48}
                    textAnchor="middle"
                    className="fill-slate-400 dark:fill-slate-500"
                    style={{ fontSize: 10, fontFamily: 'monospace' }}
                  >
                    {node.subtitle}
                  </text>

                  {/* ── Ports ── */}
                  {node.ports.map((port, pi) => {
                    const pp = portPos(node, port, pi, node.ports.length);
                    const isSelected = selectedPort === port.id;
                    const isMissing = missingPorts.has(port.id);
                    const isErrorFlash = errorFlashPort === port.id;

                    return (
                      <g key={port.id}>
                        {/* Port circle */}
                        <circle
                          cx={pp.x}
                          cy={pp.y}
                          r={isSelected ? PORT_R + 3 : PORT_R}
                          fill={isErrorFlash ? '#ef4444' : getPortColor(port.kind)}
                          stroke={isSelected ? '#facc15' : isMissing ? '#eab308' : 'white'}
                          strokeWidth={isSelected ? 3 : isMissing ? 3 : 2}
                          className="cursor-pointer transition-all duration-150"
                          onClick={() => handlePortClick(port.id)}
                          data-testid={`port-${port.id}`}
                        >
                          <title>{`${port.label} (${port.kind.replace('_', ' ')})`}</title>
                        </circle>
                        {/* Port label */}
                        <text
                          x={port.side === 'left' ? pp.x - PORT_R - 4 : port.side === 'right' ? pp.x + PORT_R + 4 : pp.x}
                          y={port.side === 'bottom' ? pp.y + PORT_R + 12 : pp.y + 3}
                          textAnchor={port.side === 'left' ? 'end' : port.side === 'right' ? 'start' : 'middle'}
                          className="fill-slate-500 dark:fill-slate-400"
                          style={{ fontSize: 9, fontFamily: 'monospace' }}
                        >
                          {port.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── Error Message ── */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4"
              data-testid="error-message"
            >
              <X className="w-4 h-4 shrink-0" />
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Validation Result ── */}
        <AnimatePresence>
          {validationResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 mb-4 border ${
                validationResult === 'pass'
                  ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              }`}
              data-testid="validation-result"
            >
              {validationResult === 'pass' ? (
                <><CheckCircle className="w-4 h-4 shrink-0" /> All connections are correct!</>
              ) : (
                <><AlertTriangle className="w-4 h-4 shrink-0" /> Missing connections highlighted in yellow. Try again!</>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Controls ── */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCheck} data-testid="btn-check">
            <Zap className="w-4 h-4 mr-1" /> Check Connections
          </Button>
          <Button variant="outline" size="sm" onClick={handleShowSolution} data-testid="btn-solution">
            <Eye className="w-4 h-4 mr-1" /> Show Solution
          </Button>
          <Button variant="outline" size="sm" onClick={resetState} data-testid="btn-reset">
            <RotateCcw className="w-4 h-4 mr-1" /> Reset
          </Button>
        </div>

        {/* ── Legend ── */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50 flex flex-wrap gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> TLM Port (initiator)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> TLM Export (responder)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Analysis Port
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Analysis Export/Imp
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TlmConnectionBuilderVisualizer;
