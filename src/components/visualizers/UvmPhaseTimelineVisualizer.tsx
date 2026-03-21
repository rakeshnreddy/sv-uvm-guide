"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Play, Pause, RotateCcw, ChevronRight, X, Layers } from 'lucide-react';

// ── Data Model ──────────────────────────────────────────────────

interface PhaseInfo {
  name: string;
  group: 'build' | 'run' | 'cleanup';
  direction: 'top-down' | 'bottom-up' | 'parallel';
  isCustom?: boolean;
}

interface CellDetail {
  component: string;
  phase: string;
  baseClass: string;
  operations: string;
  code: string;
}

const COMPONENTS = [
  'uvm_test',
  'uvm_env',
  'uvm_agent',
  'uvm_driver',
  'uvm_monitor',
] as const;

const STANDARD_PHASES: PhaseInfo[] = [
  { name: 'build_phase', group: 'build', direction: 'top-down' },
  { name: 'connect_phase', group: 'build', direction: 'bottom-up' },
  { name: 'end_of_elaboration_phase', group: 'build', direction: 'bottom-up' },
  { name: 'start_of_simulation_phase', group: 'build', direction: 'bottom-up' },
  { name: 'run_phase', group: 'run', direction: 'parallel' },
  { name: 'pre_reset_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'reset_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'post_reset_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'pre_configure_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'configure_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'post_configure_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'pre_main_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'main_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'post_main_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'pre_shutdown_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'shutdown_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'post_shutdown_phase', group: 'run', direction: 'parallel', isCustom: true },
  { name: 'extract_phase', group: 'cleanup', direction: 'bottom-up' },
  { name: 'check_phase', group: 'cleanup', direction: 'bottom-up' },
  { name: 'report_phase', group: 'cleanup', direction: 'bottom-up' },
  { name: 'final_phase', group: 'cleanup', direction: 'top-down' },
];

// Cell details for every component × standard phase intersection
const CELL_DETAILS: Record<string, CellDetail> = {
  // build_phase
  'uvm_test:build_phase': { component: 'uvm_test', phase: 'build_phase', baseClass: 'uvm_component', operations: 'Instantiate the top-level env via the factory. Set configuration for child components using uvm_config_db.', code: `function void build_phase(uvm_phase phase);\n  super.build_phase(phase);\n  env = my_env::type_id::create("env", this);\n  uvm_config_db#(int)::set(this, "env.agent*", "num_txns", 100);\nendfunction` },
  'uvm_env:build_phase': { component: 'uvm_env', phase: 'build_phase', baseClass: 'uvm_env', operations: 'Instantiate agents, scoreboards, and coverage collectors. Apply config_db settings received from the test.', code: `function void build_phase(uvm_phase phase);\n  super.build_phase(phase);\n  agent = my_agent::type_id::create("agent", this);\n  scoreboard = my_scoreboard::type_id::create("sb", this);\nendfunction` },
  'uvm_agent:build_phase': { component: 'uvm_agent', phase: 'build_phase', baseClass: 'uvm_agent', operations: 'Instantiate driver, monitor, and sequencer based on is_active configuration.', code: `function void build_phase(uvm_phase phase);\n  super.build_phase(phase);\n  monitor = my_monitor::type_id::create("mon", this);\n  if (get_is_active() == UVM_ACTIVE) begin\n    driver = my_driver::type_id::create("drv", this);\n    sequencer = my_sequencer::type_id::create("sqr", this);\n  end\nendfunction` },
  'uvm_driver:build_phase': { component: 'uvm_driver', phase: 'build_phase', baseClass: 'uvm_driver', operations: 'Retrieve virtual interface handle from config_db.', code: `function void build_phase(uvm_phase phase);\n  super.build_phase(phase);\n  if (!uvm_config_db#(virtual my_if)::get(this, "", "vif", vif))\n    \`uvm_fatal("NO_VIF", "Virtual interface not set")\nendfunction` },
  'uvm_monitor:build_phase': { component: 'uvm_monitor', phase: 'build_phase', baseClass: 'uvm_monitor', operations: 'Retrieve virtual interface handle. Create analysis port for broadcasting observed transactions.', code: `function void build_phase(uvm_phase phase);\n  super.build_phase(phase);\n  ap = new("ap", this);\n  if (!uvm_config_db#(virtual my_if)::get(this, "", "vif", vif))\n    \`uvm_fatal("NO_VIF", "Virtual interface not set")\nendfunction` },

  // connect_phase
  'uvm_test:connect_phase': { component: 'uvm_test', phase: 'connect_phase', baseClass: 'uvm_component', operations: 'Typically empty at the test level — env handles its own connections.', code: `function void connect_phase(uvm_phase phase);\n  super.connect_phase(phase);\n  // Test level rarely needs connections\nendfunction` },
  'uvm_env:connect_phase': { component: 'uvm_env', phase: 'connect_phase', baseClass: 'uvm_env', operations: 'Wire agent analysis port to scoreboard and coverage collector analysis exports.', code: `function void connect_phase(uvm_phase phase);\n  super.connect_phase(phase);\n  agent.monitor.ap.connect(scoreboard.analysis_export);\n  agent.monitor.ap.connect(coverage.analysis_export);\nendfunction` },
  'uvm_agent:connect_phase': { component: 'uvm_agent', phase: 'connect_phase', baseClass: 'uvm_agent', operations: 'Connect driver seq_item_port to sequencer seq_item_export.', code: `function void connect_phase(uvm_phase phase);\n  super.connect_phase(phase);\n  if (get_is_active() == UVM_ACTIVE)\n    driver.seq_item_port.connect(sequencer.seq_item_export);\nendfunction` },
  'uvm_driver:connect_phase': { component: 'uvm_driver', phase: 'connect_phase', baseClass: 'uvm_driver', operations: 'seq_item_port already exists from base class. Usually no explicit connect needed here.', code: `function void connect_phase(uvm_phase phase);\n  super.connect_phase(phase);\n  // seq_item_port connected by agent\nendfunction` },
  'uvm_monitor:connect_phase': { component: 'uvm_monitor', phase: 'connect_phase', baseClass: 'uvm_monitor', operations: 'Analysis port already created in build. Connections made by parent agent/env.', code: `function void connect_phase(uvm_phase phase);\n  super.connect_phase(phase);\n  // ap connected by parent env\nendfunction` },

  // end_of_elaboration_phase
  'uvm_test:end_of_elaboration_phase': { component: 'uvm_test', phase: 'end_of_elaboration_phase', baseClass: 'uvm_component', operations: 'Print the full component topology for debug. Validate configuration completeness.', code: `function void end_of_elaboration_phase(uvm_phase phase);\n  uvm_top.print_topology();\nendfunction` },
  'uvm_env:end_of_elaboration_phase': { component: 'uvm_env', phase: 'end_of_elaboration_phase', baseClass: 'uvm_env', operations: 'Verify all expected connections are in place. Typically empty.', code: `// Usually empty at env level` },
  'uvm_agent:end_of_elaboration_phase': { component: 'uvm_agent', phase: 'end_of_elaboration_phase', baseClass: 'uvm_agent', operations: 'Verify agent configuration is valid.', code: `// Usually empty at agent level` },
  'uvm_driver:end_of_elaboration_phase': { component: 'uvm_driver', phase: 'end_of_elaboration_phase', baseClass: 'uvm_driver', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_monitor:end_of_elaboration_phase': { component: 'uvm_monitor', phase: 'end_of_elaboration_phase', baseClass: 'uvm_monitor', operations: 'Typically empty.', code: `// Usually empty` },

  // start_of_simulation_phase
  'uvm_test:start_of_simulation_phase': { component: 'uvm_test', phase: 'start_of_simulation_phase', baseClass: 'uvm_component', operations: 'Print banner, display test configuration summary.', code: `function void start_of_simulation_phase(uvm_phase phase);\n  \`uvm_info("TEST", $sformatf("Starting test: %s", get_type_name()), UVM_LOW)\nendfunction` },
  'uvm_env:start_of_simulation_phase': { component: 'uvm_env', phase: 'start_of_simulation_phase', baseClass: 'uvm_env', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_agent:start_of_simulation_phase': { component: 'uvm_agent', phase: 'start_of_simulation_phase', baseClass: 'uvm_agent', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_driver:start_of_simulation_phase': { component: 'uvm_driver', phase: 'start_of_simulation_phase', baseClass: 'uvm_driver', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_monitor:start_of_simulation_phase': { component: 'uvm_monitor', phase: 'start_of_simulation_phase', baseClass: 'uvm_monitor', operations: 'Typically empty.', code: `// Usually empty` },

  // run_phase
  'uvm_test:run_phase': { component: 'uvm_test', phase: 'run_phase', baseClass: 'uvm_component', operations: 'Raise objection, start the default sequence on the sequencer, then drop objection when complete.', code: `task run_phase(uvm_phase phase);\n  phase.raise_objection(this);\n  my_sequence seq = my_sequence::type_id::create("seq");\n  seq.start(env.agent.sequencer);\n  phase.drop_objection(this);\nendtask` },
  'uvm_env:run_phase': { component: 'uvm_env', phase: 'run_phase', baseClass: 'uvm_env', operations: 'Typically empty — work is delegated to driver and monitor. May run watchdog timers.', code: `// Env typically delegates to sub-components` },
  'uvm_agent:run_phase': { component: 'uvm_agent', phase: 'run_phase', baseClass: 'uvm_agent', operations: 'Typically empty — driver and monitor run independently.', code: `// Agent typically delegates to driver/monitor` },
  'uvm_driver:run_phase': { component: 'uvm_driver', phase: 'run_phase', baseClass: 'uvm_driver', operations: 'Infinite loop: get next sequence item from sequencer, drive it on the virtual interface, signal completion.', code: `task run_phase(uvm_phase phase);\n  forever begin\n    seq_item_port.get_next_item(req);\n    drive_transaction(req);\n    seq_item_port.item_done();\n  end\nendtask` },
  'uvm_monitor:run_phase': { component: 'uvm_monitor', phase: 'run_phase', baseClass: 'uvm_monitor', operations: 'Infinite loop: sample the virtual interface, assemble observed transactions, broadcast via analysis port.', code: `task run_phase(uvm_phase phase);\n  forever begin\n    @(posedge vif.clk);\n    my_txn txn = my_txn::type_id::create("txn");\n    collect_transaction(txn);\n    ap.write(txn);\n  end\nendtask` },

  // extract_phase
  'uvm_test:extract_phase': { component: 'uvm_test', phase: 'extract_phase', baseClass: 'uvm_component', operations: 'Typically empty at test level.', code: `// Usually empty` },
  'uvm_env:extract_phase': { component: 'uvm_env', phase: 'extract_phase', baseClass: 'uvm_env', operations: 'Collect final statistics from scoreboard and coverage components.', code: `function void extract_phase(uvm_phase phase);\n  total_matches = scoreboard.get_match_count();\n  total_mismatches = scoreboard.get_mismatch_count();\nendfunction` },
  'uvm_agent:extract_phase': { component: 'uvm_agent', phase: 'extract_phase', baseClass: 'uvm_agent', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_driver:extract_phase': { component: 'uvm_driver', phase: 'extract_phase', baseClass: 'uvm_driver', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_monitor:extract_phase': { component: 'uvm_monitor', phase: 'extract_phase', baseClass: 'uvm_monitor', operations: 'Extract final transaction count.', code: `function void extract_phase(uvm_phase phase);\n  \`uvm_info("MON", $sformatf("Observed %0d transactions", txn_count), UVM_LOW)\nendfunction` },

  // check_phase
  'uvm_test:check_phase': { component: 'uvm_test', phase: 'check_phase', baseClass: 'uvm_component', operations: 'Verify high-level pass/fail criteria.', code: `function void check_phase(uvm_phase phase);\n  if (env.scoreboard.get_mismatch_count() > 0)\n    \`uvm_error("TEST", "Mismatches detected!")\nendfunction` },
  'uvm_env:check_phase': { component: 'uvm_env', phase: 'check_phase', baseClass: 'uvm_env', operations: 'Verify scoreboard queues are drained (no unmatched transactions).', code: `function void check_phase(uvm_phase phase);\n  scoreboard.check_phase(phase);\nendfunction` },
  'uvm_agent:check_phase': { component: 'uvm_agent', phase: 'check_phase', baseClass: 'uvm_agent', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_driver:check_phase': { component: 'uvm_driver', phase: 'check_phase', baseClass: 'uvm_driver', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_monitor:check_phase': { component: 'uvm_monitor', phase: 'check_phase', baseClass: 'uvm_monitor', operations: 'Typically empty.', code: `// Usually empty` },

  // report_phase
  'uvm_test:report_phase': { component: 'uvm_test', phase: 'report_phase', baseClass: 'uvm_component', operations: 'Print final test pass/fail summary.', code: `function void report_phase(uvm_phase phase);\n  \`uvm_info("TEST", "=== TEST PASSED ===" , UVM_NONE)\nendfunction` },
  'uvm_env:report_phase': { component: 'uvm_env', phase: 'report_phase', baseClass: 'uvm_env', operations: 'Print environment-level statistics summary.', code: `function void report_phase(uvm_phase phase);\n  \`uvm_info("ENV", $sformatf("Matches: %0d, Mismatches: %0d", matches, mismatches), UVM_LOW)\nendfunction` },
  'uvm_agent:report_phase': { component: 'uvm_agent', phase: 'report_phase', baseClass: 'uvm_agent', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_driver:report_phase': { component: 'uvm_driver', phase: 'report_phase', baseClass: 'uvm_driver', operations: 'Report total transactions driven.', code: `function void report_phase(uvm_phase phase);\n  \`uvm_info("DRV", $sformatf("Drove %0d transactions", txn_count), UVM_LOW)\nendfunction` },
  'uvm_monitor:report_phase': { component: 'uvm_monitor', phase: 'report_phase', baseClass: 'uvm_monitor', operations: 'Report total transactions observed.', code: `function void report_phase(uvm_phase phase);\n  \`uvm_info("MON", $sformatf("Observed %0d transactions", txn_count), UVM_LOW)\nendfunction` },

  // final_phase
  'uvm_test:final_phase': { component: 'uvm_test', phase: 'final_phase', baseClass: 'uvm_component', operations: 'Last chance to perform cleanup. Runs top-down.', code: `// Usually empty — UVM handles cleanup` },
  'uvm_env:final_phase': { component: 'uvm_env', phase: 'final_phase', baseClass: 'uvm_env', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_agent:final_phase': { component: 'uvm_agent', phase: 'final_phase', baseClass: 'uvm_agent', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_driver:final_phase': { component: 'uvm_driver', phase: 'final_phase', baseClass: 'uvm_driver', operations: 'Typically empty.', code: `// Usually empty` },
  'uvm_monitor:final_phase': { component: 'uvm_monitor', phase: 'final_phase', baseClass: 'uvm_monitor', operations: 'Typically empty.', code: `// Usually empty` },
};

const GROUP_COLORS = {
  build: { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-700 dark:text-sky-300', badge: 'bg-sky-500', active: 'bg-sky-500/20 ring-sky-400' },
  run: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-500', active: 'bg-amber-500/20 ring-amber-400' },
  cleanup: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-500', active: 'bg-emerald-500/20 ring-emerald-400' },
};

const GROUP_LABELS: Record<string, string> = {
  build: '🏗️ Build-Time (Functions)',
  run: '▶️ Run-Time (Tasks)',
  cleanup: '🧹 Cleanup (Functions)',
};

// ── Component ────────────────────────────────────────────────────

export function UvmPhaseTimelineVisualizer() {
  const [animatingRow, setAnimatingRow] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);

  const visiblePhases = STANDARD_PHASES.filter(p => showCustom || !p.isCustom);

  const runAnimation = useCallback(() => {
    if (isAnimating) {
      setIsAnimating(false);
      setAnimatingRow(null);
      return;
    }
    setIsAnimating(true);
    setAnimatingRow(0);
    setSelectedCell(null);
  }, [isAnimating]);

  useEffect(() => {
    if (!isAnimating || animatingRow === null) return;
    if (animatingRow >= visiblePhases.length) {
      setIsAnimating(false);
      setAnimatingRow(null);
      return;
    }
    const timer = setTimeout(() => {
      setAnimatingRow(r => (r !== null ? r + 1 : null));
    }, 600);
    return () => clearTimeout(timer);
  }, [isAnimating, animatingRow, visiblePhases.length]);

  const handleReset = () => {
    setAnimatingRow(null);
    setIsAnimating(false);
    setSelectedCell(null);
  };

  const detail = selectedCell ? CELL_DETAILS[selectedCell] : null;

  return (
    <Card className="my-8 overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm" data-testid="phase-timeline">
      <CardHeader className="bg-slate-50 dark:bg-slate-900/50 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>UVM Phase Timeline</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Click any cell to see what happens at that phase × component intersection</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={showCustom ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setShowCustom(v => !v); handleReset(); }}
              data-testid="btn-custom-toggle"
            >
              <Layers className="w-4 h-4 mr-1" />
              {showCustom ? 'Hide' : 'Show'} Custom Phases
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} data-testid="btn-reset">
              <RotateCcw className="w-4 h-4 mr-1" /> Reset
            </Button>
            <Button variant="default" size="sm" onClick={runAnimation} data-testid="btn-animate">
              {isAnimating ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {isAnimating ? 'Pause' : 'Run Animation'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Swimlane Grid ── */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm min-w-[600px]">
              <thead>
                <tr>
                  <th className="p-2 text-left font-semibold text-slate-500 w-[180px] sticky left-0 bg-white dark:bg-slate-950 z-10">Phase</th>
                  {COMPONENTS.map(c => (
                    <th key={c} className="p-2 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">
                      {c.replace('uvm_', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePhases.map((phase, rowIdx) => {
                  const colors = GROUP_COLORS[phase.group];
                  const isActiveRow = animatingRow !== null && rowIdx <= animatingRow;
                  const isCurrentRow = animatingRow === rowIdx;
                  const isRunPhase = phase.name === 'run_phase';

                  // Insert group separator
                  const prevPhase = rowIdx > 0 ? visiblePhases[rowIdx - 1] : null;
                  const showGroupHeader = !prevPhase || prevPhase.group !== phase.group;

                  return (
                    <React.Fragment key={phase.name}>
                      {showGroupHeader && (
                        <tr>
                          <td colSpan={COMPONENTS.length + 1} className="pt-4 pb-1 px-2">
                            <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                              {GROUP_LABELS[phase.group]}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`transition-all duration-300 ${
                          isCurrentRow ? `${colors.active} ring-1 ring-inset` :
                          isActiveRow ? colors.bg : ''
                        } ${isRunPhase ? 'border-l-4 border-l-amber-400' : ''}`}
                        data-testid={`row-${phase.name}`}
                      >
                        <td className={`p-2 font-mono font-medium whitespace-nowrap sticky left-0 z-10 ${
                          isCurrentRow ? colors.active : isActiveRow ? colors.bg : 'bg-white dark:bg-slate-950'
                        } ${isRunPhase ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${colors.badge} ${isCurrentRow ? 'animate-pulse' : ''}`} />
                            {phase.name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {phase.direction === 'top-down' ? '↓ top-down' : phase.direction === 'bottom-up' ? '↑ bottom-up' : '⇄ parallel'}
                            {phase.isCustom && ' (optional)'}
                          </div>
                        </td>
                        {COMPONENTS.map(comp => {
                          const cellKey = `${comp}:${phase.name}`;
                          const hasCellDetail = !!CELL_DETAILS[cellKey];
                          const isCellSelected = selectedCell === cellKey;
                          return (
                            <td key={comp} className="p-1 text-center">
                              <button
                                className={`w-full rounded-lg border px-2 py-3 transition-all duration-200 text-xs
                                  ${isCellSelected
                                    ? `${colors.active} ring-2 ring-inset border-transparent font-semibold shadow-md`
                                    : hasCellDetail
                                      ? `border-slate-200 dark:border-slate-700 hover:${colors.active} hover:ring-1 hover:ring-inset cursor-pointer`
                                      : 'border-transparent text-slate-300 dark:text-slate-700 cursor-default'
                                  }
                                  ${isCurrentRow && hasCellDetail ? 'scale-105 shadow-sm' : ''}
                                  ${isRunPhase && hasCellDetail ? 'bg-amber-50 dark:bg-amber-900/10' : ''}
                                `}
                                onClick={() => hasCellDetail && setSelectedCell(isCellSelected ? null : cellKey)}
                                data-testid={`cell-${comp}-${phase.name}`}
                                disabled={!hasCellDetail}
                              >
                                {isActiveRow && hasCellDetail ? (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className={`w-3 h-3 rounded-full ${colors.badge} mx-auto`}
                                  />
                                ) : hasCellDetail ? (
                                  <div className="w-3 h-3 rounded-full border-2 border-slate-300 dark:border-slate-600 mx-auto" />
                                ) : (
                                  <div className="w-3 h-1 rounded bg-slate-200 dark:bg-slate-800 mx-auto" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Detail Side Panel ── */}
          <AnimatePresence>
            {detail && (
              <motion.div
                key={selectedCell}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="lg:w-[340px] shrink-0"
                data-testid="detail-panel"
              >
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden sticky top-28">
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                    <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Phase Details</h3>
                    <button
                      onClick={() => setSelectedCell(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      data-testid="btn-close-panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Phase</div>
                      <div className="font-mono font-bold text-sm" data-testid="detail-phase">{detail.phase}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Component</div>
                      <div className="font-mono text-sm">{detail.component}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Defined By</div>
                      <div className="font-mono text-sm text-slate-600 dark:text-slate-400">{detail.baseClass}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Typical Operations</div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed" data-testid="detail-operations">{detail.operations}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Code Snippet</div>
                      <pre className="bg-slate-950 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">
                        {detail.code}
                      </pre>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Legend ── */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50 flex flex-wrap gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Build-Time
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Run-Time
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Cleanup
          </div>
          <div className="flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3" /> Click a cell for details
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default UvmPhaseTimelineVisualizer;
