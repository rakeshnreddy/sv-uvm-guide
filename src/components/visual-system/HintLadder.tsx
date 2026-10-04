"use client";

import React, { useState } from "react";

import { cn } from "@/lib/utils";

interface HintLadderProps {
  hints: React.ReactNode[];
  /** Reset revealed hints when this key changes. */
  resetKey?: string;
  className?: string;
}

/** Progressive hints: each click reveals one more, so support fades as competence grows. */
export function HintLadder({ hints, resetKey, className }: HintLadderProps) {
  const [shown, setShown] = useState(0);
  const [lastKey, setLastKey] = useState(resetKey);
  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    setShown(0);
  }
  return (
    <div className={cn("text-sm", className)}>
      {shown < hints.length ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + 1)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {shown === 0 ? "Need a hint?" : "Another hint"} ({shown}/{hints.length})
        </button>
      ) : null}
      {shown > 0 ? (
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground" aria-live="polite">
          {hints.slice(0, shown).map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
