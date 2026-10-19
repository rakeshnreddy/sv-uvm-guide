"use client";

import { Check, Download, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { StorageStatusNote } from "@/components/learner/StorageStatusNote";
import type { GraderDiagnostic } from "@/lib/lab-graders";
import { graderRegistry } from "@/lib/lab-graders";
import { canRevealSolutions, graderNeedsSandbox, isStepUnlocked } from "@/lib/lab-progress-policy";
import { labSaveOutcomeMessage, type LabOlderVersion } from "@/lib/lab-progress-store";
import { SITE_MONACO_THEME, defineSiteMonacoThemes } from '@/lib/monaco-themes';
import { useServerFeature } from "@/lib/persistence/target";
import type { LabBackLink as LabBackLinkData, LabPrerequisites, LessonLink } from "@/lib/practice-links";
import { cn } from "@/lib/utils";
import type { LabFileDto, LabPolicyInput, LearnerLabDto } from "@/types/lab";

import { LabBackLink, LabLessonContext } from "./LabNavigation";
import { LabRunLocally, downloadLabWorkspace, labActionButtonClass, labWorkspaceZipName } from "./LabRunLocally";
import { useLabWorkspace } from "./useLabWorkspace";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center">Loading editor…</div>,
});
const CodeExecutionEnvironment = dynamic(
  () => import("@/components/ui/CodeExecutionEnvironment").then((module) => module.CodeExecutionEnvironment),
  { ssr: false },
);

type LabClientPageProps = {
  lab: LearnerLabDto;
  /** From toLabPolicyInput(): step ids, versions and kinds, the grader and the editable paths. */
  policy: LabPolicyInput;
  /** Guide, starter and reference files with their contents, read at build time. */
  files: LabFileDto[];
  /** Solution files, listed under "Lab files" once the lab is complete in this browser. */
  solutions: LabFileDto[];
  /** From getLabBackLink(): the lesson that launches this lab (never a bare /curriculum fallback). */
  backLink: LabBackLinkData;
  /** From getLabLessons(): the launching lesson first, then related lessons. */
  lessons: LessonLink[];
  /** From getLabPrerequisites(): prerequisite lessons and labs, and "do this lab after" for forward dependencies. */
  prerequisites: Pick<LabPrerequisites, "items" | "doAfter">;
};

const roleLabel: Record<LabFileDto["role"], string> = {
  guide: "Guide",
  starter: "Starter",
  solution: "Solution",
  reference: "Reference",
};

const languageLabel: Record<string, string> = {
  c: "C",
  markdown: "Markdown",
  pss: "PSS",
  systemverilog: "SystemVerilog",
};

export const STRUCTURAL_CHECK_NOTE = "Structural check in your browser: it does not compile or simulate.";
export const SANDBOX_NOTE = "This check needs the simulator service";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const primaryButtonClass = cn(
  "mb-4 rounded bg-primary px-4 py-2 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60",
  focusRing,
);
const dangerButtonClass = cn(
  "inline-flex min-h-11 items-center justify-center rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90",
  focusRing,
);

function formatSavedDate(epochMs: number): string | null {
  if (!epochMs) return null;
  const date = new Date(epochMs);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

interface InlineConfirmProps {
  prompt: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The second step of a destructive action: a visible prompt with confirm and cancel. Focus starts on Cancel. */
function InlineConfirm({ prompt, confirmLabel, onConfirm, onCancel }: InlineConfirmProps) {
  const promptId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <div
      role="group"
      aria-labelledby={promptId}
      className="mt-2 rounded-md border border-destructive/50 bg-background p-3"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <p id={promptId} className="text-sm font-medium text-foreground">{prompt}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onConfirm} className={dangerButtonClass}>{confirmLabel}</button>
        <button type="button" ref={cancelRef} onClick={onCancel} className={labActionButtonClass}>Cancel</button>
      </div>
    </div>
  );
}

interface OlderVersionNoticeProps {
  labId: string;
  older: LabOlderVersion;
  onDelete: (version: string) => void;
}

