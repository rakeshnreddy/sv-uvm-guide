import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Lesson, ModuleEntry, Tier } from '@/lib/curriculum-data';

const { lessonFixtures, moduleFixture, tierFixture } = vi.hoisted(() => {
  const fixtures: Lesson[] = [
    { title: 'Intro', slug: 'intro', description: '' },
    { title: 'Deep Dive', slug: 'deep-dive', description: '' },
    { title: 'Wrap Up', slug: 'wrap-up', description: '' },
  ];

  const moduleFixture: ModuleEntry = {
    id: 'module-one',
    title: 'Module One',
    slug: 'module-one',
    lessons: fixtures,
  };

  const tierFixture: Tier = {
    title: 'Tier Alpha',
    slug: 'tier-alpha',
    tier: 'T1',
    sections: [
      {
        title: moduleFixture.title,
        slug: moduleFixture.slug,
        topics: fixtures,
      },
    ],
  };

  return { lessonFixtures: fixtures, moduleFixture, tierFixture };
});

vi.mock('@/lib/curriculum-data', async () => {
  const actual = await vi.importActual<typeof import('@/lib/curriculum-data')>(
    '@/lib/curriculum-data',
  );

  return {
    ...actual,
    tiers: [tierFixture],
    getModules: (tier: Tier) => {
      if (tier.slug === tierFixture.slug) {
        return [moduleFixture];
      }

      return actual.getModules(tier);
    },
  };
});

// Import after mocking curriculum data so the hook reads the fixtures above.
import { useCurriculumProgress } from '@/hooks/useCurriculumProgress';

describe('useCurriculumProgress', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(1_726_000_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores stored progress and reports module + tier percentages', async () => {
    localStorage.setItem(
      'curriculumProgress',
      JSON.stringify({
        'module-one': {
          completedLessons: ['intro'],
          lastVisitedAt: 1_700_000_000_000,
          lastVisitedLesson: 'intro',
        },
      }),
    );

    const { result } = renderHook(() => useCurriculumProgress());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.getModuleProgress('module-one')).toBe(33);
    expect(result.current.getTierProgress('tier-alpha')).toBe(33);
  });

  it('marks lessons complete and persists the snapshot', async () => {
    const { result } = renderHook(() => useCurriculumProgress());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.completeLesson('module-one', 'deep-dive');
    });

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('curriculumProgress') ?? '{}');
      expect(stored['module-one'].completedLessons).toEqual(['deep-dive']);
      expect(stored['module-one'].lastVisitedLesson).toBe('deep-dive');
      expect(stored['module-one'].lastVisitedAt).toBe(1_726_000_000_000);
    });

    expect(result.current.getModuleProgress('module-one')).toBe(33);
  });

  it('records lesson visits without marking completion', async () => {
    const { result } = renderHook(() => useCurriculumProgress());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.recordLessonVisit('module-one', 'wrap-up');
    });

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('curriculumProgress') ?? '{}');
      expect(stored['module-one'].completedLessons).toEqual([]);
      expect(stored['module-one'].lastVisitedLesson).toBe('wrap-up');
    });

    expect(result.current.getModuleProgress('module-one')).toBe(0);
  });
});
