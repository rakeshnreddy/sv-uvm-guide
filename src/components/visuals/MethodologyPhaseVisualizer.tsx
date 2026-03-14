"use client";

import React, { useState, useCallback } from 'react';
import { Plus, RotateCcw, AlertTriangle, ChevronDown, Play } from 'lucide-react';

type Phase = {
  id: string;
  name: string;
  type: 'build' | 'run' | 'cleanup' | 'custom';
  isTask: boolean;
  description: string;
};

const STANDARD_PHASES: Phase[] = [
  { id: 'build', name: 'build_phase', type: 'build', isTask: false, description: 'Construct hierarchy and configure components' },
  { id: 'connect', name: 'connect_phase', type: 'build', isTask: false, description: 'Wire TLM ports and analysis exports' },
  { id: 'end_of_elaboration', name: 'end_of_elaboration_phase', type: 'build', isTask: false, description: 'Final topology adjustments' },
  { id: 'start_of_simulation', name: 'start_of_simulation_phase', type: 'build', isTask: false, description: 'Print topology, banner messages' },
  { id: 'reset', name: 'reset_phase', type: 'run', isTask: true, description: 'Assert and release DUT reset' },
  { id: 'configure', name: 'configure_phase', type: 'run', isTask: true, description: 'Program registers and configure DUT' },
  { id: 'main', name: 'main_phase', type: 'run', isTask: true, description: 'Primary stimulus generation and checking' },
  { id: 'shutdown', name: 'shutdown_phase', type: 'run', isTask: true, description: 'Graceful completion and drain' },
  { id: 'extract', name: 'extract_phase', type: 'cleanup', isTask: false, description: 'Collect results from scoreboards' },
  { id: 'check', name: 'check_phase', type: 'cleanup', isTask: false, description: 'Compare expected vs actual' },
  { id: 'report', name: 'report_phase', type: 'cleanup', isTask: false, description: 'Final summary and pass/fail' },
  { id: 'final', name: 'final_phase', type: 'cleanup', isTask: false, description: 'Cleanup and teardown' },
];

const CUSTOM_PHASE_TEMPLATES = [
  { name: 'load_fw_phase', description: 'Backdoor-load firmware images before main stimulus' },
  { name: 'security_check_phase', description: 'Run security attestation before traffic ramp-up' },
  { name: 'traffic_warmup_phase', description: 'Generate low-rate background traffic' },
];

const phaseTypeColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  build: { bg: 'bg-blue-900/30', border: 'border-blue-500/40', text: 'text-blue-300', dot: 'bg-blue-500' },
  run: { bg: 'bg-emerald-900/30', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-500' },
  cleanup: { bg: 'bg-amber-900/30', border: 'border-amber-500/40', text: 'text-amber-300', dot: 'bg-amber-500' },
  custom: { bg: 'bg-purple-900/30', border: 'border-purple-500/40', text: 'text-purple-300', dot: 'bg-purple-500' },
};

