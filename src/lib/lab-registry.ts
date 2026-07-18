import { GENERATED_LAB_MANIFESTS } from "@/generated/lab-registry";
import type { LabManifest } from "@/lib/lab-manifest";
import type { LearnerLabDto } from "@/types/lab";

// This map is derived exclusively from validated lab.json manifests.
export const LAB_REGISTRY: Readonly<Record<string, LabManifest>> = Object.freeze(
  Object.fromEntries(GENERATED_LAB_MANIFESTS.map((lab) => [lab.id, lab])),
);

export function getAllLabs(): LabManifest[] {
  return [...GENERATED_LAB_MANIFESTS];
}

export function getLabById(id: string): LabManifest | undefined {
  return LAB_REGISTRY[id];
}

export function toLearnerLabDto(lab: LabManifest): LearnerLabDto {
  return {
    id: lab.id,
    version: lab.version,
    title: lab.title,
    description: lab.description,
    owningModule: lab.owningModule,
    routeSlug: lab.routeSlug,
    moduleHref: lab.moduleHref,
    status: lab.status,
    steps: lab.steps,
    graderId: lab.graderId,
  };
}
