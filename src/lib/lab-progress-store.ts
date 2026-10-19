/**
 * Where a learner's lab progress lives, behind one interface.
 *
 * - createBrowserLabProgressStore(policy): this browser's localStorage, through
 *   the learner store's labProgressRecords ('sv-uvm-guide:lab:<id>@<version>').
 *   Step completion and the structural checks run here, with the same policy
 *   and graders as the server; graded evidence is marked origin 'browser'.
 * - createAccountLabProgressStore(policy, fetch): the account API
 *   (/api/me/labs/:id/progress and /api/labs/run). useLabWorkspace picks it
 *   only when usePersistenceTarget().target is 'server', which needs accounts,
 *   server sync and a signed-in learner, so never on the anonymous deploy.
 *
 * Client-safe: no auth, database or server imports.
 */
import { graderRegistry, type GraderDiagnostic, type GraderResult, type LabSubmission, type LabSubmissionFile } from "@/lib/lab-graders";
import {
  applyStepCompletion,
  canonicalCompletedSteps,
  checkGradedSubmission,
  emptyLabProgress,
  isLabComplete,
  isStepUnlocked,
  sanitizeWorkspace,
  SUBMISSION_FILE_MAX_CHARS,
  type GraderLookup,
  type LabEvidenceInput,
  type StepCompletionResult,
} from "@/lib/lab-progress-policy";
import {
  LAB_FILE_MAX_CHARS,
  LAB_RECORD_MAX_CHARS,
  LAB_TOTAL_MAX_CHARS,
  labProgressRecords,
  labRecordId,
  listLabRecords,
  recordActivity,
  totalLabRecordChars,
  writeOutcomeMessage,
  type LabProgressRecord,
  type WriteOutcome,
} from "@/lib/learner-store";
import type { LabPolicyInput, LabProgressDto, LabProgressState } from "@/types/lab";

/** A learner-store write outcome, or 'server-error' when the account API refused or could not be reached. */
export type LabSaveOutcome = WriteOutcome | "server-error";

/** Saved work for another version of the same lab (a version bump starts fresh; the old record is kept). */
export interface LabOlderVersion {
  version: string;
  /** Epoch ms; 0 when unknown. */
  updatedAt: number;
  fileBuffers: Record<string, string>;
}

export interface LabProgressSnapshot {
  progress: LabProgressState;
  olderVersions: LabOlderVersion[];
}

export type LabActionResult =
  | { ok: true; progress: LabProgressState; outcome: LabSaveOutcome }
  | { ok: false; code: string; outcome?: LabSaveOutcome };

export type LabCheckResult =
  | { ok: true; result: GraderResult; progress: LabProgressState | null; outcome: LabSaveOutcome | null }
  | { ok: false; code: string; outcome?: LabSaveOutcome };

export interface LabProgressStore {
  readonly kind: "browser" | "account";
  /** The progress for this lab version, validated against the policy, and saved work from other versions. Never writes. */
  load(): Promise<LabProgressSnapshot>;
  /**
   * Saves the editor buffers and the current step only; completion and evidence are never touched.
   * The browser store does not write a step the stored progress does not unlock.
   */
  saveWorkspace(buffers: Readonly<Record<string, string>>, currentStepId: string | null): Promise<LabSaveOutcome>;
  completeSelfAttestedStep(stepId: string): Promise<LabActionResult>;
  /** Runs the step's structural check and, when it passes, records the step as graded. */
  checkGradedStep(stepId: string, files: readonly LabSubmissionFile[]): Promise<LabCheckResult>;
  /** Clears this lab version's progress and workspace. */
  reset(): Promise<LabSaveOutcome>;
  olderVersions(): LabOlderVersion[];
  removeOlderVersion(version: string): void;
  /** Called after this lab's stored progress may have changed (this tab or another). */
  subscribe(listener: () => void): () => void;
}

/** A load failure from the account API. */
export class LabProgressLoadError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "LabProgressLoadError";
  }
}

