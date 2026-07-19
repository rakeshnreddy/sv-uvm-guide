import type { LabAssetRole, LabManifest, LabStep } from "@/lib/lab-manifest";

export type { LabAssetRole, LabManifest, LabStep };

export interface LabAssetSummary {
  path: string;
  fileName: string;
  role: LabAssetRole;
  language: string;
  editable: boolean;
}

export interface LabAsset extends LabAssetSummary {
  content: string;
}

export type LabMetadata = LabManifest;

export type LearnerLabDto = Pick<
  LabManifest,
  "id" | "version" | "title" | "description" | "owningModule" | "routeSlug" | "moduleHref" | "status" | "steps"
> & { graderId?: string };

export interface LabProgressDto {
  currentStepId: string | null;
  completedSteps: string[];
  fileBuffers: Record<string, string>;
}

export type LabWorkspaceDto = Pick<LabProgressDto, "currentStepId" | "fileBuffers">;
