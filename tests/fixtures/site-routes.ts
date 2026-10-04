/**
 * Shared helpers for unit tests that check site links without a server:
 * canonical lesson URLs against the generated curriculum, labs against the
 * lab registry, and every other path against the App Router tree in src/app.
 */
import fs from 'node:fs';
import path from 'node:path';

import { curriculumData } from '@/lib/curriculum-data';
import { getLabById } from '@/lib/lab-registry';
import type { ManifestLike } from '@/lib/learning-paths';

export const repoRoot = path.resolve(__dirname, '../..');
export const curriculumRoot = path.join(repoRoot, 'content', 'curriculum');
const appRoot = path.join(repoRoot, 'src', 'app');

export function readManifest(): ManifestLike & {
  tiers: { id: string; title: string; audience: string; modules: ManifestLike['tiers'][number]['modules'] }[];
} {
  return JSON.parse(fs.readFileSync(path.join(curriculumRoot, 'curriculum.manifest.json'), 'utf8'));
}

const PAGE_FILES = ['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'page.mdx'];

function entries(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((entry) => fs.statSync(path.join(dir, entry)).isDirectory());
  } catch {
    return [];
  }
}

function hasPage(dir: string): boolean {
  return PAGE_FILES.some((file) => fs.existsSync(path.join(dir, file)));
}

const isGroup = (entry: string) => /^\(.+\)$/.test(entry);
const isDynamic = (entry: string) => /^\[[^.[\]]+\]$/.test(entry);
const isCatchAll = (entry: string) => /^\[\[?\.\.\.[^\]]+\]\]?$/.test(entry);
const isOptionalCatchAll = (entry: string) => /^\[\[\.\.\.[^\]]+\]\]$/.test(entry);

function matchRoute(dir: string, segments: string[], allowDynamic: boolean): boolean {
  if (segments.length === 0) {
    if (hasPage(dir)) return true;
    return entries(dir).some(
      (entry) =>
        (isGroup(entry) && matchRoute(path.join(dir, entry), [], allowDynamic)) ||
        (allowDynamic && isOptionalCatchAll(entry) && hasPage(path.join(dir, entry))),
    );
  }
  const [head, ...rest] = segments;
  for (const entry of entries(dir)) {
    const child = path.join(dir, entry);
    if (isGroup(entry)) {
      if (matchRoute(child, segments, allowDynamic)) return true;
    } else if (entry === head) {
      if (matchRoute(child, rest, allowDynamic)) return true;
    } else if (allowDynamic && isDynamic(entry)) {
      if (matchRoute(child, rest, allowDynamic)) return true;
    } else if (allowDynamic && isCatchAll(entry)) {
      if (hasPage(child)) return true;
    }
  }
  return false;
}

/** True for `/curriculum/<TierFolder>/<ModuleFolder>/<lesson>` with exact folder case. */
export function isCanonicalLessonHref(href: string): boolean {
  const segments = href.split('#')[0].split('?')[0].split('/').filter(Boolean);
  if (segments.length !== 4 || segments[0] !== 'curriculum') return false;
  const [, tierId, moduleId, lessonSlug] = segments;
  const tier = curriculumData.find((t) => t.slug === tierId);
  const section = tier?.sections.find((s) => s.slug === moduleId);
  return Boolean(section?.topics.some((t) => t.slug === lessonSlug));
}

/**
 * True when a site link resolves to a page: a canonical lesson, a static page
 * beside the lesson catch-all (for example /curriculum/expert-index), an
 * available lab, or any other App Router page.
 */
export function appRouteExists(href: string): boolean {
  const pathname = href.split('#')[0].split('?')[0];
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'curriculum' && segments.length > 1) {
    return matchRoute(appRoot, segments, false) || isCanonicalLessonHref(pathname);
  }
  if (segments[0] === 'practice' && segments[1] === 'lab' && segments.length === 3) {
    return matchRoute(appRoot, segments, false) || getLabById(segments[2])?.status === 'available';
  }
  return matchRoute(appRoot, segments, true);
}
