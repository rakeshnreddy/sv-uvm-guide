import { Prisma } from "@prisma/client";

import type { LabManifest } from "@/lib/lab-manifest";
import type { LabAccess } from "@/lib/lab-assets";
import { getPrisma } from "@/lib/prisma";
import type { LabProgressDto, LabWorkspaceDto } from "@/types/lab";

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

export async function completeLabStep(
  userId: string,
  lab: LabManifest,
  stepId: string,
  evidence: StepEvidence,
): Promise<LabProgressDto> {
  const stepIndex = lab.steps.findIndex((step) => step.id === stepId);
  if (stepIndex < 0) throw new LabStepCompletionError("LAB_STEP_NOT_FOUND");
  if (lab.steps[stepIndex].completion !== evidence.kind) {
    throw new LabStepCompletionError("LAB_COMPLETION_POLICY_MISMATCH");
  }

  const client = getPrisma();
  const existing = await client.labAttempt.findFirst({
    where: { userId, labId: lab.id, labVersion: lab.version },
    orderBy: { updatedAt: "desc" },
  });
  const completedSteps = existing?.completedSteps ?? [];
  const previousStep = lab.steps[stepIndex - 1];
  if (previousStep && !completedSteps.includes(previousStep.id)) {
    throw new LabStepCompletionError("LAB_PREVIOUS_STEP_INCOMPLETE");
  }

  const canonicalCompletedSteps = lab.steps
    .filter((step) => step.id === stepId || completedSteps.includes(step.id))
    .map((step) => step.id);
  const isComplete = lab.steps.length > 0 && canonicalCompletedSteps.length === lab.steps.length;
  const stepEvidence = {
    ...parseStepEvidence(existing?.stepEvidence ?? null),
    [stepId]: {
      ...evidence,
      stepVersion: lab.steps[stepIndex].version,
      recordedAt: new Date().toISOString(),
    },
  } as Prisma.InputJsonValue;
  const nextStepId = lab.steps[stepIndex + 1]?.id ?? stepId;
  const data = {
    currentStepId: nextStepId,
    completedSteps: canonicalCompletedSteps,
    stepEvidence,
    status: isComplete ? "COMPLETED" as const : "IN_PROGRESS" as const,
    completedAt: isComplete ? new Date() : null,
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
