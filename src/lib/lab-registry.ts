import { GENERATED_LAB_MANIFESTS } from "@/generated/lab-registry";
import type { LabManifest, LabStep } from "@/lib/lab-manifest";
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

/** Where lab progress lives, shown next to every way into an available lab. */
export const LAB_PROGRESS_NOTE = "Your progress is saved in this browser.";

/**
 * The note that describes an available lab's "Launch Lab" link: the lab page
 * keeps step progress and editor files in this browser, so opening a lab
 * needs no account. Labs that are not available cannot be opened (the lab
 * route answers 404), so they get no note.
 */
export function labProgressNote(lab: Pick<LabManifest, "status">): string | null {
  return lab.status === "available" ? LAB_PROGRESS_NOTE : null;
}

/**
 * How a lab's steps are checked. A lab counts as auto-checked only when it
 * names a grader and at least one step is graded; that check is structural
 * and runs in the browser, so the copy never promises a compile or a
 * simulation.
 */
export function labCheckSummary(
  lab: Pick<LabManifest, "graderId"> & { steps: readonly Pick<LabStep, "completion">[] },
): string {
  const autoChecked = Boolean(lab.graderId) && lab.steps.some((step) => step.completion === "graded");
  return autoChecked ? "Auto-checked steps (structural, in your browser)" : "Self-checked steps: you mark each one complete";
}

/**
 * What a server component passes to the client LabProgressBadge
 * (src/components/practice/LabProgressBadge.tsx). The badge takes these
 * props instead of reading the lab registry, so lesson, hub and home bundles
 * never include the generated registry. `stepIds` lets the badge turn the
 * stored current step into "step X of N".
 */
export interface LabBadgeData {
  labId: string;
  version: string;
  stepCount: number;
  title: string;
  stepIds: string[];
}

export function labBadgeProps(lab: Pick<LabManifest, "id" | "version" | "title" | "steps">): LabBadgeData {
  return {
    labId: lab.id,
    version: lab.version,
    stepCount: lab.steps.length,
    title: lab.title,
    stepIds: lab.steps.map((step) => step.id),
  };
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
