import { z } from "zod";

export const labAssetRoleSchema = z.enum(["guide", "starter", "reference", "solution"]);

export const labAssetManifestSchema = z.object({
  path: z.string().min(1).refine(
    (value) => !value.startsWith("/") && !value.split("/").includes(".."),
    "Asset paths must stay within the lab directory",
  ),
  role: labAssetRoleSchema,
  language: z.string().min(1),
  editable: z.boolean(),
}).strict().superRefine((asset, context) => {
  if (asset.editable && asset.role !== "starter") {
    context.addIssue({ code: "custom", message: "Only starter assets may be editable" });
  }
});

export const labStepSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  version: z.string().min(1),
  completion: z.enum(["graded", "self_attested"]),
  title: z.string().min(1),
  instructions: z.string().min(1),
  starterCode: z.string().default(""),
}).strict();

/**
 * The longest author-written outcome line: the short "what you will be able to
 * do" clause a Practice hub row shows in place of the description's first
 * sentence. scripts/generate-lab-registry.mjs enforces the same limit.
 */
export const OUTCOME_LINE_MAX_CHARS = 110;

/** A trailing "…" or "...": an outcome line is written whole, never cut. */
const TRAILING_ELLIPSIS = /(?:\u2026|\.\.\.)$/;

/**
 * An outcome line: one complete clause, at most OUTCOME_LINE_MAX_CHARS
 * characters, no surrounding whitespace and no trailing ellipsis.
 */
export const outcomeLineSchema = z
  .string()
  .min(1)
  .max(OUTCOME_LINE_MAX_CHARS)
  .refine((value) => value === value.trim(), "An outcome line has no leading or trailing whitespace")
  .refine((value) => !TRAILING_ELLIPSIS.test(value), "An outcome line must not end in an ellipsis");

export const labManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  /** Optional author-written outcome line for the Practice hub row (outcomeLineSchema). */
  outcome: outcomeLineSchema.optional(),
  owningModule: z.string().min(1),
  routeSlug: z.string().regex(/^[a-z0-9-]+$/),
  moduleHref: z.string().startsWith("/curriculum/").optional(),
  status: z.enum(["available", "coming_soon", "archived"]),
  graderId: z.string().regex(/^[a-z0-9-]+$/).optional(),
  labPrerequisites: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  modulePrerequisites: z.array(z.string().min(1)).default([]),
  steps: z.array(labStepSchema),
  assets: z.array(labAssetManifestSchema),
}).strict();

export type LabAssetManifest = z.infer<typeof labAssetManifestSchema>;
export type LabAssetRole = z.infer<typeof labAssetRoleSchema>;
export type LabManifest = z.infer<typeof labManifestSchema> & { assetLocation: string };
export type LabStep = z.infer<typeof labStepSchema>;