/** Saved work from another version of this lab: offered as a download, deletable, never migrated. */
function OlderVersionNotice({ labId, older, onDelete }: OlderVersionNoticeProps) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const hasFiles = Object.keys(older.fileBuffers).length > 0;
  const saved = formatSavedDate(older.updatedAt);

  return (
    <div
      role="group"
      aria-label={`Saved work from version ${older.version}`}
      className="mt-3 rounded-md border border-border bg-background p-3 text-sm"
    >
      <p className="text-foreground">
        You have saved work from version {older.version} of this lab{saved ? ` (last saved ${saved})` : ""}. This
        version has changed steps or files, so it starts fresh.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {hasFiles ? (
          <button
            type="button"
            className={labActionButtonClass}
            onClick={() => {
              const started = downloadLabWorkspace({
                labId,
                version: older.version,
                editableBuffers: older.fileBuffers,
                readOnlyFiles: [],
              });
              setStatus(started ? `Downloaded ${labWorkspaceZipName(labId, older.version)}.` : "This browser could not start the download.");
            }}
          >
            Download old files
          </button>
        ) : null}
        {confirming ? null : (
          <button type="button" ref={deleteRef} className={labActionButtonClass} onClick={() => setConfirming(true)}>
            Delete old version
          </button>
        )}
      </div>
      {confirming ? (
        <InlineConfirm
          prompt={`Delete the saved work from version ${older.version}? This cannot be undone.`}
          confirmLabel="Yes, delete it"
          onConfirm={() => onDelete(older.version)}
          onCancel={() => {
            setConfirming(false);
            requestAnimationFrame(() => deleteRef.current?.focus());
          }}
        />
      ) : null}
      <p role="status" aria-live="polite" className="mt-1 text-xs text-muted-foreground">{status}</p>
    </div>
  );
}