const formatCount = (value: number) => value.toLocaleString("en-US");

/** Plain-language text for a lab save outcome, for an inline role=status message. Null when nothing needs saying. */
export function labSaveOutcomeMessage(outcome: LabSaveOutcome): string | null {
  switch (outcome) {
    case "saved":
    case "not-in-browser":
      return null;
    case "memory-only":
      return "Kept for this visit only: this browser's storage is blocked or full, so your lab work will be lost when you leave. Use Download files to keep a copy.";
    case "too-large":
      return `Not saved: these files are too large to keep in this browser (at most ${formatCount(LAB_FILE_MAX_CHARS)} characters per file, ${formatCount(LAB_RECORD_MAX_CHARS)} per lab and ${formatCount(LAB_TOTAL_MAX_CHARS)} across all labs). Use Download files to keep a copy, or delete saved work from old lab versions.`;
    case "server-error":
      return "Progress could not be saved. Your current editor remains intact.";
    default:
      return writeOutcomeMessage(outcome);
  }
}

/** Every save outcome that can come back as a failure code (a completion that could not be stored). */
const FAILED_SAVE_OUTCOMES: ReadonlySet<string> = new Set<LabSaveOutcome>([
  "memory-only",
  "too-large",
  "blocked-newer-version",
  "blocked-corrupt",
  "not-in-browser",
  "server-error",
]);

const RELOAD_FOR_LATEST = "Reload the page to get the latest version of this lab.";
const TOO_LARGE_TO_CHECK =
  `These files are too large to check: at most ${formatCount(SUBMISSION_FILE_MAX_CHARS)} characters per file and 1 MB for all files together. Shorten the largest file, then check again.`;

/**
 * Plain-language text for every error code the lab flow can return: the
 * policy's prechecks and step completion (browser store), the browser grader,
 * and the account API (/api/labs/run and /api/me/labs/:id/progress).
 */
export const LAB_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  // Check prechecks: checkGradedSubmission(), which POST /api/labs/run also answers with.
  INVALID_SUBMISSION_FILE: TOO_LARGE_TO_CHECK,
  INVALID_LAB_SUBMISSION: TOO_LARGE_TO_CHECK,
  LAB_VERSION_MISMATCH: `This lab has changed since the page loaded. ${RELOAD_FOR_LATEST}`,
  LAB_STEP_VERSION_MISMATCH: `This step has changed since the page loaded. ${RELOAD_FOR_LATEST}`,
  LAB_STEP_IS_SELF_ATTESTED: "This step has no automatic check. Mark it complete once you have done it.",
  GRADER_NOT_CONFIGURED: "This step has no automatic check yet.",
  GRADER_NOT_FOUND: `The check for this step is missing from this version of the site. ${RELOAD_FOR_LATEST}`,
  GRADING_QUEUE_UNAVAILABLE: "This check needs the simulator service, which is not available here.",
  // Running the check.
  LAB_GRADING_UNAVAILABLE: "The check could not run. Your files are still in the editor, so try again.",
  LAB_GRADING_MALFORMED: "The check sent back an answer this page could not read. Try again.",
  // Step completion: applyStepCompletion() and the account API.
  LAB_PREVIOUS_STEP_INCOMPLETE: "Finish the earlier steps first.",
  LAB_STEP_NOT_FOUND: `This step is not part of this version of the lab. ${RELOAD_FOR_LATEST}`,
  LAB_COMPLETION_POLICY_MISMATCH: `This step is completed a different way. ${RELOAD_FOR_LATEST}`,
  LAB_STEP_REQUIRES_GRADER: "This step is completed by its check. Use Check solution.",
  INVALID_LAB_COMPLETION: "The completion was not accepted. Reload the page and try again.",
  // Progress kept on an account (account era only).
  LAB_NOT_FOUND: "This lab is not available. Go back to the practice page and choose another lab.",
  LAB_PROGRESS_UNAVAILABLE: "Your progress could not be reached. Check your connection and try again.",
  LAB_PROGRESS_MALFORMED: "Your progress came back in a form this page could not read. Reload the page and try again.",
  INVALID_LAB_PROGRESS: "Your workspace was not accepted. Reload the page and try again.",
  UNAUTHORIZED: "Your account session has ended. Reload the page and try again.",
});

