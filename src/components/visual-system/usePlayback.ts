"use client";

import { useCallback, useEffect, useReducer, useState } from "react";

import { createPlaybackState, playbackReducer, type PlaybackState } from "@/lib/playback-machine";

export const PLAYBACK_SPEEDS = [0.5, 1, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

const BASE_INTERVAL_MS = 1400;

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export interface PlaybackApi {
  state: PlaybackState;
  index: number;
  isPlaying: boolean;
  isFirst: boolean;
  isLast: boolean;
  speed: PlaybackSpeed;
  setSpeed: (speed: PlaybackSpeed) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  stepForward: () => void;
  stepBack: () => void;
  seek: (index: number) => void;
}

/**
 * Learner-controlled playback over a precomputed list of states. Because each
 * step is a full snapshot, stepping backwards restores the exact prior state
 * and reset reproduces the initial scenario.
 */
export function usePlayback(stepCount: number, resetKey: unknown = stepCount): PlaybackApi {
  const [state, dispatch] = useReducer(playbackReducer, stepCount, createPlaybackState);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  useEffect(() => {
    dispatch({ type: "SET_LENGTH", itemCount: stepCount });
  }, [stepCount, resetKey]);

  useEffect(() => {
    if (state.status !== "playing") return;
    const timer = window.setTimeout(() => dispatch({ type: "TICK" }), BASE_INTERVAL_MS / speed);
    return () => window.clearTimeout(timer);
  }, [state.status, state.index, speed]);

  const seek = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(target, Math.max(0, stepCount - 1)));
      dispatch({ type: "RESET" });
      for (let i = 0; i < clamped; i += 1) dispatch({ type: "STEP_FORWARD" });
    },
    [stepCount],
  );

  return {
    state,
    index: state.index,
    isPlaying: state.status === "playing",
    isFirst: state.index === 0,
    isLast: state.index >= state.lastIndex,
    speed,
    setSpeed,
    play: () => dispatch({ type: "PLAY" }),
    pause: () => dispatch({ type: "PAUSE" }),
    toggle: () => dispatch({ type: state.status === "playing" ? "PAUSE" : "PLAY" }),
    reset: () => dispatch({ type: "RESET" }),
    stepForward: () => dispatch({ type: "STEP_FORWARD" }),
    stepBack: () => dispatch({ type: "STEP_BACK" }),
    seek,
  };
}