export default function LabClientPage({ lab, policy, files, solutions, backLink, lessons, prerequisites }: LabClientPageProps) {
  const starterBuffers = useMemo(
    () => Object.fromEntries(files.filter((file) => file.editable).map((file) => [file.path, file.content])),
    [files],
  );
  const { loaded, mode, progress, buffers, outcome, loadError, olderVersions, storeActions } = useLabWorkspace({
    policy,
    starterBuffers,
  });
  const simulationEnabled = useServerFeature("simulation");

  const firstWorkspaceFile = files.find((file) => file.editable) ?? files.find((file) => file.role !== "guide");
  const [selectedPath, setSelectedPath] = useState<string | null>(firstWorkspaceFile?.path ?? null);
  const [stepCodes, setStepCodes] = useState<Record<string, string>>({});
  const [consoleOutput, setConsoleOutput] = useState("");
  const [diagnostics, setDiagnostics] = useState<GraderDiagnostic[]>([]);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [toolbarStatus, setToolbarStatus] = useState<string | null>(null);
  const [olderStatus, setOlderStatus] = useState<string | null>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const stepsHeadingId = useId();

  const solutionsRevealed = canRevealSolutions(progress) && solutions.length > 0;
  const visibleFiles = useMemo(
    () => (solutionsRevealed ? [...files, ...solutions] : files),
    [files, solutions, solutionsRevealed],
  );
  const readOnlyContents = useMemo(() => {
    const contents: Record<string, string> = {};
    for (const file of [...files, ...solutions]) if (!file.editable) contents[file.path] = file.content;
    return contents;
  }, [files, solutions]);
  const readOnlyFiles = useMemo(() => files.filter((file) => !file.editable), [files]);
  const guideFile = files.find((file) => file.role === "guide") ?? null;
  const simulatableFiles = useMemo(
    () => files.filter((file) => file.editable && file.language === "systemverilog"),
    [files],
  );

  const currentStepIndex = Math.max(0, lab.steps.findIndex((step) => step.id === progress.currentStepId));
  const currentStep = lab.steps[currentStepIndex];
  const selectedFile = visibleFiles.find((file) => file.path === selectedPath) ?? null;
  const hasAutomatedGrader = currentStep?.completion === "graded" && Boolean(lab.graderId);
  const needsSandbox = hasAutomatedGrader && graderNeedsSandbox(policy, graderRegistry);
  const selectedContent = selectedFile
    ? (selectedFile.editable ? buffers[selectedFile.path] : readOnlyContents[selectedFile.path]) ?? ""
    : currentStep ? stepCodes[currentStep.id] ?? currentStep.starterCode : "";
  const outcomeMessage = outcome ? labSaveOutcomeMessage(outcome) : null;
  const archive = {
    labId: lab.id,
    version: lab.version,
    editableBuffers: buffers,
    readOnlyFiles,
    solutions: solutionsRevealed ? solutions : [],
  };

  if (!currentStep) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center">
        <div>
          <h1 className="text-3xl font-bold">{lab.title}</h1>
          <p className="mt-3 text-muted-foreground">This lab does not yet have a learner workflow.</p>
          <LabBackLink backLink={backLink} className="mt-4" />
        </div>
      </div>
    );
  }

  const isLastStep = currentStepIndex === lab.steps.length - 1;
  const currentStepDone = progress.completedSteps.includes(currentStep.id);

  const updateCode = (value: string) => {
    if (selectedFile?.editable) {
      storeActions.editBuffer(selectedFile.path, value);
    } else if (!selectedFile) {
      setStepCodes((codes) => ({ ...codes, [currentStep.id]: value }));
    }
  };

  const checkSolution = async () => {
    if (!hasAutomatedGrader || isChecking || !loaded) return;
    setConsoleOutput("Checking workspace…");
    setDiagnostics([]);
    setIsSuccess(null);
    setIsChecking(true);
    const wasCompleted = progress.status === "completed";
    try {
      const response = await storeActions.checkGradedStep(currentStep.id);
      if (!response.ok) {
        setIsSuccess(false);
        setConsoleOutput(
          response.outcome
            // The check passed but storing the step failed; the save message below says why.
            ? "The check passed, but this step could not be saved."
            : response.code === "GRADING_QUEUE_UNAVAILABLE"
              ? `${SANDBOX_NOTE}, which is not available here.`
              : `The grader could not run: ${response.code}`,
        );
        return;
      }
      const { result } = response;
      const hint = result.hint ?? (result.success ? "Correct!" : "The workspace needs another pass.");
      const completedNow = !wasCompleted && response.progress?.status === "completed";
      setIsSuccess(result.success);
      setConsoleOutput(completedNow ? `${hint}\nLab completed.` : hint);
      setDiagnostics(result.diagnostics.filter((diagnostic) => diagnostic.message !== result.hint));
    } catch (error) {
      setIsSuccess(false);
      setConsoleOutput(error instanceof Error ? error.message : "The grader could not run.");
    } finally {
      setIsChecking(false);
    }
  };

  const completeSelfAttestedStep = async () => {
    if (currentStep.completion !== "self_attested" || isCompleting || !loaded) return;
    setIsCompleting(true);
    setIsSuccess(null);
    setDiagnostics([]);
    setConsoleOutput("Recording your completion…");
    try {
      const response = await storeActions.completeSelfAttestedStep(currentStep.id);
      if (!response.ok) {
        setIsSuccess(false);
        // With a save outcome, the save message below says why; otherwise the policy refused the step.
        setConsoleOutput(
          response.outcome ? "Your completion was not saved." : `Completion could not be recorded: ${response.code}`,
        );
        return;
      }
      setConsoleOutput(isLastStep ? "Lab completed." : "Step completed. Continue when ready.");
      setIsSuccess(true);
    } catch (error) {
      setIsSuccess(false);
      setConsoleOutput(error instanceof Error ? error.message : "Completion could not be recorded.");
    } finally {
      setIsCompleting(false);
    }
  };

  const downloadFiles = () => {
    const started = downloadLabWorkspace(archive);
    setToolbarStatus(
      started ? `Downloaded ${labWorkspaceZipName(lab.id, lab.version)}.` : "This browser could not start the download.",
    );
  };

  const resetLab = async () => {
    setConfirmingReset(false);
    await storeActions.reset();
    setConsoleOutput("");
    setDiagnostics([]);
    setIsSuccess(null);
    setStepCodes({});
    setSelectedPath(firstWorkspaceFile?.path ?? null);
    setToolbarStatus("Lab reset. The starter files are back.");
    requestAnimationFrame(() => resetButtonRef.current?.focus());
  };

  return (
    // Stacks at phone and tablet widths; the guide column docks beside the workspace from lg.
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <aside
        aria-label="Lab guide"
        className="flex w-full shrink-0 flex-col border-b border-border bg-secondary p-4 text-secondary-foreground lg:w-80 lg:border-b-0 lg:border-r"
      >
        <LabBackLink backLink={backLink} className="mb-3" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {backLink.lesson?.code ?? lab.owningModule}
        </p>
        <h1 className="mb-2 text-xl font-bold [overflow-wrap:anywhere]">{lab.title}</h1>
        <p className="mb-2 text-sm text-muted-foreground">{lab.description}</p>
        {mode === "local" ? (
          <StorageStatusNote savedLabel="Your progress is saved in this browser." className="mb-3" />
        ) : null}
        {loadError ? (
          <p role="status" className="mb-3 text-sm font-medium text-destructive">
            Your saved progress could not be loaded ({loadError}). You can keep working; reload to try again.
          </p>
        ) : null}
        {olderVersions.map((older) => (
          <OlderVersionNotice
            key={older.version}
            labId={lab.id}
            older={older}
            onDelete={(version) => {
              storeActions.removeOlderVersion(version);
              setOlderStatus(`Deleted the saved work from version ${version}.`);
            }}
          />
        ))}
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{olderStatus}</p>
        <LabLessonContext lessons={lessons} prerequisites={prerequisites} className="mb-5 mt-3" />

        <h2 id={stepsHeadingId} className="mb-2 text-sm font-semibold uppercase tracking-wide">Steps</h2>
        <ol aria-labelledby={stepsHeadingId} className="space-y-2">
          {lab.steps.map((step, index) => {
            const done = progress.completedSteps.includes(step.id);
            return (
              <li key={step.id} className={`rounded border px-3 py-2 text-sm ${currentStepIndex === index ? "border-primary bg-primary/10 font-semibold" : "border-border"}`}>
                <button
                  type="button"
                  className={cn("flex w-full items-start gap-2 rounded-sm text-left disabled:cursor-not-allowed disabled:opacity-60", focusRing)}
                  aria-current={currentStepIndex === index ? "step" : undefined}
                  disabled={!loaded || !isStepUnlocked(policy, progress.completedSteps, step.id)}
                  onClick={() => storeActions.selectStep(step.id)}
                >
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{step.title}</span>
                  {done ? (
                    <>
                      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                      <span className="sr-only"> (completed)</span>
                    </>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>

        {visibleFiles.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Lab files</h2>
            <p role="status" aria-live="polite" className={cn("text-sm font-medium text-emerald-800 dark:text-emerald-200", solutionsRevealed && "mb-2")}>
              {solutionsRevealed ? "Solutions unlocked. They are listed with the lab files." : null}
            </p>
            <div className="space-y-1">
              {visibleFiles.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  aria-pressed={selectedPath === file.path}
                  className={cn(
                    `w-full rounded border px-3 py-2 text-left text-sm ${selectedPath === file.path ? "border-primary bg-primary/10" : "border-border hover:bg-background"}`,
                    focusRing,
                  )}
                  onClick={() => setSelectedPath(file.path)}
                >
                  <span className="block truncate font-medium">{file.path}</span>
                  <span className="text-xs text-muted-foreground">{roleLabel[file.role]} · {languageLabel[file.language] ?? file.language}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* A section, not <main>: the learning layout already provides the page's main landmark. */}
      <section aria-label="Lab workspace" aria-busy={!loaded} className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-card p-4 text-card-foreground">
          <h2 className="text-lg font-bold">{currentStep.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{currentStep.instructions}</p>
        </div>
        <div className="min-h-[520px] flex-1">
          <MonacoEditor
            height="100%"
            language={selectedFile?.language ?? "systemverilog"}
            value={selectedContent}
            onChange={(value) => updateCode(value ?? "")}
            beforeMount={defineSiteMonacoThemes}
            theme={SITE_MONACO_THEME.dark}
            options={{
              ariaLabel: selectedFile ? `${selectedFile.path} (${selectedFile.editable ? "editable" : "read-only"})` : `${currentStep.title} code`,
              minimap: { enabled: false },
              readOnly: !loaded || (selectedFile ? !selectedFile.editable : false),
              wordWrap: "on",
            }}
          />
        </div>
        <div className="border-t border-border bg-muted p-4">
          {hasAutomatedGrader ? (
            <div className="mb-4">
              <button type="button" onClick={checkSolution} disabled={!loaded || isChecking} className={cn(primaryButtonClass, "mb-2")}>
                {isChecking ? "Checking…" : "Check solution"}
              </button>
              <p className="text-xs text-muted-foreground">
                {mode === "local" ? STRUCTURAL_CHECK_NOTE : "Structural check on the server: it does not compile or simulate."}
              </p>
              {needsSandbox ? <p className="mt-1 text-xs font-medium text-foreground">{SANDBOX_NOTE}.</p> : null}
            </div>
          ) : currentStep.completion === "self_attested" && !currentStepDone ? (
            <button type="button" onClick={completeSelfAttestedStep} disabled={!loaded || isCompleting} className={primaryButtonClass}>
              {isCompleting ? "Recording…" : isLastStep ? "Mark lab complete" : "Mark step complete & continue"}
            </button>
          ) : (
            <p className="mb-2 text-sm text-muted-foreground">
              {mode === "local"
                ? "This step is complete. Your progress and workspace edits are saved in this browser."
                : "This step is complete. Your progress and workspace edits are saved to your account."}
            </p>
          )}
          <pre aria-live="polite" className={`whitespace-pre-wrap [overflow-wrap:anywhere] ${isSuccess === true ? "text-emerald-800 dark:text-emerald-200" : isSuccess === false ? "text-destructive" : ""}`}>{consoleOutput}</pre>
          {diagnostics.length > 0 ? (
            <ul aria-label="Check details" className="mt-2 list-disc space-y-1 pl-5 text-sm text-destructive">
              {diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${index}`} className="[overflow-wrap:anywhere]">
                  {diagnostic.file ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}` : ""}: ` : ""}
                  {diagnostic.message}
                </li>
              ))}
            </ul>
          ) : null}
          {outcomeMessage ? (
            <p role="status" className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">{outcomeMessage}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={downloadFiles} className={labActionButtonClass}>
              <Download aria-hidden="true" className="h-4 w-4" />
              Download files
            </button>
            {confirmingReset ? null : (
              <button
                type="button"
                ref={resetButtonRef}
                onClick={() => setConfirmingReset(true)}
                disabled={!loaded}
                className={labActionButtonClass}
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Reset lab
              </button>
            )}
          </div>
          {confirmingReset ? (
            <InlineConfirm
              prompt={
                mode === "local"
                  ? "Reset this lab? Your edits and completed steps for this version are deleted from this browser."
                  : "Reset this lab? Your workspace edits are cleared; completed steps stay on your account."
              }
              confirmLabel="Yes, reset lab"
              onConfirm={() => void resetLab()}
              onCancel={() => {
                setConfirmingReset(false);
                requestAnimationFrame(() => resetButtonRef.current?.focus());
              }}
            />
          ) : null}
          <p role="status" aria-live="polite" className="mt-1 text-xs text-muted-foreground">{toolbarStatus}</p>

          {simulatableFiles.length > 0 ? (
            simulationEnabled ? (
              <CodeExecutionEnvironment prepareFiles={async () => {
                await storeActions.flush();
                return simulatableFiles.map((file) => ({
                  path: file.path,
                  content: buffers[file.path] ?? file.content,
                }));
              }} />
            ) : (
              <LabRunLocally
                archive={archive}
                guide={guideFile}
                onOpenGuide={guideFile ? () => setSelectedPath(guideFile.path) : undefined}
              />
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
