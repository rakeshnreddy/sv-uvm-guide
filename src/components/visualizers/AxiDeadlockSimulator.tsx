"use client";

import { AlertTriangle, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import React from "react";
import { useEffect, useMemo, useReducer, useState } from "react";

import {
  analyzeDependencies,
  axiDependencyScenarios,
  type DependencyEdge,
} from "@/lib/axi-dependency-model";
import { createPlaybackState, playbackReducer } from "@/lib/playback-machine";

const PLAYBACK_MS = 1400;

function legalityLabel(edge: DependencyEdge): string {
  if (edge.legality === "illegal") return "AXI protocol violation";
  if (edge.legality === "legal-destination-policy") return "Legal destination policy";
  return "Legal dependency";
}

export default function AxiDeadlockSimulator() {
  const [scenarioId, setScenarioId] = useState(axiDependencyScenarios[0].id);
  const scenario = axiDependencyScenarios.find((candidate) => candidate.id === scenarioId) ?? axiDependencyScenarios[0];
  const [playback, dispatch] = useReducer(playbackReducer, scenario.dependencies.length + 1, createPlaybackState);
  const visibleDependencies = scenario.dependencies.slice(0, playback.index);
  const analysis = useMemo(
    () => analyzeDependencies({ ...scenario, dependencies: visibleDependencies }),
    [scenario, visibleDependencies],
  );

  useEffect(() => {
    if (playback.status !== "playing") return;
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => dispatch({ type: "TICK" }), PLAYBACK_MS);
    return () => clearTimeout(timer);
  }, [playback.index, playback.status]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100" data-testid="axi-deadlock-simulator">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-800/60 px-4 py-3">
        <h3 className="text-base font-semibold">AXI Dependency Analyzer</h3>
        <label className="text-sm text-slate-300">
          <span className="sr-only">Dependency scenario</span>
          <select
            value={scenarioId}
            onChange={(event) => {
              setScenarioId(event.target.value as typeof scenarioId);
              dispatch({ type: "SET_LENGTH", itemCount: axiDependencyScenarios.find((item) => item.id === event.target.value)!.dependencies.length + 1 });
            }}
            className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5"
          >
            {axiDependencyScenarios.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </header>

      <p className="border-b border-slate-700/60 px-4 py-3 text-sm text-slate-300">{scenario.description}</p>

      <div className="grid gap-3 p-4 md:grid-cols-2">
        {scenario.dependencies.map((edge, index) => {
          const visible = index < playback.index;
          return (
            <article key={`${edge.from}-${edge.to}`} aria-hidden={!visible} className={`rounded-lg border p-4 transition ${visible ? edge.legality === "illegal" ? "border-rose-500 bg-rose-500/10" : "border-amber-500/60 bg-amber-500/10" : "border-slate-700 opacity-30"}`}>
              <p className="font-mono text-sm">{edge.from} <span aria-hidden>→</span> {edge.to}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide">{legalityLabel(edge)}</p>
              {edge.rule && <p className="mt-1 font-mono text-xs text-rose-300">{edge.rule}</p>}
              <p className="mt-2 text-sm text-slate-300">{edge.explanation}</p>
            </article>
          );
        })}
      </div>

      <div className="min-h-24 border-t border-slate-700 bg-slate-800/50 p-4" aria-live="polite">
        {playback.index === 0 && <p>Start the analysis to reveal each wait-for dependency.</p>}
        {playback.index > 0 && !analysis.hasCycle && (
          <p>No dependency cycle is present. Delayed READY is not, by itself, an AXI protocol error.</p>
        )}
        {analysis.hasCycle && (
          <div className="flex gap-3 text-rose-200">
            <AlertTriangle className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="font-bold">DEADLOCK DETECTED</p>
              <p className="text-sm">Cycle: {analysis.cycle?.join(" → ")}</p>
              <p className="mt-1 text-sm">The violation is the master source dependency; the slave policy is legal but participates in the cycle.</p>
            </div>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-center gap-2 border-t border-slate-700 px-4 py-3">
        <button type="button" onClick={() => dispatch({ type: "RESET" })} aria-label="Reset simulation" title="Reset" className="rounded bg-slate-700 p-2"><RotateCcw size={16} /></button>
        <button type="button" onClick={() => dispatch({ type: "STEP_BACK" })} aria-label="Step Backward" title="Step Backward" disabled={playback.index === 0} className="rounded bg-slate-700 p-2 disabled:opacity-30"><SkipBack size={16} /></button>
        <button type="button" onClick={() => dispatch({ type: playback.status === "playing" ? "PAUSE" : "PLAY" })} aria-label={playback.status === "playing" ? "Pause simulation" : "Play simulation"} className="rounded bg-blue-600 p-2">{playback.status === "playing" ? <Pause size={18} /> : <Play size={18} />}</button>
        <button type="button" onClick={() => dispatch({ type: "STEP_FORWARD" })} aria-label="Step Forward" title="Step Forward" disabled={playback.index >= playback.lastIndex} className="rounded bg-slate-700 p-2 disabled:opacity-30"><SkipForward size={16} /></button>
        <span className="ml-2 font-mono text-xs text-slate-400">Step {playback.index}/{playback.lastIndex}</span>
      </footer>
    </section>
  );
}
