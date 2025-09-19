import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useExerciseProgress } from '@/hooks/useExerciseProgress';

describe('useExerciseProgress', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('records attempts in progress and analytics history', () => {
    const { result } = renderHook(() => useExerciseProgress('example-exercise'));

    act(() => {
      result.current.recordAttempt(80);
    });

    expect(result.current.progress.bestScore).toBe(80);
    expect(result.current.progress.attempts).toBe(1);
    expect(result.current.analytics.history).toHaveLength(1);
    expect(result.current.analytics.history[0].type).toBe('assessment');
    expect(result.current.analytics.history[0].value).toBe(80);
  });

  it('logs interactions separately from assessment attempts', () => {
    const { result } = renderHook(() => useExerciseProgress('example-exercise'));

    act(() => {
      result.current.logInteraction();
      result.current.logInteraction();
    });

    expect(result.current.analytics.history).toHaveLength(2);
    expect(result.current.analytics.engagement).toBe(2);
    expect(result.current.analytics.competency).toBe(0);
  });
});
