"use client";

import React, { useEffect, useId, useRef, useState } from "react";

import { focusRing, primaryAction, secondaryAction } from "@/components/curriculum/overview-ui";
import { downloadText } from "@/lib/download";
import {
  BACKUP_AREA_LABELS,
  BACKUP_AREAS,
  BACKUP_ERRORS,
  LEARNER_DATA_MAX_LABEL,
  exportLearnerData,
  fitsImportLimit,
  importLearnerData,
  learnerDataFileName,
  previewLearnerDataFile,
  resetLearnerData,
  serializeLearnerData,
  type BackupArea,
  type ImportMode,
  type LearnerDataImportReport,
  type LearnerDataImportResult,
  type LearnerDataPreview,
} from "@/lib/learner-store/backup";
import { useHydrated, useRecord } from "@/lib/learner-store/react";
import { writeOutcomeMessage } from "@/lib/learner-store/record";
import { markExported, metaRecord } from "@/lib/learner-store/repositories/meta";
import { cn } from "@/lib/utils";

/**
 * Back up, restore and delete the learning data kept in this browser.
 *
 * - "Download a backup (JSON)" saves sv-uvm-guide-learning-data-YYYY-MM-DD.json
 *   and records the date, which the dashboard's backup reminder reads.
 * - Import reads a chosen file (JSON, at most LEARNER_DATA_MAX_LABEL) and shows
 *   what it holds; nothing changes until "Replace my data" or "Merge with my data".
 * - "Delete all learning data in this browser" asks again inline before it
 *   deletes anything (no window.confirm). The theme choice is kept.
 *
 * Results, and "Reading the file…" while a file is read, are announced in
 * role=status regions; a file that cannot be used shows a visible error.
 * Backups are untrusted: their contents are validated by backup.ts and never
 * rendered, only counted. Dates are shown only when they are valid.
 */

type Tone = "success" | "error" | "info";

interface Message {
  tone: Tone;
  text: string;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });

/** The day `time` falls on, or null when it is missing or no Date can hold it (formatting it would throw). */
function formatDay(time: number | string | null | undefined): string | null {
  if (time === null || time === undefined) return null;
  const date = new Date(time);
  return Number.isFinite(date.getTime()) ? dateFormat.format(date) : null;
}

const READING_MESSAGE: Message = { tone: "info", text: "Reading the file…" };

