"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { emptyLabProgress, isStepUnlocked } from "@/lib/lab-progress-policy";
import {
  createAccountLabProgressStore,
  createBrowserLabProgressStore,
  type LabActionResult,
  type LabCheckResult,
  type LabOlderVersion,
  type LabProgressSnapshot,
  type LabProgressStore,
  type LabSaveOutcome,
} from "@/lib/lab-progress-store";
import { usePersistenceTarget } from "@/lib/persistence/target";
import type { LabPolicyInput, LabProgressState } from "@/types/lab";

/** Autosave waits this long after the last edit. */
export const LAB_AUTOSAVE_DELAY_MS = 600;

export interface LabWorkspaceActions {
  /** A learner edit of an editable file: marks the workspace dirty and schedules an autosave. */
  editBuffer(path: string, content: string): void;
  /** Opens an unlocked step and schedules saving it as the current step. */
  selectStep(stepId: string): void;
  completeSelfAttestedStep(stepId: string): Promise<LabActionResult>;
  /** Checks the step against the current editable buffers. */
  checkGradedStep(stepId: string): Promise<LabCheckResult>;
  /** Clears this lab version's progress and puts the starter files back. */
  reset(): Promise<LabSaveOutcome>;
  removeOlderVersion(version: string): void;
  /** Saves pending edits now instead of after the debounce. */
  flush(): Promise<void>;
}

export interface LabWorkspace {
  /** False until the saved progress has been restored; actions and autosave wait for it. */
  loaded: boolean;
  /** 'local' (this browser) or 'server' (the learner's account). */
  mode: "local" | "server";
  progress: LabProgressState;
  /** Every editable file: the starter contents, overlaid with saved and edited contents. */
  buffers: Record<string, string>;
  /** The latest save outcome; anything but 'saved' is shown to the learner. */
  outcome: LabSaveOutcome | null;
  /** Why progress could not be loaded (account store only). */
  loadError: string | null;
  olderVersions: LabOlderVersion[];
  /** True while this tab holds edits that are not saved yet. */
  dirty: boolean;
  storeActions: LabWorkspaceActions;
}

export interface UseLabWorkspaceOptions {
  policy: LabPolicyInput;
  /** The starter contents of the editable files, from the page props. */
  starterBuffers: Readonly<Record<string, string>>;
}

/** An order-independent fingerprint of a set of buffers. */
function buffersKey(buffers: Readonly<Record<string, string>>): string {
  return JSON.stringify(Object.keys(buffers).sort().map((path) => [path, buffers[path]]));
}

/**
 * The lab page's workspace: restores saved progress after mount, autosaves
 * only after a learner edit (600 ms debounce), and follows changes another tab
 * makes. Restoring never writes. Another tab's completed steps, status and
 * current step are applied as they arrive; its file buffers only while this
 * tab has no unsaved edits.
 */
