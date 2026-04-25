import { describe, expect, it } from 'vitest';
import {
  curriculumData,
  findPrevNextTopics,
  findTopicBySlug,
  getBreadcrumbs,
  normalizeSlug,
  type Topic,
} from '@/lib/curriculum-data';

type TopicRoute = {
  tierSlug: string;
  sectionSlug: string;
  topic: Topic;
};

const allTopicRoutes = (): TopicRoute[] =>
  curriculumData.flatMap((tier) =>
    tier.sections.flatMap((section) =>
      section.topics.map((topic) => ({
        tierSlug: tier.slug,
        sectionSlug: section.slug,
        topic,
      })),
    ),
  );

const prettySlug = (segment: string) =>
  segment
    .replace(/_/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

describe('curriculum navigation contract', () => {
  it('resolves learner-facing pretty slugs to canonical curriculum slugs', () => {
    const normalized = normalizeSlug([
      't3-advanced',
      'a-uvm-6-scoreboards-and-reference-models',
    ]);

    expect(normalized).toEqual([
      'T3_Advanced',
      'A-UVM-6_Scoreboards_and_Reference_Models',
      'index',
    ]);
    expect(findTopicBySlug(normalized)?.title).toBe('A-UVM-6: Scoreboards and Reference Models');
  });

  it('resolves pretty slugs for every tier, section, and topic in the generated curriculum', () => {
    for (const { tierSlug, sectionSlug, topic } of allTopicRoutes()) {
      expect(
        normalizeSlug([prettySlug(tierSlug), prettySlug(sectionSlug), prettySlug(topic.slug)]),
        `${tierSlug}/${sectionSlug}/${topic.slug}`,
      ).toEqual([tierSlug, sectionSlug, topic.slug]);
    }
  });

  it('gives every topic a breadcrumb chain whose links resolve to real curriculum pages', () => {
    for (const { tierSlug, sectionSlug, topic } of allTopicRoutes()) {
      const breadcrumbs = getBreadcrumbs([tierSlug, sectionSlug, topic.slug]);
      expect(breadcrumbs.map((breadcrumb) => breadcrumb.path)).toEqual([
        '/curriculum',
        `/curriculum/${tierSlug}`,
        `/curriculum/${tierSlug}/${sectionSlug}`,
        `/curriculum/${tierSlug}/${sectionSlug}/${topic.slug}`,
      ]);

      for (const breadcrumb of breadcrumbs.slice(1)) {
        const slug = breadcrumb.path.replace(/^\/curriculum\/?/, '').split('/').filter(Boolean);
        expect(normalizeSlug(slug), breadcrumb.path).toHaveLength(3);
      }
    }
  });

  it('keeps previous and next topic links reciprocal across the whole course', () => {
    const routes = allTopicRoutes();
    const canonicalPaths = routes.map(({ tierSlug, sectionSlug, topic }) =>
      [tierSlug, sectionSlug, topic.slug].join('/'),
    );

    routes.forEach(({ tierSlug, sectionSlug, topic }, index) => {
      const navigation = findPrevNextTopics([tierSlug, sectionSlug, topic.slug]);
      expect(navigation.prev?.slug, `${canonicalPaths[index]} previous`).toBe(canonicalPaths[index - 1]);
      expect(navigation.next?.slug, `${canonicalPaths[index]} next`).toBe(canonicalPaths[index + 1]);
    });
  });
});
