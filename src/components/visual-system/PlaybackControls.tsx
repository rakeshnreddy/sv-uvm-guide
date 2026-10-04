"use client";

import React from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";

import { cn } from "@/lib/utils";

import { PLAYBACK_SPEEDS, type PlaybackApi, type PlaybackSpeed } from "./usePlayback";

interface PlaybackControlsProps {
  playback: PlaybackApi;
  stepCount: number;
  /** Accessible name for the scrubber, e.g. "Scheduler step". */
  stepNoun?: string;
  /** Short label for each step, used in the scrubber's value text. */
  describeStep?: (index: number) => string;
  className?: string;
}

const buttonClass =
  "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background/60 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Standard transport for every stepped visual. Keyboard: ←/→ step,
 * Space toggles play, Home resets — active while focus is inside the group.
 */
export function PlaybackControls({ playback, stepCount, stepNoun = "Step", describeStep, className }: PlaybackControlsProps) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isRange = target instanceof HTMLInputElement && target.type === "range";
    if (target instanceof HTMLSelectElement) return;
    if (event.key === "ArrowRight" && !isRange) {
      event.preventDefault();
      playback.stepForward();
    } else if (event.key === "ArrowLeft" && !isRange) {
      event.preventDefault();
      playback.stepBack();
    } else if (event.key === "Home") {
      event.preventDefault();
      playback.reset();
    } else if (event.key === " " && target.tagName !== "BUTTON") {
      event.preventDefault();
      playback.toggle();
    }
  };

  return (
    <div
      role="group"
      aria-label={`${stepNoun} playback controls`}
      onKeyDown={onKeyDown}
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} onClick={playback.reset} disabled={playback.isFirst && !playback.isPlaying} aria-label="Reset to the initial state">
          <RotateCcw className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={buttonClass} onClick={playback.stepBack} disabled={playback.isFirst} aria-label={`Previous ${stepNoun.toLowerCase()}`}>
          <SkipBack className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className={cn(buttonClass, "min-w-[5.5rem] border-cyan-500/50 bg-cyan-500/10")}
          onClick={playback.toggle}
          disabled={playback.isLast && !playback.isPlaying}
          aria-label={playback.isPlaying ? "Pause" : "Play"}
        >
          {playback.isPlaying ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          <span>{playback.isPlaying ? "Pause" : "Play"}</span>
        </button>
        <button type="button" className={buttonClass} onClick={playback.stepForward} disabled={playback.isLast} aria-label={`Next ${stepNoun.toLowerCase()}`}>
          <SkipForward className="h-4 w-4" aria-hidden />
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Speed
          <select
            className="h-9 rounded-md border border-border/70 bg-background/60 px-2 text-sm text-foreground"
            value={playback.speed}
            onChange={(e) => playback.setSpeed(Number(e.target.value) as PlaybackSpeed)}
          >
            {PLAYBACK_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={Math.max(0, stepCount - 1)}
          value={playback.index}
          onChange={(e) => playback.seek(Number(e.target.value))}
          aria-label={`${stepNoun} scrubber`}
          aria-valuetext={`${stepNoun} ${playback.index + 1} of ${stepCount}${describeStep ? `: ${describeStep(playback.index)}` : ""}`}
          className="h-2 w-full cursor-pointer accent-cyan-500"
        />
        <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>
          {playback.index + 1}/{stepCount}
        </span>
      </div>
    </div>
  );
}
