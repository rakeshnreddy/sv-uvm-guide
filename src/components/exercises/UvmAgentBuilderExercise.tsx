"use client";

import React, { useEffect, useMemo, useState } from "react";

import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { useExerciseProgress } from "@/hooks/useExerciseProgress";
import {
  AGENT_PALETTE,
  agentClassSource,
  gradeAgentMembership,
  type ActiveMode,
  type AgentGrade,
  type AgentPaletteId,
} from "@/lib/uvm-agent-model";
import { cn } from "@/lib/utils";

export interface Item {
  id: string;
  name: string;
}

/** Components every ACTIVE agent needs. A passive agent needs only the monitor. */
export const REQUIRED_COMPONENTS: Item[] = AGENT_PALETTE.filter((p) => ["sequencer", "driver", "monitor"].includes(p.id)).map(({ id, name }) => ({ id, name }));

/**
 * Grades membership against the active/passive rule (uvm-agent-model). The order of the
 * items is ignored: UVM imposes no order on an agent's children.
 */
export function checkAgentComponents(agentComponents: Item[], mode: ActiveMode = "UVM_ACTIVE") {
  const grade = gradeAgentMembership(
    agentComponents.map((c) => c.id),
    mode,
  );
  const warnings: string[] = [];
  if (grade.missing.length > 0) warnings.push(`Missing components: ${grade.missing.join(", ")}`);
  if (grade.misplaced.length > 0) warnings.push(`Does not belong in this agent: ${grade.misplaced.join(", ")}`);
  return { warnings, score: grade.score, grade };
}

const instructionId = "uvm-agent-builder-instructions";
const DRAG_TYPE = "text/x-uvm-agent-item";

interface FeedbackState {
  score: number;
  passed: boolean;
  warnings: string[];
  grade: AgentGrade;
}