export default function MethodologyPhaseVisualizer() {
  const [phases, setPhases] = useState<Phase[]>(STANDARD_PHASES);
  const [selectedInsertAfter, setSelectedInsertAfter] = useState<string>('reset');
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [justInserted, setJustInserted] = useState<string | null>(null);

  const handleInsert = useCallback(() => {
    const template = CUSTOM_PHASE_TEMPLATES[selectedTemplate];
    const customId = `custom_${Date.now()}`;

    // Check for duplicate name
    if (phases.some(p => p.name === template.name)) {
      setConflictMessage(`⚠ Phase "${template.name}" already exists in the schedule. Duplicate phase names cause undefined iteration order at runtime.`);
      return;
    }

    const insertIndex = phases.findIndex(p => p.id === selectedInsertAfter);
    if (insertIndex < 0) return;

    const newPhase: Phase = {
      id: customId,
      name: template.name,
      type: 'custom',
      isTask: true,
      description: template.description,
    };

    // Check for suspicious ordering
    const afterPhase = phases[insertIndex];
    if (afterPhase.type === 'cleanup') {
      setConflictMessage(`⚠ Inserting a task phase after "${afterPhase.name}" (cleanup) is risky. Cleanup phases are function-based and run after simulation time ends. Your custom task phase may never get simulation time.`);
    } else {
      setConflictMessage(null);
    }

    const newPhases = [...phases];
    newPhases.splice(insertIndex + 1, 0, newPhase);
    setPhases(newPhases);
    setJustInserted(customId);
    setTimeout(() => setJustInserted(null), 2000);
  }, [phases, selectedInsertAfter, selectedTemplate]);

  const handleReset = useCallback(() => {
    setPhases(STANDARD_PHASES);
    setConflictMessage(null);
    setJustInserted(null);
  }, []);

  const customCount = phases.filter(p => p.type === 'custom').length;

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 font-sans my-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display text-white m-0">UVM Phase Schedule Explorer</h3>
          <p className="text-sm text-slate-400 mt-1">Insert custom phases and see how the schedule changes.</p>
        </div>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-700 flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Custom Phase</label>
          <div className="relative">
            <select
              value={selectedTemplate}
              onChange={e => setSelectedTemplate(Number(e.target.value))}
              className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 pr-8 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {CUSTOM_PHASE_TEMPLATES.map((t, i) => (
                <option key={i} value={i}>{t.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Insert After</label>
          <div className="relative">
            <select
              value={selectedInsertAfter}
              onChange={e => setSelectedInsertAfter(e.target.value)}
              className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 pr-8 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {phases.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={handleInsert}
          className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-sm font-medium rounded-lg transition-colors border border-purple-600 flex items-center gap-1.5 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Insert Phase
        </button>
      </div>

      {/* Conflict Warning */}
      {conflictMessage && (
        <div className="flex items-start gap-2 p-3 bg-amber-950/50 border border-amber-800/50 rounded-lg text-amber-200 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{conflictMessage}</span>
        </div>
      )}

      {/* Phase Timeline */}
      <div className="flex flex-col gap-0">
        <div className="flex items-center gap-4 mb-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Phase Execution Order ({phases.length} phases{customCount > 0 ? `, ${customCount} custom` : ''})
          </div>
          <div className="flex gap-3 text-[10px] ml-auto">
            {Object.entries(phaseTypeColors).map(([type, colors]) => (
              <span key={type} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
                <span className="text-slate-500 capitalize">{type}</span>
              </span>
            ))}
          </div>
        </div>

        {phases.map((phase, index) => {
          const colors = phaseTypeColors[phase.type];
          const isJustInserted = phase.id === justInserted;

          return (
            <div key={phase.id} className="flex items-stretch">
              {/* Timeline connector */}
              <div className="flex flex-col items-center w-6 flex-shrink-0">
                <div className={`w-3 h-3 rounded-full ${colors.dot} flex-shrink-0 ${isJustInserted ? 'ring-2 ring-purple-400 ring-offset-1 ring-offset-slate-900 animate-pulse' : ''}`} />
                {index < phases.length - 1 && (
                  <div className="w-px flex-1 bg-slate-700 min-h-[8px]" />
                )}
              </div>

              {/* Phase card */}
              <div className={`flex-1 ml-3 mb-2 px-4 py-2.5 rounded-lg border transition-all duration-500 ${colors.bg} ${colors.border} ${isJustInserted ? 'shadow-[0_0_20px_rgba(147,51,234,0.3)]' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-mono text-sm font-medium ${colors.text}`}>{phase.name}</span>
                    {phase.isTask && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">task</span>
                    )}
                    {phase.type === 'custom' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">custom</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">{index + 1}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{phase.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Code hint */}
      <div className="bg-black/40 rounded-lg border border-slate-800 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Code Pattern</div>
        <pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre">
{`// In base_test::build_phase:
uvm_phase after = uvm_${selectedInsertAfter}_phase::get();
uvm_domain::get_common_domain()
  .add(${CUSTOM_PHASE_TEMPLATES[selectedTemplate].name}::get(),
       .after_phase(after));`}
        </pre>
      </div>
    </div>
  );
}
