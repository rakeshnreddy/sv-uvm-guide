/**
 * The lab progress policy, shared by the server (src/server/labs.ts and
 * POST /api/labs/run) and the browser lab store (src/lib/lab-progress-store.ts),
 * so the two can never disagree about step order, completion or what a
 * workspace may hold.
 *
 * Pure and client-safe: it imports only the graders (which import nothing) and
 * types, takes the narrow LabPolicyInput built on the server by
 * toLabPolicyInput(), and measures bytes with TextEncoder (not the Node Buffer API).
 */
import type { LabGrader, LabSubmission } from "@/lib/lab-graders";
import type {
  LabManifest,
  LabPolicyInput,
  LabPolicyStep,
  LabProgressState,
  LabStepEvidence,
} from "@/types/lab";

/** Most files a workspace or a graded submission may hold (the run route's limit). */
export const WORKSPACE_MAX_FILES = 24;
/** Longest editable file kept in a browser workspace, in characters (the learner store's LAB_FILE_MAX_CHARS). */
export const WORKSPACE_FILE_MAX_CHARS = 128_000;
/** Most characters a browser workspace may hold in total (the learner store's LAB_RECORD_MAX_CHARS). */
export const WORKSPACE_MAX_CHARS = 256_000;
/** Longest file in a graded submission, in characters (the run route's limit). */
export const SUBMISSION_FILE_MAX_CHARS = 256 * 1024;
/** Most UTF-8 bytes a graded submission may hold (the run route's limit). */
export const SUBMISSION_MAX_BYTES = 1024 * 1024;

export type StepCompletionCode =
  | "LAB_STEP_NOT_FOUND"
  | "LAB_COMPLETION_POLICY_MISMATCH"
  | "LAB_PREVIOUS_STEP_INCOMPLETE";

export type GradedSubmissionCode =
  | "LAB_VERSION_MISMATCH"
  | "LAB_STEP_VERSION_MISMATCH"
  | "LAB_STEP_IS_SELF_ATTESTED"
  | "INVALID_SUBMISSION_FILE"
  | "GRADER_NOT_CONFIGURED"
  | "GRADER_NOT_FOUND"
  | "GRADING_QUEUE_UNAVAILABLE";

/** The HTTP status POST /api/labs/run answers with for each precheck failure. */
export const GRADED_SUBMISSION_STATUS: Readonly<Record<GradedSubmissionCode, number>> = Object.freeze({
  LAB_VERSION_MISMATCH: 409,
  LAB_STEP_VERSION_MISMATCH: 409,
  LAB_STEP_IS_SELF_ATTESTED: 409,
  INVALID_SUBMISSION_FILE: 400,
  GRADER_NOT_CONFIGURED: 404,
  GRADER_NOT_FOUND: 503,
  GRADING_QUEUE_UNAVAILABLE: 503,
});

/** What completed a step. `origin` says where a graded check ran; the server re-grades 'browser' evidence on import. */
export type LabEvidenceInput =
  | { kind: "graded"; graderId: string; graderVersion: string; origin: "browser" | "server" }
  | { kind: "self_attested" };

export type StepCompletionResult =
  | { ok: true; progress: LabProgressState }
  | { ok: false; code: StepCompletionCode };

export interface GraderLookup {
  get(id: string): LabGrader | undefined;
}

export type GradedSubmissionCheck =
  | { ok: true; grader: LabGrader; step: LabPolicyStep }
  | { ok: false; code: GradedSubmissionCode; status: number };

/** Why sanitizeWorkspace left a file out. */
export type WorkspaceDropReason = "not-editable" | "too-many-files" | "file-too-large" | "workspace-too-large";

export interface SanitizedWorkspace {
  fileBuffers: Record<string, string>;
  dropped: Array<{ path: string; reason: WorkspaceDropReason }>;
}

/** The policy slice of a manifest: id, version, grader, step ids, versions and kinds, and the editable paths. Built on the server. */
export function toLabPolicyInput(
  lab: Pick<LabManifest, "id" | "version" | "graderId" | "steps" | "assets">,
): LabPolicyInput {
  const policy: LabPolicyInput = {
    id: lab.id,
    version: lab.version,
    steps: lab.steps.map((step) => ({ id: step.id, version: step.version, completion: step.completion })),
    editablePaths: lab.assets.filter((asset) => asset.editable).map((asset) => asset.path),
  };
  if (lab.graderId) policy.graderId = lab.graderId;
  return policy;
}