const UvmAgentBuilderExercise: React.FC = () => {
  const initialComponents = useMemo<Item[]>(() => AGENT_PALETTE.map(({ id, name }) => ({ id, name })), []);
  const [mode, setMode] = useState<ActiveMode>("UVM_ACTIVE");
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const { progress: savedProgress, recordAttempt, resetProgress, logInteraction, analytics } = useExerciseProgress("uvm-agent-builder");

  const agentComponents = initialComponents.filter((c) => agentIds.includes(c.id));
  const availableComponents = initialComponents.filter((c) => !agentIds.includes(c.id));

  useEffect(() => {
    // Deterministic hooks for Playwright so suites do not depend on drag gestures.
    if (typeof window === "undefined") return;
    const testApi = {
      setAgentComponents: (ids: string[]) => {
        setAgentIds(initialComponents.filter((item) => ids.includes(item.id)).map((i) => i.id));
        setFeedback(null);
      },
      reset: () => {
        setAgentIds([]);
        setFeedback(null);
      },
    };
    const win = window as typeof window & { __uvmAgentBuilderTest?: typeof testApi };
    win.__uvmAgentBuilderTest = testApi;
    return () => {
      if (win.__uvmAgentBuilderTest === testApi) delete win.__uvmAgentBuilderTest;
    };
  }, [initialComponents]);

  const place = (id: string, inAgent: boolean) => {
    logInteraction();
    setFeedback(null);
    setAgentIds((ids) => (inAgent ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id)));
  };

  const checkAgent = () => {
    logInteraction();
    const { warnings, score, grade } = checkAgentComponents(agentComponents, mode);
    recordAttempt(score);
    setFeedback({ score, passed: grade.passed, warnings, grade });
  };

  const handleRetry = () => {
    setAgentIds([]);
    setFeedback(null);
    logInteraction();
  };

  const dropZone = (inAgent: boolean) => ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault();
    },
    onDrop: (e: React.DragEvent) => {
      const id = e.dataTransfer.getData(DRAG_TYPE);
      if (id) {
        e.preventDefault();
        place(id, inAgent);
      }
    },
  });

  const renderItem = (item: Item, inAgent: boolean) => {
    const palette = AGENT_PALETTE.find((p) => p.id === (item.id as AgentPaletteId));
    return (
      <div
        key={item.id}
        role="listitem"
        draggable
        onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, item.id)}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-foreground">{item.name}</span>
          <span className="block truncate font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{palette?.cls}</span>
        </span>
        <button
          type="button"
          onClick={() => place(item.id, !inAgent)}
          aria-label={inAgent ? `Remove ${item.name} from the agent` : `Add ${item.name} to the agent`}
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-border/70 px-2 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {inAgent ? "← Remove" : "Add →"}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
        <div>
          <p className="font-semibold text-foreground">Best score: {savedProgress.bestScore}%</p>
          <p>
            Attempts: {savedProgress.attempts}
            {savedProgress.lastPlayedLabel ? ` • Last played ${savedProgress.lastPlayedLabel}` : ""}
          </p>
          {savedProgress.attempts > 0 && (
            <p className="text-xs">
              Average score: {Math.round(analytics.competency)}% • Interactions: {analytics.engagement}
            </p>
          )}
        </div>
        {savedProgress.attempts > 0 && (
          <Button variant="ghost" size="sm" onClick={resetProgress} className="text-xs">
            Clear saved progress
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <p id={instructionId} className="text-sm text-muted-foreground">
          Choose the agent you are building, then put exactly the components that belong inside it into the agent. Use the Add and Remove buttons, or drag items between the
          lists. Order does not matter: UVM imposes no order on an agent&apos;s children.
        </p>
        <SegmentedControl
          label="Target agent mode"
          mono
          value={mode}
          onChange={(m) => {
            setMode(m);
            setFeedback(null);
          }}
          options={[
            { value: "UVM_ACTIVE", label: "UVM_ACTIVE agent" },
            { value: "UVM_PASSIVE", label: "UVM_PASSIVE agent" },
          ]}
        />
      </div>

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <section aria-label="Available UVM components" className="rounded-lg border border-border/70 bg-card/40 p-4" data-testid="agent-palette">
          <h3 className="mb-3 text-base font-semibold text-foreground">Available components</h3>
          <div id="available-droppable" role="list" aria-describedby={instructionId} className="min-h-[120px] space-y-2 rounded-md border-2 border-dashed border-border/60 p-2" {...dropZone(false)}>
            {availableComponents.map((item) => renderItem(item, false))}
            {availableComponents.length === 0 && <p className="py-4 text-center text-muted-foreground">All components used.</p>}
          </div>
        </section>

        <section aria-label={`UVM agent (${mode})`} className="rounded-lg border-2 border-cyan-500/50 bg-cyan-500/[0.04] p-4">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            bus_agent <span className="font-mono text-xs text-muted-foreground">is_active = {mode}</span>
          </h3>
          <div id="agent-droppable" role="list" aria-describedby={instructionId} className="min-h-[120px] space-y-2 rounded-md border border-dashed border-cyan-500/50 p-2" {...dropZone(true)}>
            {agentComponents.map((item) => renderItem(item, true))}
            {agentComponents.length === 0 && <p className="py-4 text-center text-muted-foreground">Nothing inside the agent yet.</p>}
          </div>
        </section>
      </div>

      <div className="flex justify-center gap-2">
        <Button onClick={checkAgent}>Check Agent</Button>
        <Button variant="outline" onClick={handleRetry}>
          Retry
        </Button>
      </div>

      {feedback && (
        <div
          className={cn(
            "space-y-3 rounded-lg border p-4 text-sm",
            feedback.passed ? "border-emerald-500/50 bg-emerald-500/5" : "border-amber-500/50 bg-amber-500/5",
          )}
          role="status"
          aria-live="polite"
          data-testid="exercise-feedback"
        >
          <p className={cn("text-lg font-semibold", feedback.passed ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-200")}>
            Score: {feedback.score}%
          </p>
          <p className="text-foreground">
            {feedback.passed
              ? mode === "UVM_ACTIVE"
                ? "Correct: an active agent builds a sequencer, a driver and a monitor; everything else is optional or belongs in the env."
                : "Correct: a passive agent builds only its monitor (plus optional helpers). Nothing in it can drive the bus."
              : `Keep iterating. ${feedback.warnings.join(". ")}.`}
          </p>
          <ul className="space-y-1" aria-label="Per-component feedback">
            {feedback.grade.verdicts.map((v) => (
              <li key={v.id} className={v.correct ? "text-muted-foreground" : "text-rose-700 dark:text-rose-300"}>
                <span aria-hidden>{v.correct ? "✓" : "✕"} </span>
                <strong className="text-foreground">{v.name}</strong> ({v.placedInAgent ? "in agent" : "left out"}, {v.expectation}): {v.reason}
              </li>
            ))}
          </ul>
          {feedback.passed ? (
            <details className="rounded-lg border border-border/70 bg-background/50 p-2">
              <summary className="cursor-pointer font-medium text-foreground">How bus_agent builds this with get_is_active()</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]">
                {agentClassSource({ name: "agt", configured: mode, callsSuperBuild: true, guardsConnect: true })
                  .map((l) => l.text)
                  .join("\n")}
              </pre>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default UvmAgentBuilderExercise;
