import fs from 'node:fs';
import path from 'node:path';

import { LabAsset, LabAssetRole, LabMetadata } from '@/types/lab';

const labsRoot = path.join(process.cwd(), 'content', 'curriculum', 'labs');
const maxAssetBytes = 256 * 1024;

const extensionLanguage: Record<string, string> = {
  '.c': 'c',
  '.h': 'c',
  '.json': 'json',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.pss': 'pss',
  '.sv': 'systemverilog',
  '.svh': 'systemverilog',
};

const supportedExtensions = new Set([
  '.c',
  '.h',
  '.json',
  '.md',
  '.mdx',
  '.pss',
  '.sv',
  '.svh',
]);

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(nextPath);
    }
    return entry.isFile() ? [nextPath] : [];
  });
}

function classifyRole(relativePath: string): LabAssetRole {
  const normalized = relativePath.split(path.sep).join('/');
  const fileName = path.basename(normalized);

  if (fileName === 'README.md') {
    return 'guide';
  }
  if (fileName === 'lab.json') {
    return 'metadata';
  }
  if (normalized.startsWith('starter/') || /(^|[._-])starter([._-]|$)/i.test(fileName)) {
    return 'starter';
  }
  if (normalized.startsWith('solution/') || /(^|[._-])solution([._-]|$)/i.test(fileName)) {
    return 'solution';
  }
  return 'reference';
}

function sortByLearnerFlow(a: LabAsset, b: LabAsset): number {
  const roleOrder: Record<LabAssetRole, number> = {
    guide: 0,
    starter: 1,
    reference: 2,
    solution: 3,
    metadata: 4,
  };

  return roleOrder[a.role] - roleOrder[b.role] || a.path.localeCompare(b.path);
}

export function getLabAssets(lab: LabMetadata): LabAsset[] {
  const assetRoot = path.resolve(process.cwd(), lab.assetLocation);
  const relativeToLabsRoot = path.relative(labsRoot, assetRoot);

  if (relativeToLabsRoot.startsWith('..') || path.isAbsolute(relativeToLabsRoot) || !fs.existsSync(assetRoot)) {
    return [];
  }

  return walkFiles(assetRoot)
    .filter((filePath) => {
      const extension = path.extname(filePath);
      return supportedExtensions.has(extension) && fs.statSync(filePath).size <= maxAssetBytes;
    })
    .map((filePath) => {
      const relativePath = path.relative(assetRoot, filePath);
      const role = classifyRole(relativePath);

      return {
        path: relativePath.split(path.sep).join('/'),
        fileName: path.basename(filePath),
        role,
        language: extensionLanguage[path.extname(filePath)] ?? 'plaintext',
        content: fs.readFileSync(filePath, 'utf8'),
        editable: role === 'starter',
      };
    })
    .sort(sortByLearnerFlow);
}
