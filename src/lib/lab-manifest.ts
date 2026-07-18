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
  title: z.string().min(1),
  instructions: z.string().min(1),
  starterCode: z.string().default(""),
}).strict();

export const labManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
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
