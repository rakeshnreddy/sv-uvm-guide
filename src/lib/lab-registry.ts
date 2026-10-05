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

/**
 * Whether opening the lab needs a signed-in learner (G30-PRAC-10). The lab
 * route, src/app/(learning)/practice/lab/[labId]/page.tsx, calls
 * requireSession() for every available lab, because step progress, editor
 * files and grading are stored per learner. Labs that are not available
 * cannot be opened at all (the route returns 404), so they need nothing.
 */
export function labRequiresSignIn(lab: Pick<LabManifest, "status">): boolean {
  return lab.status === "available";
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