let encoder: TextEncoder | null = null;

/** UTF-8 length of `text` in bytes, measured with TextEncoder (browser and server alike). */
export function utf8ByteLength(text: string): number {
  if (!encoder) encoder = new TextEncoder();
  return encoder.encode(text).length;
}

/** A progress state with nothing done: the first step current, no files. */
export function emptyLabProgress(policy: Pick<LabPolicyInput, "steps">): LabProgressState {
  return {
    currentStepId: policy.steps[0]?.id ?? null,
    completedSteps: [],
    stepEvidence: {},
    fileBuffers: {},
    status: "in_progress",
  };
}

/** Known step ids from `completedSteps`, in the manifest's order. */
export function canonicalCompletedSteps(policy: Pick<LabPolicyInput, "steps">, completedSteps: readonly string[]): string[] {
  const done = new Set(completedSteps);
  return policy.steps.filter((step) => done.has(step.id)).map((step) => step.id);
}

/** True once every step of a lab with steps is complete. */
export function isLabComplete(policy: Pick<LabPolicyInput, "steps">, completedSteps: readonly string[]): boolean {
  return policy.steps.length > 0 && canonicalCompletedSteps(policy, completedSteps).length === policy.steps.length;
}

/** Whether a step may be opened: the first step always, any other once the step before it is complete. */
export function isStepUnlocked(policy: Pick<LabPolicyInput, "steps">, completedSteps: readonly string[], stepId: string): boolean {
  const index = policy.steps.findIndex((step) => step.id === stepId);
  if (index < 0) return false;
  return index === 0 || completedSteps.includes(policy.steps[index - 1].id);
}

/**
 * The checks that need no stored progress: the step exists and its completion
 * kind matches the manifest. The server runs them before it reads the database.
 */
export function validateStepCompletion(
  policy: Pick<LabPolicyInput, "steps">,
  stepId: string,
  kind: LabEvidenceInput["kind"],
): StepCompletionCode | null {
  const step = policy.steps.find((candidate) => candidate.id === stepId);
  if (!step) return "LAB_STEP_NOT_FOUND";
  if (step.completion !== kind) return "LAB_COMPLETION_POLICY_MISMATCH";
  return null;
}

/**
 * Records one completed step. The step must exist, its completion kind must
 * match the manifest, and the step before it must be complete. Completed steps
 * are kept in the manifest's order (unknown ids are dropped), the evidence is
 * stamped with the step's version and `now`, the next step becomes current,
 * and the lab is completed once every step is done. Never mutates `progress`.
 */
export function applyStepCompletion(
  policy: Pick<LabPolicyInput, "steps">,
  progress: LabProgressState,
  stepId: string,
  evidence: LabEvidenceInput,
  now: number,
): StepCompletionResult {
  const invalid = validateStepCompletion(policy, stepId, evidence.kind);
  if (invalid) return { ok: false, code: invalid };

  const stepIndex = policy.steps.findIndex((step) => step.id === stepId);
  const step = policy.steps[stepIndex];
  const previousStep = policy.steps[stepIndex - 1];
  if (previousStep && !progress.completedSteps.includes(previousStep.id)) {
    return { ok: false, code: "LAB_PREVIOUS_STEP_INCOMPLETE" };
  }

  const completedSteps = canonicalCompletedSteps(policy, [...progress.completedSteps, stepId]);
  const complete = isLabComplete(policy, completedSteps);
  const recorded: LabStepEvidence = evidence.kind === "graded"
    ? {
        kind: "graded",
        graderId: evidence.graderId,
        graderVersion: evidence.graderVersion,
        stepVersion: step.version,
        recordedAt: now,
        origin: evidence.origin,
      }
    : { kind: "self_attested", stepVersion: step.version, recordedAt: now };

  const next: LabProgressState = {
    currentStepId: policy.steps[stepIndex + 1]?.id ?? stepId,
    completedSteps,
    stepEvidence: { ...progress.stepEvidence, [stepId]: recorded },
    fileBuffers: progress.fileBuffers,
    status: complete ? "completed" : "in_progress",
  };
  if (complete) {
    next.completedAt = progress.status === "completed" && progress.completedAt !== undefined ? progress.completedAt : now;
  }
  return { ok: true, progress: next };
}

