import { promises as fs } from "node:fs";
import path from "node:path";

import type { LabManifest } from "@/lib/lab-manifest";
import type { LabAsset, LabAssetSummary } from "@/types/lab";

export interface LabAccess {
  canRevealSolution: boolean;
  userId: string;
}

const labsRoot = path.join(process.cwd(), "content", "curriculum", "labs");
const maxAssetBytes = 256 * 1024;
const maxLearnerWorkspaceBytes = 1024 * 1024;

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
