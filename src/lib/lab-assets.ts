import { promises as fs } from "node:fs";
import path from "node:path";

import type { LabManifest } from "@/lib/lab-manifest";
import type { LabAsset, LabAssetSummary, LabFileDto } from "@/types/lab";

export interface LabAccess {
  canRevealSolution: boolean;
  userId: string;
}

const labsRoot = path.join(process.cwd(), "content", "curriculum", "labs");
const maxAssetBytes = 256 * 1024;
const maxLearnerWorkspaceBytes = 1024 * 1024;

/** Caps on the files a static lab page carries as props: per file, and for the whole lab (files and solutions). */
export interface LabFileLimits {
  maxFileBytes: number;
  maxLabBytes: number;
}

export const LAB_FILE_LIMITS: Readonly<LabFileLimits> = Object.freeze({
  maxFileBytes: maxAssetBytes,
  maxLabBytes: maxLearnerWorkspaceBytes,
});

function resolveDeclaredAsset(lab: LabManifest, assetPath: string): string {
  const assetRoot = path.resolve(process.cwd(), lab.assetLocation);
  const relativeToLabsRoot = path.relative(labsRoot, assetRoot);
  if (relativeToLabsRoot.startsWith("..") || path.isAbsolute(relativeToLabsRoot)) {
    throw new Error("LAB_ASSET_ROOT_INVALID");
  }

  const resolved = path.resolve(assetRoot, assetPath);
  if (!resolved.startsWith(`${assetRoot}${path.sep}`)) throw new Error("LAB_ASSET_PATH_INVALID");
  return resolved;
}

function canAccessRole(role: LabManifest["assets"][number]["role"], access: LabAccess): boolean {
  return role !== "solution" || access.canRevealSolution;
}

export async function getLearnerLabAssets(
  lab: LabManifest,
  access: LabAccess,
): Promise<LabAssetSummary[]> {
  const visibleAssets = lab.assets.filter((asset) => canAccessRole(asset.role, access));
  const sizes = await Promise.all(
    visibleAssets.map(async (asset) => (await fs.stat(resolveDeclaredAsset(lab, asset.path))).size),
  );
  const totalBytes = sizes.reduce((total, size) => total + size, 0);
  if (sizes.some((size) => size > maxAssetBytes) || totalBytes > maxLearnerWorkspaceBytes) {
    throw new Error("LAB_ASSET_PAYLOAD_TOO_LARGE");
  }

  return visibleAssets.map((asset) => ({
    ...asset,
    fileName: path.basename(asset.path),
  }));
}

export async function readLabAsset(
  lab: LabManifest,
  requestedPath: string,
  access: LabAccess,
): Promise<LabAsset | null> {
  const asset = lab.assets.find((candidate) => candidate.path === requestedPath);
  if (!asset || !canAccessRole(asset.role, access)) return null;

  const resolved = resolveDeclaredAsset(lab, asset.path);
  const stat = await fs.stat(resolved);
  if (!stat.isFile() || stat.size > maxAssetBytes) throw new Error("LAB_ASSET_TOO_LARGE");

  return {
    ...asset,
    fileName: path.basename(asset.path),
    content: await fs.readFile(resolved, "utf8"),
  };
}

export interface LabFilesForBuild {
  /** Guide, starter and reference files, in manifest order. */
  files: LabFileDto[];
  /** Solution files, in manifest order. The lab page lists them only after the learner completes the lab. */
  solutions: LabFileDto[];
}

/**
 * Reads every declared file of a lab at build time, for the static lab page
 * (src/app/(learning)/practice/lab/[labId]/page.tsx). Only manifest-declared
 * paths are read, through the same traversal checks as readLabAsset. A file
 * over 256 KB throws LAB_ASSET_TOO_LARGE and a lab over 1 MB in total throws
 * LAB_ASSET_PAYLOAD_TOO_LARGE, so an oversized lab fails the build instead of
 * bloating the page.
 */
export async function readLabFilesForBuild(
  lab: LabManifest,
  limits: LabFileLimits = LAB_FILE_LIMITS,
): Promise<LabFilesForBuild> {
  const resolved = lab.assets.map((asset) => ({ asset, filePath: resolveDeclaredAsset(lab, asset.path) }));
  const stats = await Promise.all(resolved.map(({ filePath }) => fs.stat(filePath)));
  let totalBytes = 0;
  for (const stat of stats) {
    if (!stat.isFile()) throw new Error("LAB_ASSET_PATH_INVALID");
    if (stat.size > limits.maxFileBytes) throw new Error("LAB_ASSET_TOO_LARGE");
    totalBytes += stat.size;
  }
  if (totalBytes > limits.maxLabBytes) throw new Error("LAB_ASSET_PAYLOAD_TOO_LARGE");

  const all = await Promise.all(resolved.map(async ({ asset, filePath }): Promise<LabFileDto> => ({
    path: asset.path,
    fileName: path.basename(asset.path),
    role: asset.role,
    language: asset.language,
    editable: asset.editable,
    content: await fs.readFile(filePath, "utf8"),
  })));
  return {
    files: all.filter((file) => file.role !== "solution"),
    solutions: all.filter((file) => file.role === "solution"),
  };
}
