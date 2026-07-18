import { Prisma } from "@prisma/client";

import type { LabManifest } from "@/lib/lab-manifest";
import { getPrisma } from "@/lib/prisma";
import type { LabAccess } from "@/lib/lab-assets";
import type { LabProgressDto } from "@/types/lab";

function parseWorkspace(value: Prisma.JsonValue | null): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
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
  return {
    currentStepId: attempt?.currentStepId ?? lab.steps[0]?.id ?? null,
    completedSteps: attempt?.completedSteps ?? [],
    fileBuffers: parseWorkspace(attempt?.workspace ?? null),
  };
}

export async function saveLabProgress(
  userId: string,
  lab: LabManifest,
  progress: LabProgressDto,
): Promise<LabProgressDto> {
  const existing = await getPrisma().labAttempt.findFirst({
    where: { userId, labId: lab.id, labVersion: lab.version },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  const complete = lab.steps.length > 0 && lab.steps.every((step) => progress.completedSteps.includes(step.id));
  const data = {
    currentStepId: progress.currentStepId,
    completedSteps: progress.completedSteps,
    workspace: progress.fileBuffers as Prisma.InputJsonValue,
    status: complete ? "COMPLETED" as const : "IN_PROGRESS" as const,
    completedAt: complete ? new Date() : null,
  };

  if (existing) {
    await getPrisma().labAttempt.update({ where: { id: existing.id }, data });
  } else {
    await getPrisma().labAttempt.create({
      data: { userId, labId: lab.id, labVersion: lab.version, ...data },
    });
  }
  return progress;
}
