/**
 * Build-time reads of the curriculum content for the overview (/curriculum)
 * and the expert index (/curriculum/expert-index).
 *
 * Server only: it reads content/curriculum with node:fs, so never import it
 * from a client component. Both pages are statically rendered, so these reads
 * run once per build.
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

import type { Module as CurriculumTier } from '@/lib/curriculum-data';
import { lessonKey, readingMinutes } from '@/lib/curriculum-overview';
import { buildExpertIndex, type ExpertIndex } from '@/lib/expert-index';

function defaultRoot(): string {
  return path.join(process.cwd(), 'content', 'curriculum');
}

export interface ManifestTierMeta {
  id: string;
  title: string;
  audience: string;
}

/** Tier titles and audiences from content/curriculum/curriculum.manifest.json. */
export function readManifestTiers(root: string = defaultRoot()): ManifestTierMeta[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'curriculum.manifest.json'), 'utf8')) as {
    tiers: ManifestTierMeta[];
  };
  return manifest.tiers.map(({ id, title, audience }) => ({ id, title, audience }));
}

/** The MDX body of a lesson without its frontmatter, or null when the file does not exist. */
export function readLessonBody(
  tierId: string,
  moduleId: string,
  lessonSlug: string,
  root: string = defaultRoot(),
): string | null {
  try {
    return matter(fs.readFileSync(path.join(root, tierId, moduleId, `${lessonSlug}.mdx`), 'utf8')).content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Reading minutes per lesson, keyed "<ModuleFolder>/<lesson>". Counted the way
 * the lesson header counts them (words of the MDX body ÷ 180), so the overview
 * and the lesson page agree.
 */
export function readLessonMinutes(data: readonly CurriculumTier[], root: string = defaultRoot()): Record<string, number> {
  const minutes: Record<string, number> = {};
  for (const tier of data) {
    for (const section of tier.sections) {
      for (const topic of section.topics) {
        const body = readLessonBody(tier.slug, section.slug, topic.slug, root);
        if (body === null) continue;
        minutes[lessonKey(section.slug, topic.slug)] = readingMinutes(body.trim().split(/\s+/).filter(Boolean).length);
      }
    }
  }
  return minutes;
}

/** Every "Expert:" heading across the lessons, grouped by tier and module. */
export function loadExpertIndex(data: readonly CurriculumTier[], root: string = defaultRoot()): ExpertIndex {
  return buildExpertIndex({
    data,
    tiers: readManifestTiers(root),
    readLesson: (tierId, moduleId, lessonSlug) => readLessonBody(tierId, moduleId, lessonSlug, root),
  });
}
