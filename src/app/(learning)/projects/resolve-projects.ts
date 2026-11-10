/**
 * Resolves the project briefs (projects-data.ts) against the milestone ladder,
 * the generated curriculum and the lab registry, through the practice-links
 * helpers. Server-side: it pulls in the curriculum and the lab registry.
 */
import { getLabById } from '@/lib/lab-registry';
import { MILESTONES, type MilestoneId } from '@/lib/learning-paths';
import { resolveLessonRef, toLabPracticeItem, type LessonLink, type PracticeItem } from '@/lib/practice-links';

import { PROJECT_BRIEFS, type ProjectBrief } from './projects-data';

export interface ResolvedProject extends ProjectBrief {
  name: string;
  anchor: string;
  lessonLinks: LessonLink[];
  labItems: PracticeItem[];
}

function milestoneAnchor(id: MilestoneId): string {
  return `project-${id.toLowerCase()}`;
}

/** Each brief with its milestone name and its lessons and labs resolved; throws on a ref that does not resolve. */
export function resolveProjects(): ResolvedProject[] {
  return MILESTONES.map((milestone) => {
    const brief = PROJECT_BRIEFS.find((entry) => entry.milestone === milestone.id);
    if (!brief) throw new Error(`projects: milestone ${milestone.id} has no project brief`);
    const lessonLinks = brief.lessons.map((ref) => {
      const lesson = resolveLessonRef(ref);
      if (!lesson) throw new Error(`projects: ${milestone.id} names lesson ${ref}, which does not exist`);
      return lesson;
    });
    const labItems = brief.labs.map((id) => {
      const lab = getLabById(id);
      if (!lab || lab.status === 'archived') throw new Error(`projects: ${milestone.id} names lab ${id}, which is not listed`);
      return toLabPracticeItem(lab);
    });
    return { ...brief, name: milestone.name, anchor: milestoneAnchor(milestone.id), lessonLinks, labItems };
  });
}
