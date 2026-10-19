import { Prisma } from "@prisma/client";

import type { LabManifest } from "@/lib/lab-manifest";
import type { LabAccess } from "@/lib/lab-assets";
import { applyStepCompletion, toLabPolicyInput, validateStepCompletion } from "@/lib/lab-progress-policy";
import { getPrisma } from "@/lib/prisma";
import type { LabProgressDto, LabProgressState, LabWorkspaceDto } from "@/types/lab";

type StepEvidence =
  | { kind: "graded"; graderId: string; graderVersion: string }
  | { kind: "self_attested" };

export class LabStepCompletionError extends Error {
  constructor(
    public readonly code:
      | "LAB_STEP_NOT_FOUND"
      | "LAB_COMPLETION_POLICY_MISMATCH"
      | "LAB_PREVIOUS_STEP_INCOMPLETE",
  ) {
    super(code);
    this.name = "LabStepCompletionError";
  }
}

function parseWorkspace(value: Prisma.JsonValue | null): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function parseStepEvidence(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Prisma.JsonValue] => entry[1] !== undefined),
  );
}

function toProgress(
  lab: LabManifest,
  attempt: {
    currentStepId: string | null;
    completedSteps: string[];
    workspace: Prisma.JsonValue | null;
  } | null,
): LabProgressDto {
  return {
    currentStepId: attempt?.currentStepId ?? lab.steps[0]?.id ?? null,
    completedSteps: attempt?.completedSteps ?? [],
    fileBuffers: parseWorkspace(attempt?.workspace ?? null),
  };
}

export const labAccessService = {
  async resolve(userId: string, lab: LabManifest): Promise<LabAccess> {
    const completed = await getPrisma().labAttempt.findFirst({
      where: { userId, labId: lab.id, labVersion: lab.version, status: "COMPLETED" },
      select: { id: true },
    });
    return { userId, canRevealSolution: Boolean(completed) };
  },
};

export async function getLabProgress(userId: string, lab: LabManifest): Promise<LabProgressDto> {
  const attempt = await getPrisma().labAttempt.findFirst({
    where: { userId, labId: lab.id, labVersion: lab.version },
    orderBy: { updatedAt: "desc" },
  });
  return toProgress(lab, attempt);
}

export async function saveLabWorkspace(
  userId: string,
  lab: LabManifest,
  workspace: LabWorkspaceDto,
): Promise<LabProgressDto> {
  const client = getPrisma();
  const existing = await client.labAttempt.findFirst({
    where: { userId, labId: lab.id, labVersion: lab.version },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  const data = {
    currentStepId: workspace.currentStepId,
    workspace: workspace.fileBuffers as Prisma.InputJsonValue,
  };

  const attempt = existing
    ? await client.labAttempt.update({ where: { id: existing.id }, data })
    : await client.labAttempt.create({
        data: { userId, labId: lab.id, labVersion: lab.version, ...data },
      });
  return toProgress(lab, attempt);
}

/**
 * Records a completed step on the server. Ordering, evidence and completion
 * come from the shared policy (applyStepCompletion in
 * src/lib/lab-progress-policy.ts), the same one the browser lab store runs;
 * this function only reads and writes the LabAttempt row. Stored evidence
 * keeps its shape: {kind, graderId?, graderVersion?, stepVersion, recordedAt (ISO)}.
 */
export async function completeLabStep(
  userId: string,
  lab: LabManifest,
  stepId: string,
  evidence: StepEvidence,
): Promise<LabProgressDto> {
  const policy = toLabPolicyInput(lab);
  // The checks that need no stored progress run before the database is read.
  const invalid = validateStepCompletion(policy, stepId, evidence.kind);
  if (invalid) throw new LabStepCompletionError(invalid);

  const client = getPrisma();
  const existing = await client.labAttempt.findFirst({
    where: { userId, labId: lab.id, labVersion: lab.version },
    orderBy: { updatedAt: "desc" },
  });
  const now = Date.now();
  const current: LabProgressState = {
    currentStepId: existing?.currentStepId ?? null,
    completedSteps: existing?.completedSteps ?? [],
    // Stored evidence stays opaque JSON here; the new entry is merged in below.
    stepEvidence: {},
    fileBuffers: {},
    status: existing?.status === "COMPLETED" ? "completed" : "in_progress",
  };
  const result = applyStepCompletion(
    policy,
    current,
    stepId,
    evidence.kind === "graded" ? { ...evidence, origin: "server" } : evidence,
    now,
  );
  if (!result.ok) throw new LabStepCompletionError(result.code);

  const recorded = result.progress.stepEvidence[stepId];
  const isComplete = result.progress.status === "completed";
  const stepEvidence = {
    ...parseStepEvidence(existing?.stepEvidence ?? null),
    [stepId]: {
      ...evidence,
      stepVersion: recorded.stepVersion,
      recordedAt: new Date(recorded.recordedAt).toISOString(),
    },
  } as Prisma.InputJsonValue;
  const data = {
    currentStepId: result.progress.currentStepId,
    completedSteps: result.progress.completedSteps,
    stepEvidence,
    status: isComplete ? "COMPLETED" as const : "IN_PROGRESS" as const,
    completedAt: isComplete ? new Date(now) : null,
  };

  const attempt = existing
    ? await client.labAttempt.update({ where: { id: existing.id }, data })
    : await client.labAttempt.create({
        data: {
          userId,
          labId: lab.id,
          labVersion: lab.version,
          workspace: {},
          ...data,
        },
      });
  return toProgress(lab, attempt);
}
