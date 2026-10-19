import React from 'react';
import { renderToString } from 'react-dom/server';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Lesson, ModuleEntry, Tier } from '@/lib/curriculum-data';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';

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

const STORAGE_KEY = 'curriculumProgress';
const RECOVERED_KEY = 'sv-uvm-guide:recovered:curriculumProgress';

function stored(): Record<string, { completedLessons: string[]; completedAt?: Record<string, number>; lastVisitedLesson?: string; lastVisitedAt?: number }> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
}

describe('useCurriculumProgress', () => {
  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(1_726_000_000_000);
  });

  afterEach(() => {
    // Unmount first: resetting the store notifies subscribers.
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
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
  it('records when a lesson was completed and keeps the first completion time', async () => {
    const { result } = renderHook(() => useCurriculumProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.completeLesson('module-one', 'intro');
    });
    expect(stored()['module-one'].completedAt).toEqual({ intro: 1_726_000_000_000 });

    vi.spyOn(Date, 'now').mockReturnValue(1_726_000_500_000);
    act(() => {
      result.current.completeLesson('module-one', 'intro');
    });
    expect(stored()['module-one'].completedLessons).toEqual(['intro']);
    expect(stored()['module-one'].completedAt).toEqual({ intro: 1_726_000_000_000 });
  });

  it('uncompletes a lesson without touching the visit, and writes nothing when it was not done', async () => {
    const { result } = renderHook(() => useCurriculumProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.completeLesson('module-one', 'intro');
      result.current.completeLesson('module-one', 'wrap-up');
    });
    expect(result.current.getModuleProgress('module-one')).toBe(67);

    act(() => {
      result.current.uncompleteLesson('module-one', 'intro');
    });
    expect(stored()['module-one'].completedLessons).toEqual(['wrap-up']);
    expect(stored()['module-one'].completedAt).toEqual({ 'wrap-up': 1_726_000_000_000 });
    expect(stored()['module-one'].lastVisitedLesson).toBe('wrap-up');
    expect(result.current.progress['module-one']?.completedLessons).toEqual(['wrap-up']);
    expect(result.current.getModuleProgress('module-one')).toBe(33);

    const before = localStorage.getItem(STORAGE_KEY);
    const setItem = vi.spyOn(localStorage, 'setItem');
    act(() => {
      result.current.uncompleteLesson('module-one', 'deep-dive');
      result.current.uncompleteLesson('module-unknown', 'intro');
    });
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('keeps two hook instances on one snapshot, so neither overwrites the other', async () => {
    const tracker = renderHook(() => useCurriculumProgress());
    const toggle = renderHook(() => useCurriculumProgress());
    await waitFor(() => expect(toggle.result.current.isLoaded).toBe(true));

    act(() => {
      tracker.result.current.recordLessonVisit('module-one', 'deep-dive');
    });
    act(() => {
      toggle.result.current.completeLesson('module-one', 'intro');
    });

    for (const instance of [tracker, toggle]) {
      expect(instance.result.current.progress['module-one']?.completedLessons).toEqual(['intro']);
      expect(instance.result.current.progress).toBe(tracker.result.current.progress);
    }
    expect(stored()['module-one'].completedLessons).toEqual(['intro']);
  });

  it('picks up a write from another tab through the storage event', async () => {
    const { result } = renderHook(() => useCurriculumProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.progress).toEqual({});

    const otherTab = JSON.stringify({ 'module-one': { completedLessons: ['intro', 'deep-dive'], lastVisitedAt: 5, lastVisitedLesson: 'deep-dive' } });
    localStorage.setItem(STORAGE_KEY, otherTab);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: otherTab }));
    });

    expect(result.current.progress['module-one']?.completedLessons).toEqual(['intro', 'deep-dive']);
    expect(result.current.getModuleProgress('module-one')).toBe(67);

    // This tab's next write builds on the other tab's data instead of a stale snapshot.
    act(() => {
      result.current.completeLesson('module-one', 'wrap-up');
    });
    expect(stored()['module-one'].completedLessons).toEqual(['intro', 'deep-dive', 'wrap-up']);
  });

  it('copies an unreadable value to the recovered key before the first write over it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(STORAGE_KEY, '{"module-one": not json');

    const { result } = renderHook(() => useCurriculumProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.progress).toEqual({});
    // Reading never overwrites it.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"module-one": not json');

    act(() => {
      result.current.recordLessonVisit('module-one', 'intro');
    });

    expect(localStorage.getItem(RECOVERED_KEY)).toBe('{"module-one": not json');
    expect(stored()['module-one'].lastVisitedLesson).toBe('intro');
    expect(warn).toHaveBeenCalled();
  });

  it('renders the empty, not-loaded state during the server render whatever is stored', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'module-one': { completedLessons: ['intro'] } }));
    function Probe() {
      const { progress, isLoaded, getModuleProgress } = useCurriculumProgress();
      return React.createElement('p', null, `${String(isLoaded)}:${Object.keys(progress).length}:${getModuleProgress('module-one')}`);
    }
    expect(renderToString(React.createElement(Probe))).toContain('false:0:0');
  });
});
