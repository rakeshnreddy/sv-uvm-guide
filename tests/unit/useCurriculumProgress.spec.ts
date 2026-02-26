import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCurriculumProgress } from '@/hooks/useCurriculumProgress';

const MODULE_ID = 'I-SV-2_Constrained_Randomization';
const LESSON_SLUG = 'index';
const SECOND_LESSON_SLUG = 'advanced-constraints';

describe('useCurriculumProgress', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2024-01-01T00:00:00.000Z').valueOf());
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('records lesson visits and persists metadata to storage', async () => {
    const { result } = renderHook(() => useCurriculumProgress());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.recordLessonVisit(MODULE_ID, LESSON_SLUG);
    });

    await waitFor(() => expect(result.current.progress[MODULE_ID]).toBeDefined());

    const moduleProgress = result.current.progress[MODULE_ID];
    expect(moduleProgress?.lastVisitedLesson).toBe(LESSON_SLUG);
    expect(moduleProgress?.completedLessons).toEqual([]);
    expect(moduleProgress?.lastVisitedAt).toBe(Date.now());

    const persisted = JSON.parse(localStorage.getItem('curriculumProgress') ?? '{}');
    expect(persisted[MODULE_ID]?.lastVisitedLesson).toBe(LESSON_SLUG);
  });

  it('tracks lesson completion without duplicates and reports module progress', async () => {
    const { result } = renderHook(() => useCurriculumProgress());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.completeLesson(MODULE_ID, LESSON_SLUG);
      result.current.completeLesson(MODULE_ID, SECOND_LESSON_SLUG);
      result.current.completeLesson(MODULE_ID, LESSON_SLUG);
    });

    await waitFor(() =>
      expect(result.current.progress[MODULE_ID]?.completedLessons.length).toBe(2),
    );

    expect(result.current.progress[MODULE_ID]?.completedLessons).toEqual(
      expect.arrayContaining([LESSON_SLUG, SECOND_LESSON_SLUG]),
    );
    expect(result.current.getModuleProgress(MODULE_ID)).toBe(50);
  });
});
