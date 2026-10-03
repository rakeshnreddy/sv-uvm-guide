"use client";

import React, { useId, useState } from "react";

import { cn } from "@/lib/utils";

export interface PredictionOption {
  id: string;
  label: React.ReactNode;
  correct: boolean;
  /** Diagnoses the misconception behind this choice. */
  feedback: string;
}

interface PredictionPromptProps {
  question: React.ReactNode;
  options: PredictionOption[];
  /** Content revealed only after the learner commits (or explicitly skips). */
  children?: React.ReactNode | ((state: { committed: string | null }) => React.ReactNode);
  /** Reset the prompt whenever this key changes (e.g. a new scenario). */
  resetKey?: string;
  onCommit?: (optionId: string, correct: boolean) => void;
  className?: string;
}

/** Predict-then-reveal gate. Feedback explains why each answer is right or wrong. */
export function PredictionPrompt({ question, options, children, resetKey, onCommit, className }: PredictionPromptProps) {
  const groupId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [lastKey, setLastKey] = useState(resetKey);

  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    setSelected(null);
    setCommitted(null);
    setSkipped(false);
  }

  const revealed = committed !== null || skipped;
  const chosen = options.find((o) => o.id === committed);
  const correctOption = options.find((o) => o.correct);

  return (
    <div className={cn("rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-4", className)}>
      <fieldset disabled={revealed}>
        <legend className="mb-3 text-sm font-semibold text-foreground">
          <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
            Predict
          </span>
          {question}
        </legend>
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {options.map((option) => {
            const isChosen = committed === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-background/50 p-3 text-sm transition-colors",
                  selected === option.id && !revealed && "border-amber-500/70 bg-amber-500/10",
                  revealed && option.correct && "border-emerald-500/70 bg-emerald-500/10",
                  revealed && isChosen && !option.correct && "border-rose-500/70 bg-rose-500/10",
                  revealed && "cursor-default",
                )}
              >
                <input
                  type="radio"
                  name={groupId}
                  value={option.id}
                  checked={selected === option.id}
                  onChange={() => setSelected(option.id)}
                  className="mt-1 accent-amber-500"
                />
                <span className="flex-1">{option.label}</span>
                {revealed && option.correct ? <span aria-label="correct answer">✓</span> : null}
                {revealed && isChosen && !option.correct ? <span aria-label="your answer, incorrect">✕</span> : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      {!revealed ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              setCommitted(selected);
              const option = options.find((o) => o.id === selected);
              onCommit?.(selected, Boolean(option?.correct));
            }}
            className="inline-flex h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lock in prediction
          </button>
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reveal without predicting
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm" aria-live="polite">
          {chosen ? (
            <p className={chosen.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
              <strong>{chosen.correct ? "Correct. " : "Not quite. "}</strong>
              {chosen.feedback}
            </p>
          ) : null}
          {correctOption && (!chosen || !chosen.correct) ? (
            <p className="text-muted-foreground">
              <strong className="text-foreground">Why the answer holds: </strong>
              {correctOption.feedback}
            </p>
          ) : null}
        </div>
      )}
      {revealed ? <div className="mt-4">{typeof children === "function" ? children({ committed }) : children}</div> : null}
    </div>
  );
}