export function useLabWorkspace({ policy, starterBuffers }: UseLabWorkspaceOptions): LabWorkspace {
  const { target, ready } = usePersistenceTarget();
  const mode = target === "server" ? "server" : "local";
  const store = useMemo<LabProgressStore>(
    () => (mode === "server" ? createAccountLabProgressStore(policy) : createBrowserLabProgressStore(policy)),
    [mode, policy],
  );

  const [loaded, setLoaded] = useState(false);
  const [progress, setProgressState] = useState<LabProgressState>(() => emptyLabProgress(policy));
  const [buffers, setBuffers] = useState<Record<string, string>>(() => ({ ...starterBuffers }));
  const [outcome, setOutcome] = useState<LabSaveOutcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [olderVersions, setOlderVersions] = useState<LabOlderVersion[]>([]);
  const [dirty, setDirtyState] = useState(false);

  const storeRef = useRef(store);
  const progressRef = useRef(progress);
  const loadedRef = useRef(false);
  const buffersRef = useRef(buffers);
  const stepRef = useRef<string | null>(progress.currentStepId);
  const dirtyRef = useRef(false);
  const editSeqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What this tab last saw in (or wrote to) the store, to tell another tab's changes apart. */
  const lastStoredRef = useRef<{ currentStepId: string | null; buffersKey: string } | null>(null);

  const setDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    setDirtyState(value);
  }, []);

  const applyBuffers = useCallback((next: Record<string, string>) => {
    buffersRef.current = next;
    setBuffers(next);
  }, []);

  /** Sets the progress state and its ref together; the current step ref follows it. */
  const setProgress = useCallback((next: LabProgressState) => {
    progressRef.current = next;
    stepRef.current = next.currentStepId;
    setProgressState(next);
  }, []);

  const applySnapshot = useCallback((snapshot: LabProgressSnapshot, initial: boolean) => {
    const stored = snapshot.progress;
    const storedKey = buffersKey(stored.fileBuffers);
    const last = lastStoredRef.current;
    const stepChanged = initial || !last || last.currentStepId !== stored.currentStepId;
    const buffersChanged = initial || !last || last.buffersKey !== storedKey;

    setProgress({ ...stored, currentStepId: stepChanged ? stored.currentStepId : stepRef.current });
    // Unsaved edits in this tab always win over what is stored.
    if (buffersChanged && !dirtyRef.current) {
      applyBuffers({ ...starterBuffers, ...stored.fileBuffers });
    }
    lastStoredRef.current = { currentStepId: stored.currentStepId, buffersKey: storedKey };
    setOlderVersions(snapshot.olderVersions);
  }, [applyBuffers, setProgress, starterBuffers]);

  const flush = useCallback(async () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!loadedRef.current || !dirtyRef.current) return;
    const seq = editSeqRef.current;
    const saving = buffersRef.current;
    const stepId = stepRef.current;
    const result = await storeRef.current.saveWorkspace(saving, stepId);
    setOutcome(result);
    if ((result === "saved" || result === "memory-only") && editSeqRef.current === seq) {
      lastStoredRef.current = { currentStepId: stepId, buffersKey: buffersKey(saving) };
      setDirty(false);
    }
  }, [setDirty]);

  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const scheduleSave = useCallback(() => {
    if (!loadedRef.current) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, LAB_AUTOSAVE_DELAY_MS);
  }, []);

  // Restore after mount (never during render), then follow changes from this tab and others.
  useEffect(() => {
    storeRef.current = store;
    if (!ready) return undefined;
    let cancelled = false;
    loadedRef.current = false;
    setLoaded(false);
    store.load()
      .then((snapshot) => {
        if (cancelled) return;
        applySnapshot(snapshot, true);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "LAB_PROGRESS_UNAVAILABLE");
      })
      .finally(() => {
        if (cancelled) return;
        loadedRef.current = true;
        setLoaded(true);
      });
    const unsubscribe = store.subscribe(() => {
      if (!loadedRef.current) return;
      void store.load()
        .then((snapshot) => {
          if (!cancelled) applySnapshot(snapshot, false);
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applySnapshot, ready, store]);

  // Save pending edits when the page is hidden or the workspace unmounts.
  useEffect(() => {
    const onHide = () => {
      void flushRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      onHide();
    };
  }, []);

  const applyActionProgress = useCallback((next: LabProgressState) => {
    setProgress({ ...next, fileBuffers: progressRef.current.fileBuffers });
    lastStoredRef.current = lastStoredRef.current
      ? { ...lastStoredRef.current, currentStepId: next.currentStepId }
      : { currentStepId: next.currentStepId, buffersKey: buffersKey(next.fileBuffers) };
  }, [setProgress]);

  const editBuffer = useCallback((path: string, content: string) => {
    if (!loadedRef.current || !policy.editablePaths.includes(path)) return;
    if (buffersRef.current[path] === content) return;
    applyBuffers({ ...buffersRef.current, [path]: content });
    editSeqRef.current += 1;
    setDirty(true);
    scheduleSave();
  }, [applyBuffers, policy.editablePaths, scheduleSave, setDirty]);

  const selectStep = useCallback((stepId: string) => {
    if (!loadedRef.current || stepRef.current === stepId) return;
    if (!isStepUnlocked(policy, progressRef.current.completedSteps, stepId)) return;
    setProgress({ ...progressRef.current, currentStepId: stepId });
    editSeqRef.current += 1;
    setDirty(true);
    scheduleSave();
  }, [policy, scheduleSave, setDirty, setProgress]);

  const completeSelfAttestedStep = useCallback(async (stepId: string): Promise<LabActionResult> => {
    await flushRef.current();
    const result = await storeRef.current.completeSelfAttestedStep(stepId);
    if (result.ok) applyActionProgress(result.progress);
    // A 'saved' completion says nothing about the workspace, so it leaves an earlier warning in place.
    if (result.outcome && result.outcome !== "saved") setOutcome(result.outcome);
    return result;
  }, [applyActionProgress]);

  const checkGradedStep = useCallback(async (stepId: string): Promise<LabCheckResult> => {
    await flushRef.current();
    const current = buffersRef.current;
    const files = policy.editablePaths
      .filter((path) => Object.prototype.hasOwnProperty.call(current, path))
      .map((path) => ({ path, content: current[path] }));
    const result = await storeRef.current.checkGradedStep(stepId, files);
    if (result.ok && result.progress) applyActionProgress(result.progress);
    if (result.outcome && result.outcome !== "saved") setOutcome(result.outcome);
    return result;
  }, [applyActionProgress, policy.editablePaths]);

  const reset = useCallback(async (): Promise<LabSaveOutcome> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    editSeqRef.current += 1;
    setDirty(false);
    const result = await storeRef.current.reset();
    const empty = emptyLabProgress(policy);
    lastStoredRef.current = { currentStepId: empty.currentStepId, buffersKey: buffersKey({}) };
    setProgress(empty);
    applyBuffers({ ...starterBuffers });
    setOutcome(result);
    setOlderVersions(storeRef.current.olderVersions());
    return result;
  }, [applyBuffers, policy, setDirty, setProgress, starterBuffers]);

  const removeOlderVersion = useCallback((version: string) => {
    storeRef.current.removeOlderVersion(version);
    setOlderVersions(storeRef.current.olderVersions());
  }, []);

  const storeActions = useMemo<LabWorkspaceActions>(() => ({
    editBuffer,
    selectStep,
    completeSelfAttestedStep,
    checkGradedStep,
    reset,
    removeOlderVersion,
    flush,
  }), [checkGradedStep, completeSelfAttestedStep, editBuffer, flush, removeOlderVersion, reset, selectStep]);

  return { loaded, mode, progress, buffers, outcome, loadError, olderVersions, dirty, storeActions };
}
