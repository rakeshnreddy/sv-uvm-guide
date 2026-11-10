/**
 * Server-side: resolves each /resources entry's lesson refs against the
 * generated curriculum. Kept apart from src/lib/resources.ts so that module
 * stays plain, client-safe data.
 */
import { resolveLessonRef, type LessonLink } from '@/lib/practice-links';
import { RESOURCES, type Resource } from '@/lib/resources';

/** A resource with its lesson refs resolved. Plain data: safe to pass to client components. */
export interface ResolvedResource extends Resource {
  lessonLinks: LessonLink[];
}

/** Lesson refs on a resource that name no lesson in the curriculum (a test keeps this empty). */
export function unresolvedLessonRefs(resource: Resource): string[] {
  return resource.lessons.filter((ref) => !resolveLessonRef(ref));
}

/** Every resource with its lessons as links, in manifest order, without duplicates or unknown refs. */
export function resolveResources(resources: readonly Resource[] = RESOURCES): ResolvedResource[] {
  return resources.map((resource) => {
    const seen = new Set<string>();
    const lessonLinks: LessonLink[] = [];
    for (const ref of resource.lessons) {
      const lesson = resolveLessonRef(ref);
      if (!lesson || seen.has(lesson.ref)) continue;
      seen.add(lesson.ref);
      lessonLinks.push(lesson);
    }
    lessonLinks.sort((a, b) => a.order - b.order);
    return { ...resource, lessonLinks };
  });
}