/**
 * Plain-language text for a lab error code, for the lab page's console line.
 * A save outcome reads as its save message. An unknown code gets a generic
 * sentence, with the code as a reference only when it looks like one.
 */
export function labErrorMessage(code: string): string {
  if (Object.prototype.hasOwnProperty.call(LAB_ERROR_MESSAGES, code)) return LAB_ERROR_MESSAGES[code];
  if (FAILED_SAVE_OUTCOMES.has(code)) {
    return labSaveOutcomeMessage(code as LabSaveOutcome) ?? "Your work could not be saved.";
  }
  const reference = /^[A-Za-z0-9_-]{1,64}$/.test(code) ? ` (reference: ${code})` : "";
  return `Something went wrong${reference}. Reload the page and try again.`;
}

/** The fields of a stored record (or an API response) that progress is rebuilt from. */
export interface LabProgressSource {
  currentStepId: string | null;
  completedSteps: readonly string[];
  stepEvidence: LabProgressRecord["stepEvidence"];
  fileBuffers: Readonly<Record<string, unknown>>;
  completedAt?: number;
  updatedAt?: number;
}

/**
 * Validates stored progress against the lab's policy: unknown and duplicate
 * steps are dropped (completed steps keep the manifest's order), evidence is
 * kept only for completed steps, buffers go through sanitizeWorkspace (unknown
 * paths and oversized files are dropped), and the status is recomputed. The
 * stored current step is kept only while the policy unlocks it (isStepUnlocked),
 * so a hand-edited or imported record cannot open a later step early; otherwise
 * it falls back to the first incomplete unlocked step (the last step once all
 * are done). Pure.
 */
export function normalizeLabProgress(policy: LabPolicyInput, source: LabProgressSource | null): LabProgressState {
  if (!source) return emptyLabProgress(policy);
  const completedSteps = canonicalCompletedSteps(policy, source.completedSteps);
  const done = new Set(completedSteps);
  const stepEvidence: LabProgressState["stepEvidence"] = {};
  for (const [stepId, evidence] of Object.entries(source.stepEvidence)) {
    if (done.has(stepId)) stepEvidence[stepId] = evidence;
  }
  const unlocked = (stepId: string) => isStepUnlocked(policy, completedSteps, stepId);
  const firstOpen = policy.steps.find((step) => !done.has(step.id) && unlocked(step.id))?.id
    ?? policy.steps[policy.steps.length - 1]?.id
    ?? null;
  const complete = isLabComplete(policy, completedSteps);
  const progress: LabProgressState = {
    currentStepId: source.currentStepId && unlocked(source.currentStepId) ? source.currentStepId : firstOpen,
    completedSteps,
    stepEvidence,
    fileBuffers: sanitizeWorkspace(policy, source.fileBuffers).fileBuffers,
    status: complete ? "completed" : "in_progress",
  };
  if (complete) progress.completedAt = source.completedAt ?? source.updatedAt ?? 0;
  return progress;
}

function sameBuffers(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key]);
}

function serializedLength(record: LabProgressRecord): number {
  return JSON.stringify({ v: labProgressRecords.version, data: record }).length;
}

/** True when sanitizeWorkspace left an editable file out for its size or count, so saving would lose learner text. */
function workspaceTooLarge(policy: LabPolicyInput, buffers: Readonly<Record<string, string>>) {
  const sanitized = sanitizeWorkspace(policy, buffers);
  return {
    fileBuffers: sanitized.fileBuffers,
    tooLarge: sanitized.dropped.some((entry) => entry.reason !== "not-editable"),
  };
}