/**
 * The prechecks POST /api/labs/run applies before grading, in the same order
 * and with the same codes, so the browser grades exactly what the server
 * would. The file checks (editable paths only, at most 24 unique files, 256 K
 * characters each and 1 MB of UTF-8 in total) can only fail in the browser:
 * the route's schema rejects those submissions earlier.
 */
export function checkGradedSubmission(
  policy: LabPolicyInput,
  submission: LabSubmission,
  registry: GraderLookup,
): GradedSubmissionCheck {
  const reject = (code: GradedSubmissionCode): GradedSubmissionCheck => ({
    ok: false,
    code,
    status: GRADED_SUBMISSION_STATUS[code],
  });

  if (submission.labId !== policy.id || submission.labVersion !== policy.version) return reject("LAB_VERSION_MISMATCH");
  const step = policy.steps.find((candidate) => candidate.id === submission.stepId);
  if (!step || step.version !== submission.stepVersion) return reject("LAB_STEP_VERSION_MISMATCH");
  if (step.completion !== "graded") return reject("LAB_STEP_IS_SELF_ATTESTED");

  const editablePaths = new Set(policy.editablePaths);
  const { files } = submission;
  const uniquePaths = new Set(files.map((file) => file.path));
  const totalBytes = files.reduce((bytes, file) => bytes + utf8ByteLength(file.content), 0);
  if (
    files.length === 0
    || files.length > WORKSPACE_MAX_FILES
    || uniquePaths.size !== files.length
    || files.some((file) => !editablePaths.has(file.path) || file.content.length > SUBMISSION_FILE_MAX_CHARS)
    || totalBytes > SUBMISSION_MAX_BYTES
  ) {
    return reject("INVALID_SUBMISSION_FILE");
  }

  if (!policy.graderId) return reject("GRADER_NOT_CONFIGURED");
  const grader = registry.get(policy.graderId);
  if (!grader) return reject("GRADER_NOT_FOUND");
  if (grader.requiresSandbox) return reject("GRADING_QUEUE_UNAVAILABLE");
  return { ok: true, grader, step };
}

/** True when the lab's grader exists but needs the simulator service, so it cannot run in the browser. */
export function graderNeedsSandbox(policy: Pick<LabPolicyInput, "graderId">, registry: GraderLookup): boolean {
  if (!policy.graderId) return false;
  return registry.get(policy.graderId)?.requiresSandbox === true;
}

/**
 * The files a browser workspace may keep: editable paths only, in the
 * manifest's order, at most 24 files, WORKSPACE_FILE_MAX_CHARS per file and
 * WORKSPACE_MAX_CHARS in total. Everything else is dropped and reported.
 */
export function sanitizeWorkspace(
  policy: Pick<LabPolicyInput, "editablePaths">,
  buffers: Readonly<Record<string, unknown>>,
): SanitizedWorkspace {
  const fileBuffers: Record<string, string> = {};
  const dropped: SanitizedWorkspace["dropped"] = [];
  const editable = new Set(policy.editablePaths);
  let files = 0;
  let total = 0;

  for (const path of policy.editablePaths) {
    if (!Object.prototype.hasOwnProperty.call(buffers, path)) continue;
    const content = buffers[path];
    if (typeof content !== "string") {
      dropped.push({ path, reason: "not-editable" });
      continue;
    }
    if (content.length > WORKSPACE_FILE_MAX_CHARS) {
      dropped.push({ path, reason: "file-too-large" });
      continue;
    }
    if (files >= WORKSPACE_MAX_FILES) {
      dropped.push({ path, reason: "too-many-files" });
      continue;
    }
    if (total + content.length > WORKSPACE_MAX_CHARS) {
      dropped.push({ path, reason: "workspace-too-large" });
      continue;
    }
    fileBuffers[path] = content;
    files += 1;
    total += content.length;
  }
  for (const path of Object.keys(buffers)) {
    if (!editable.has(path)) dropped.push({ path, reason: "not-editable" });
  }
  return { fileBuffers, dropped };
}

/** Solutions are listed once the lab is complete in this progress. A learning nudge, not access control. */
export function canRevealSolutions(progress: Pick<LabProgressState, "status"> | null | undefined): boolean {
  return progress?.status === "completed";
}
