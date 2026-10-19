import type { LabAssetRole, LabManifest, LabStep } from "@/lib/lab-manifest";
import type { LabRecordStatus, LabStepEvidence } from "@/lib/learner-store/repositories/labs";

export type { LabAssetRole, LabManifest, LabRecordStatus, LabStep, LabStepEvidence };

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

/**
 * One declared lab file with its contents, read at build time
 * (readLabFilesForBuild in src/lib/lab-assets.ts) and passed to the static lab
 * page as a prop.
 */
export interface LabFileDto {
  path: string;
  fileName: string;
  role: LabAssetRole;
  language: string;
  editable: boolean;
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

/** The part of a lab step the progress policy needs. */
export interface LabPolicyStep {
  id: string;
  version: string;
  completion: LabStep["completion"];
}

/**
 * The narrow, serializable slice of a lab manifest that the shared progress
 * policy (src/lib/lab-progress-policy.ts) needs. The server builds it with
 * toLabPolicyInput(manifest), so browser code never needs the manifest's
 * asset list or the lab registry.
 */
export interface LabPolicyInput {
  id: string;
  version: string;
  graderId?: string;
  steps: LabPolicyStep[];
  /** Paths of the editable starter files: the only files a workspace may hold. */
  editablePaths: string[];
}

/** A learner's progress on one lab version, as the progress policy and the lab stores see it. */
export interface LabProgressState {
  currentStepId: string | null;
  /** Completed step ids, in the manifest's order. */
  completedSteps: string[];
  stepEvidence: Record<string, LabStepEvidence>;
  /** Editable file path to the learner's content. */
  fileBuffers: Record<string, string>;
  status: LabRecordStatus;
  /** Epoch ms. */
  completedAt?: number;
}