function knownStepOrNull(policy: LabPolicyInput, stepId: string | null): string | null {
  return stepId !== null && policy.steps.some((step) => step.id === stepId) ? stepId : null;
}

export interface BrowserLabProgressStoreOptions {
  /** The clock (epoch ms); tests pass a fixed one. */
  now?: () => number;
  /** The graders; defaults to the shared graderRegistry. */
  registry?: GraderLookup;
}

/** Lab progress in this browser. Every write is an update() on a fresh read, so other tabs' changes survive. */
export function createBrowserLabProgressStore(
  policy: LabPolicyInput,
  options: BrowserLabProgressStoreOptions = {},
): LabProgressStore {
  const now = options.now ?? Date.now;
  const registry = options.registry ?? graderRegistry;
  const recordId = labRecordId(policy.id, policy.version);

  const newRecord = (timestamp: number): LabProgressRecord => ({
    labId: policy.id,
    labVersion: policy.version,
    currentStepId: policy.steps[0]?.id ?? null,
    completedSteps: [],
    stepEvidence: {},
    fileBuffers: {},
    status: "in_progress",
    startedAt: timestamp,
    updatedAt: timestamp,
  });

  const olderVersions = (): LabOlderVersion[] =>
    listLabRecords(policy.id)
      .filter((record) => record.labVersion !== policy.version)
      .map((record) => ({ version: record.labVersion, updatedAt: record.updatedAt, fileBuffers: { ...record.fileBuffers } }));

  const completeStep = (stepId: string, evidence: LabEvidenceInput): LabActionResult => {
    let applied: StepCompletionResult | null = null;
    let alreadyDone = false;
    let storedBuffers: Readonly<Record<string, string>> = {};
    const outcome = labProgressRecords.update(recordId, (current) => {
      const timestamp = now();
      const base = normalizeLabProgress(policy, current);
      alreadyDone = base.completedSteps.includes(stepId);
      applied = applyStepCompletion(policy, base, stepId, evidence, timestamp);
      if (!applied.ok) return null;
      const start = current ?? newRecord(timestamp);
      storedBuffers = start.fileBuffers;
      // Completion changes steps, evidence and status; the stored workspace stays as it is.
      const next: LabProgressRecord = {
        ...start,
        currentStepId: applied.progress.currentStepId,
        completedSteps: applied.progress.completedSteps,
        stepEvidence: applied.progress.stepEvidence,
        status: applied.progress.status,
        updatedAt: timestamp,
      };
      if (applied.progress.completedAt !== undefined) next.completedAt = applied.progress.completedAt;
      else delete next.completedAt;
      return next;
    });

    const result = applied as StepCompletionResult | null;
    if (!result) return { ok: false, code: outcome, outcome };
    if (!result.ok) return { ok: false, code: result.code };
    // 'too-large' and 'blocked-corrupt' wrote nothing, so the step is not recorded; 'memory-only' keeps it for this visit.
    if (outcome !== "saved" && outcome !== "memory-only") return { ok: false, code: outcome, outcome };
    if (!alreadyDone) {
      recordActivity(result.progress.status === "completed" ? "lab-complete" : "lab-step", now());
    }
    return {
      ok: true,
      progress: { ...result.progress, fileBuffers: sanitizeWorkspace(policy, storedBuffers).fileBuffers },
      outcome,
    };
  };

  return {
    kind: "browser",

    async load() {
      return {
        progress: normalizeLabProgress(policy, labProgressRecords.get(recordId)),
        olderVersions: olderVersions(),
      };
    },

    async saveWorkspace(buffers, currentStepId) {
      const { fileBuffers, tooLarge } = workspaceTooLarge(policy, buffers);
      if (tooLarge) return "too-large";
      const requestedStep = knownStepOrNull(policy, currentStepId);
      let overBudget = false;
      const outcome = labProgressRecords.update(recordId, (current) => {
        // A step the fresh record does not unlock (another tab reset the lab, say) is not written.
        const completed = current ? canonicalCompletedSteps(policy, current.completedSteps) : [];
        const stepId = requestedStep !== null && isStepUnlocked(policy, completed, requestedStep) ? requestedStep : null;
        if (current && sameBuffers(current.fileBuffers, fileBuffers) && (stepId === null || current.currentStepId === stepId)) {
          return current;
        }
        const timestamp = now();
        // Only the workspace, the current step and updatedAt change: completions written by another tab survive.
        const next: LabProgressRecord = current
          ? { ...current, fileBuffers, currentStepId: stepId ?? current.currentStepId, updatedAt: timestamp }
          : { ...newRecord(timestamp), fileBuffers, currentStepId: stepId ?? policy.steps[0]?.id ?? null };
        if (totalLabRecordChars(recordId) + serializedLength(next) > LAB_TOTAL_MAX_CHARS) {
          overBudget = true;
          return null;
        }
        return next;
      });
      return overBudget ? "too-large" : outcome;
    },

    async completeSelfAttestedStep(stepId) {
      return completeStep(stepId, { kind: "self_attested" });
    },

    async checkGradedStep(stepId, files) {
      const step = policy.steps.find((candidate) => candidate.id === stepId);
      const submission: LabSubmission = {
        labId: policy.id,
        labVersion: policy.version,
        stepId,
        stepVersion: step?.version ?? "",
        files: files.map((file) => ({ path: file.path, content: file.content })),
      };
      const check = checkGradedSubmission(policy, submission, registry);
      if (!check.ok) return { ok: false, code: check.code };

      let result: GraderResult;
      try {
        result = await check.grader.grade(submission);
      } catch {
        return { ok: false, code: "LAB_GRADING_UNAVAILABLE" };
      }
      if (!result.success) return { ok: true, result, progress: null, outcome: null };

      const completion = completeStep(stepId, {
        kind: "graded",
        graderId: check.grader.id,
        graderVersion: check.grader.version,
        origin: "browser",
      });
      if (!completion.ok) return completion;
      return { ok: true, result, progress: completion.progress, outcome: completion.outcome };
    },

    async reset() {
      labProgressRecords.remove(recordId);
      return "saved";
    },

    olderVersions,

    removeOlderVersion(version) {
      if (!version || version === policy.version) return;
      labProgressRecords.remove(labRecordId(policy.id, version));
    },

    subscribe(listener) {
      return labProgressRecords.subscribe(listener);
    },
  };
}