const destructiveAction = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 ${focusRing}`;

const groupClass = "min-w-0 space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-5";
const headingClass = "text-base font-semibold text-foreground";
const bodyClass = "text-sm text-muted-foreground";
const actionsClass = "flex flex-col gap-3 sm:flex-row sm:flex-wrap";

const toneClass: Record<Tone, string> = {
  success: "text-foreground",
  info: "text-foreground",
  error: "font-medium text-red-800 dark:text-red-200",
};

const errorPanel =
  "rounded-2xl border border-red-700/50 bg-red-50 p-3 text-sm font-medium text-red-900 dark:border-red-300/50 dark:bg-red-950/40 dark:text-red-100";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** What a preview line says an area holds. */
function describeItems(area: BackupArea, items: number, entries: number): string {
  switch (area) {
    case "curriculum":
      return plural(items, "lesson marked done", "lessons marked done");
    case "lessons":
      return plural(items, "lesson", "lessons");
    case "route":
      return "included";
    case "labs":
      return plural(entries, "lab", "labs");
    case "flashcards":
      return plural(items, "card", "cards");
    case "notebook":
      return plural(entries, "entry", "entries");
    case "assessments":
      return plural(items, "result", "results");
    case "exercises":
      return plural(items, "exercise", "exercises");
    case "activity":
      return plural(items, "day", "days");
    case "recovered":
      return plural(entries, "copy", "copies");
    case "meta":
      return "";
  }
}

/** Areas a learner sees in a preview or a result; the bundle's own metadata is left out. */
const VISIBLE_AREAS: readonly BackupArea[] = BACKUP_AREAS.filter((area) => area !== "meta");

function importSummary(report: LearnerDataImportReport): string {
  const labelsWhere = (count: (area: BackupArea) => number) =>
    VISIBLE_AREAS.filter((area) => count(area) > 0).map((area) => BACKUP_AREA_LABELS[area]);
  const restored = labelsWhere((area) => report.areas[area].imported);
  const keptLocal = labelsWhere((area) => report.areas[area].keptLocal);
  const notUsed = VISIBLE_AREAS.reduce(
    (sum, area) => sum + report.areas[area].skipped + report.areas[area].invalid,
    0,
  );
  const parts: string[] = [
    report.mode === "replace"
      ? "Replaced the learning data in this browser with the backup."
      : "Merged the backup with the learning data in this browser.",
  ];
  parts.push(restored.length > 0 ? `Imported: ${restored.join(", ")}.` : "Nothing new was imported.");
  // A merge keeps this browser's own route and recovered copies: that is a choice, not a problem with the file.
  if (keptLocal.length > 0) parts.push(`Kept what this browser already had for: ${keptLocal.join(", ")}.`);
  if (notUsed > 0) {
    parts.push(
      `${plural(notUsed, "entry was", "entries were")} skipped because ${notUsed === 1 ? "it" : "they"} couldn't be read, came from a newer version of the site, or didn't fit.`,
    );
  }
  if (report.memoryOnly > 0) {
    const memoryNote = writeOutcomeMessage("memory-only");
    if (memoryNote) parts.push(memoryNote);
  }
  return parts.join(" ");
}

function StatusLine({ message, testId }: { message: Message | null; testId: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid={testId}
      className={cn("min-h-0 text-sm", message ? toneClass[message.tone] : undefined)}
    >
      {message?.text}
    </p>
  );
}

function PreviewPanel({
  preview,
  headingId,
  onImport,
  onCancel,
}: {
  preview: LearnerDataPreview;
  headingId: string;
  onImport: (mode: ImportMode) => void;
  onCancel: () => void;
}) {
  const listId = useId();
  const areas = VISIBLE_AREAS.filter((area) => preview.areas[area].entries > 0);
  const exportedAt = formatDay(preview.exportedAt);
  const empty = areas.length === 0;
  const notUsed = preview.invalidEntries + preview.newerEntries;

  return (
    <div className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-4" aria-labelledby={headingId} role="region">
      <h4 id={headingId} className="text-sm font-semibold text-foreground">
        {exportedAt ? `Backup from ${exportedAt}` : "Backup contents"}
      </h4>
      {empty ? (
        <p className="text-sm text-foreground">This backup holds no learning data, so there is nothing to import.</p>
      ) : (
        <>
          <p id={listId} className={bodyClass}>
            What the backup holds:
          </p>
          <ul aria-labelledby={listId} className="space-y-1 text-sm text-foreground">
            {areas.map((area) => (
              <li key={area} className="flex min-w-0 flex-wrap justify-between gap-x-3">
                <span>{BACKUP_AREA_LABELS[area]}</span>
                <span className="text-muted-foreground">{describeItems(area, preview.areas[area].items, preview.areas[area].entries)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {notUsed > 0 && (
        <p className="text-sm text-foreground">
          {plural(notUsed, "entry", "entries")} can&apos;t be used ({preview.invalidEntries} unreadable,{" "}
          {preview.newerEntries} from a newer version of the site) and will be skipped.
        </p>
      )}
      {!empty && (
        <p className={bodyClass}>
          Replace deletes the learning data in this browser first, then restores the backup. Merge keeps what is here
          and adds what the backup has.
        </p>
      )}
      <div className={actionsClass}>
        {!empty && (
          <>
            <button type="button" className={secondaryAction} onClick={() => onImport("replace")}>
              Replace my data
            </button>
            <button type="button" className={primaryAction} onClick={() => onImport("merge")}>
              Merge with my data
            </button>
          </>
        )}
        <button type="button" className={secondaryAction} onClick={onCancel}>
          {empty ? "Choose another file" : "Cancel import"}
        </button>
      </div>
    </div>
  );
}

export interface LearnerDataControlsProps {
  className?: string;
}

export function LearnerDataControls({ className }: LearnerDataControlsProps) {
  const hydrated = useHydrated();
  const meta = useRecord(metaRecord);

  const exportHeadingId = useId();
  const importHeadingId = useId();
  const previewHeadingId = useId();
  const resetHeadingId = useId();
  const fileInputId = useId();
  const fileErrorId = useId();
  const confirmPromptId = useId();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const readToken = useRef(0);

  const [exportMessage, setExportMessage] = useState<Message | null>(null);
  const [preview, setPreview] = useState<LearnerDataPreview | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [importMessage, setImportMessage] = useState<Message | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState<Message | null>(null);
  /** Set when the inline confirm closes, so focus returns to the delete button. */
  const returnFocusToDelete = useRef(false);

  useEffect(() => {
    if (confirmingReset) cancelDeleteRef.current?.focus();
    else if (returnFocusToDelete.current) deleteButtonRef.current?.focus();
    returnFocusToDelete.current = false;
  }, [confirmingReset]);

  const clearFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExport = () => {
    const now = Date.now();
    const bundle = exportLearnerData({ now, markExported: false });
    const fileName = learnerDataFileName(now);
    let started = false;
    let importable = true;
    try {
      const text = serializeLearnerData(bundle);
      importable = fitsImportLimit(text);
      started = downloadText(text, fileName, "application/json");
    } catch {
      started = false;
    }
    if (!started) {
      setExportMessage({ tone: "error", text: "This browser couldn't start the download. Try again, or try another browser." });
      return;
    }
    const outcomeNote = writeOutcomeMessage(markExported(now));
    const parts = [`Backup downloaded as ${fileName}.`];
    // The file still holds everything, but this site would refuse to import it: say so now, not at import time.
    if (!importable) {
      parts.push(
        `It is larger than ${LEARNER_DATA_MAX_LABEL}, so this site can't import it. Delete old notes or old lab versions, then download a new backup.`,
      );
    }
    if (outcomeNote) parts.push(`The backup date wasn't saved: ${outcomeNote}`);
    setExportMessage({ tone: importable ? "success" : "error", text: parts.join(" ") });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    const token = ++readToken.current;
    setPreview(null);
    setFileError(null);
    setImportMessage(null);
    if (!file) {
      setReading(false);
      return;
    }
    setReading(true);
    const result = await previewLearnerDataFile(file);
    if (token !== readToken.current) return;
    setReading(false);
    if (result.ok) setPreview(result);
    else setFileError(result.error);
  };

  const handleImport = (mode: ImportMode) => {
    if (!preview) return;
    let result: LearnerDataImportResult;
    try {
      result = importLearnerData(preview.bundle, mode);
    } catch (error) {
      console.error("[learner-data] Import failed", error);
      result = { ok: false, error: BACKUP_ERRORS.importFailed };
    }
    setPreview(null);
    clearFileInput();
    if (result.ok) {
      setImportMessage({ tone: result.memoryOnly > 0 ? "info" : "success", text: importSummary(result) });
    } else {
      setImportMessage({ tone: "error", text: result.error });
    }
    setResetMessage(null);
    // The preview and its buttons are gone: keep focus in the import group (the result is announced by its status line).
    fileInputRef.current?.focus();
  };

  const handleCancelPreview = () => {
    readToken.current += 1;
    setPreview(null);
    setFileError(null);
    setReading(false);
    clearFileInput();
    fileInputRef.current?.focus();
  };

  const handleConfirmReset = () => {
    resetLearnerData();
    returnFocusToDelete.current = true;
    setConfirmingReset(false);
    setPreview(null);
    clearFileInput();
    setImportMessage(null);
    setResetMessage({
      tone: "success",
      text: "Deleted all learning data in this browser. Your theme choice is kept.",
    });
  };

  const handleCancelReset = () => {
    returnFocusToDelete.current = true;
    setConfirmingReset(false);
  };

  const lastBackupDay = formatDay(meta.lastExportAt);
  const lastBackup = hydrated
    ? lastBackupDay
      ? `Last backup: ${lastBackupDay}.`
      : "No backup downloaded from this browser yet."
    : null;

  return (
    <div className={cn("grid min-w-0 grid-cols-1 gap-4", className)}>
      <div role="group" aria-labelledby={exportHeadingId} className={groupClass}>
        <h3 id={exportHeadingId} className={headingClass}>
          Back up
        </h3>
        <p className={bodyClass}>
          Download all of it as one file. Keep it somewhere safe: you can import it here or in another browser.
        </p>
        <div className={actionsClass}>
          <button type="button" className={primaryAction} onClick={handleExport}>
            Download a backup (JSON)
          </button>
        </div>
        {lastBackup && <p className="text-xs text-muted-foreground">{lastBackup}</p>}
        <StatusLine message={exportMessage} testId="learner-data-export-status" />
      </div>

      <div role="group" aria-labelledby={importHeadingId} className={groupClass}>
        <h3 id={importHeadingId} className={headingClass}>
          Restore from a backup
        </h3>
        <p className={bodyClass}>
          Choose a backup downloaded from this site. You will see what it holds before anything changes.
        </p>
        <div className="min-w-0">
          <label htmlFor={fileInputId} className="block text-sm font-medium text-foreground">
            Choose a backup file (JSON, at most {LEARNER_DATA_MAX_LABEL})
          </label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            aria-describedby={fileError ? fileErrorId : undefined}
            aria-invalid={fileError ? true : undefined}
            className={cn(
              "mt-2 block w-full min-w-0 max-w-full rounded-md text-sm text-foreground",
              "file:mr-3 file:min-h-[44px] file:cursor-pointer file:rounded-md file:border file:border-border file:bg-background file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:border-primary",
              focusRing,
            )}
          />
        </div>
        {fileError && (
          <p id={fileErrorId} role="alert" className={errorPanel}>
            {fileError}
          </p>
        )}
        {preview && (
          <PreviewPanel
            preview={preview}
            headingId={previewHeadingId}
            onImport={handleImport}
            onCancel={handleCancelPreview}
          />
        )}
        <StatusLine message={importMessage ?? (reading ? READING_MESSAGE : null)} testId="learner-data-import-status" />
      </div>

      <div role="group" aria-labelledby={resetHeadingId} className={groupClass}>
        <h3 id={resetHeadingId} className={headingClass}>
          Delete
        </h3>
        <p className={bodyClass}>
          Removes your lesson progress, reviews, notes, lab code and results from this browser. Your theme choice
          stays.
        </p>
        {confirmingReset ? (
          <div
            role="group"
            aria-labelledby={confirmPromptId}
            className="min-w-0 space-y-3 rounded-2xl border border-red-700/50 bg-red-50 p-4 dark:border-red-300/50 dark:bg-red-950/40"
          >
            <p id={confirmPromptId} className="text-sm font-medium text-red-900 dark:text-red-100">
              Delete all learning data in this browser? This can&apos;t be undone. Download a backup first if you
              might want it back.
            </p>
            <div className={actionsClass}>
              <button type="button" className={destructiveAction} onClick={handleConfirmReset}>
                Yes, delete everything
              </button>
              <button ref={cancelDeleteRef} type="button" className={secondaryAction} onClick={handleCancelReset}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={actionsClass}>
            <button
              ref={deleteButtonRef}
              type="button"
              className={secondaryAction}
              onClick={() => {
                setResetMessage(null);
                setConfirmingReset(true);
              }}
            >
              Delete all learning data in this browser
            </button>
          </div>
        )}
        <StatusLine message={resetMessage} testId="learner-data-reset-status" />
      </div>
    </div>
  );
}

export default LearnerDataControls;
