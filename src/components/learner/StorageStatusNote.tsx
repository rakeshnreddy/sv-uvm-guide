"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

import { LEARNER_DATA_CHANGED_EVENT } from "@/lib/learner-store/keys";
import { useStorageStatus } from "@/lib/learner-store/react";
import { subscribeLearnerStore } from "@/lib/learner-store/record";
import { estimateBytes, type StorageStatus } from "@/lib/learner-store/storage";
import { cn } from "@/lib/utils";

/** Estimated learner data (2 bytes per character) from which the note warns that storage is nearly full. */
export const STORAGE_WARNING_BYTES = 3 * 1024 * 1024;

const DEFAULT_SAVED_LABEL = "Saved in this browser";
/** How long to wait after a write before measuring usage again. */
const REMEASURE_DELAY_MS = 1500;

const linkClass =
  "rounded-sm font-semibold text-current underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export interface StorageStatusNoteProps {
  /** Shown while storage works. Defaults to "Saved in this browser". */
  savedLabel?: string;
  className?: string;
}

/** Measures usage after mount, after learner data changes (debounced), and after an import or reset. */
function useNearlyFull(status: StorageStatus): boolean {
  const [nearlyFull, setNearlyFull] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => setNearlyFull(estimateBytes() > STORAGE_WARNING_BYTES);
    const scheduleMeasure = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(measure, REMEASURE_DELAY_MS);
    };
    measure();
    const unsubscribe = subscribeLearnerStore(scheduleMeasure);
    window.addEventListener(LEARNER_DATA_CHANGED_EVENT, measure);
    return () => {
      unsubscribe();
      window.removeEventListener(LEARNER_DATA_CHANGED_EVENT, measure);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [status]);

  return nearlyFull;
}

/**
 * Says where learner data lives, and warns when this browser is not saving it
 * (storage blocked or full) or is close to its storage limit. The server render
 * and the hydrating render always show the saved label.
 */
export function StorageStatusNote({ savedLabel = DEFAULT_SAVED_LABEL, className }: StorageStatusNoteProps) {
  const status = useStorageStatus();
  const nearlyFull = useNearlyFull(status);
  const blocked = status !== "available";
  const warning = blocked || nearlyFull;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "text-xs text-muted-foreground",
        warning && "font-medium text-amber-800 dark:text-amber-200",
        className,
      )}
    >
      {blocked ? (
        <>
          This browser isn't saving your progress (storage is blocked or full).{" "}
          <Link href="/settings#data" className={linkClass}>
            Download a backup
          </Link>{" "}
          to keep it.
        </>
      ) : nearlyFull ? (
        <>
          Browser storage is nearly full.{" "}
          <Link href="/settings#data" className={linkClass}>
            Download a backup
          </Link>
          , then delete old notes or old lab versions.
        </>
      ) : (
        savedLabel
      )}
    </p>
  );
}

export default StorageStatusNote;