// ---------------------------------------------------------------------------
// The account store (account era only)
// ---------------------------------------------------------------------------

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorCode(body: unknown, status: number): string {
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return `HTTP_${status}`;
}

function isProgressDto(value: unknown): value is LabProgressDto {
  if (!value || typeof value !== "object") return false;
  const dto = value as Partial<Record<keyof LabProgressDto, unknown>>;
  return (
    (dto.currentStepId === null || typeof dto.currentStepId === "string")
    && Array.isArray(dto.completedSteps)
    && dto.completedSteps.every((stepId) => typeof stepId === "string")
    && Boolean(dto.fileBuffers)
    && typeof dto.fileBuffers === "object"
    && !Array.isArray(dto.fileBuffers)
  );
}

function isDiagnostic(value: unknown): value is GraderDiagnostic {
  return Boolean(value) && typeof value === "object"
    && typeof (value as { code?: unknown }).code === "string"
    && typeof (value as { message?: unknown }).message === "string";
}

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/**
 * Lab progress on the learner's account, through the existing account API:
 * GET, PATCH and POST /api/me/labs/:id/progress and POST /api/labs/run. The
 * server keeps its own evidence, so loaded evidence is empty. reset() clears
 * the server workspace only; completed steps stay on the account. There is
 * no cross-tab event and no older-version list for the server store.
 */
export function createAccountLabProgressStore(
  policy: LabPolicyInput,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): LabProgressStore {
  const progressUrl = `/api/me/labs/${encodeURIComponent(policy.id)}/progress`;
  const fromDto = (dto: LabProgressDto): LabProgressState =>
    normalizeLabProgress(policy, { ...dto, stepEvidence: {} });

  const patchWorkspace = async (fileBuffers: Record<string, string>, currentStepId: string | null): Promise<LabSaveOutcome> => {
    try {
      const response = await fetchImpl(progressUrl, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ labVersion: policy.version, currentStepId, fileBuffers }),
      });
      return response.ok ? "saved" : "server-error";
    } catch {
      return "server-error";
    }
  };

  return {
    kind: "account",

    async load() {
      let response: Response;
      try {
        response = await fetchImpl(progressUrl, { headers: { Accept: "application/json" }, cache: "no-store" });
      } catch {
        throw new LabProgressLoadError("LAB_PROGRESS_UNAVAILABLE");
      }
      const body = await readJson(response);
      if (!response.ok || !isProgressDto(body)) throw new LabProgressLoadError(errorCode(body, response.status));
      return { progress: fromDto(body), olderVersions: [] };
    },

    async saveWorkspace(buffers, currentStepId) {
      const { fileBuffers, tooLarge } = workspaceTooLarge(policy, buffers);
      if (tooLarge) return "too-large";
      return patchWorkspace(fileBuffers, knownStepOrNull(policy, currentStepId) ?? policy.steps[0]?.id ?? null);
    },

    async completeSelfAttestedStep(stepId) {
      const step = policy.steps.find((candidate) => candidate.id === stepId);
      if (!step) return { ok: false, code: "LAB_STEP_NOT_FOUND" };
      try {
        const response = await fetchImpl(progressUrl, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ labVersion: policy.version, stepId, stepVersion: step.version, completion: "self_attested" }),
        });
        const body = await readJson(response);
        if (!response.ok) return { ok: false, code: errorCode(body, response.status) };
        if (!isProgressDto(body)) return { ok: false, code: "LAB_PROGRESS_MALFORMED" };
        return { ok: true, progress: fromDto(body), outcome: "saved" };
      } catch {
        return { ok: false, code: "LAB_PROGRESS_UNAVAILABLE", outcome: "server-error" };
      }
    },

    async checkGradedStep(stepId, files) {
      const step = policy.steps.find((candidate) => candidate.id === stepId);
      if (!step) return { ok: false, code: "LAB_STEP_VERSION_MISMATCH" };
      try {
        const response = await fetchImpl("/api/labs/run", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            labId: policy.id,
            labVersion: policy.version,
            stepId,
            stepVersion: step.version,
            files: files.map((file) => ({ path: file.path, content: file.content })),
          }),
        });
        const body = await readJson(response);
        if (!response.ok) return { ok: false, code: errorCode(body, response.status) };
        if (!body || typeof body !== "object" || typeof (body as { success?: unknown }).success !== "boolean") {
          return { ok: false, code: "LAB_GRADING_MALFORMED" };
        }
        const payload = body as { success: boolean; hint?: unknown; diagnostics?: unknown; progress?: unknown };
        const result: GraderResult = {
          success: payload.success,
          diagnostics: Array.isArray(payload.diagnostics) ? payload.diagnostics.filter(isDiagnostic) : [],
        };
        if (typeof payload.hint === "string") result.hint = payload.hint;
        const progress = isProgressDto(payload.progress) ? fromDto(payload.progress) : null;
        return { ok: true, result, progress, outcome: progress ? "saved" : null };
      } catch {
        return { ok: false, code: "LAB_GRADING_UNAVAILABLE" };
      }
    },

    async reset() {
      return patchWorkspace({}, policy.steps[0]?.id ?? null);
    },

    olderVersions() {
      return [];
    },

    removeOlderVersion() {
      // The account API keeps one attempt per lab version and has no delete.
    },

    subscribe() {
      return () => undefined;
    },
  };
}
