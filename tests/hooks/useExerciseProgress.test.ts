import React from 'react';
import { renderToString } from 'react-dom/server';
import { renderHook, act, render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MAX_ANALYTICS_EVENTS, useExerciseProgress } from '@/hooks/useExerciseProgress';
import { exportLearnerData, importLearnerData, LEARNER_DATA_FORMAT } from '@/lib/learner-store/backup';
import { LEARNER_DATA_CHANGED_EVENT } from '@/lib/learner-store/keys';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests, getStorageStatus } from '@/lib/learner-store/storage';

const PROGRESS_KEY = 'sv-uvm-guide:exercise:example-exercise';
const ANALYTICS_KEY = 'sv-uvm-guide:exercise-analytics:example-exercise';

function storedAnalytics(): { type: string; value: number; timestamp: number }[] {
  return JSON.parse(window.localStorage.getItem(ANALYTICS_KEY) ?? '[]');
}

describe('useExerciseProgress', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('keeps the stored shapes under the same keys', () => {
    const { result } = renderHook(() => useExerciseProgress('example-exercise'));

    act(() => {
      result.current.recordAttempt(60);
    });

    expect(JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? 'null')).toEqual({
      bestScore: 60,
      attempts: 1,
      lastPlayed: expect.any(String),
    });
    expect(storedAnalytics()).toEqual([{ type: 'assessment', value: 60, timestamp: expect.any(Number) }]);

    act(() => {
      result.current.resetProgress();
    });
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(window.localStorage.getItem(ANALYTICS_KEY)).toBeNull();
    expect(result.current.progress).toMatchObject({ bestScore: 0, attempts: 0 });
  });

  it('reads storage only after mount, so the first render matches the server HTML', () => {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ bestScore: 90, attempts: 4 }));
    const getItem = vi.spyOn(window.localStorage, 'getItem');
    const seen: { bestScore: number; reads: number }[] = [];

    function Probe() {
      const { progress } = useExerciseProgress('example-exercise');
      seen.push({ bestScore: progress.bestScore, reads: getItem.mock.calls.length });
      return React.createElement('span', null, `best:${progress.bestScore}`);
    }

    // The server render never touches storage and shows the empty state.
    expect(renderToString(React.createElement(Probe))).toContain('best:0');
    expect(getItem).not.toHaveBeenCalled();

    seen.length = 0;
    const { container } = render(React.createElement(Probe));
    expect(seen[0]).toEqual({ bestScore: 0, reads: 0 });
    // After mount the stored value appears.
    expect(container.textContent).toBe('best:90');
    expect(getItem).toHaveBeenCalledWith(PROGRESS_KEY);
  });

  it("re-reads when another tab changes its keys ('storage'), and ignores other keys", () => {
    const { result } = renderHook(() => useExerciseProgress('example-exercise'));
    expect(result.current.progress.bestScore).toBe(0);

    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ bestScore: 55, attempts: 2 }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'sv-uvm-guide:exercise:another-exercise' }));
    });
    expect(result.current.progress.bestScore).toBe(0);

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_KEY }));
    });
    expect(result.current.progress).toMatchObject({ bestScore: 55, attempts: 2 });

    window.localStorage.setItem(ANALYTICS_KEY, JSON.stringify([{ type: 'interaction', value: 1, timestamp: 1 }]));
    window.localStorage.removeItem(PROGRESS_KEY);
    // A null key means storage was cleared in another tab: everything is read again.
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    expect(result.current.progress).toMatchObject({ bestScore: 0, attempts: 0 });
    expect(result.current.analytics.history).toHaveLength(1);
  });

  it('re-reads on LEARNER_DATA_CHANGED_EVENT, so a reset is never overwritten with old numbers', () => {
    const { result } = renderHook(() => useExerciseProgress('example-exercise'));
    act(() => {
      result.current.recordAttempt(80);
      result.current.recordAttempt(70);
    });
    expect(result.current.progress).toMatchObject({ bestScore: 80, attempts: 2 });

    // What Settings' reset does: remove the keys, then announce the change.
    window.localStorage.removeItem(PROGRESS_KEY);
    window.localStorage.removeItem(ANALYTICS_KEY);
    act(() => {
      window.dispatchEvent(new Event(LEARNER_DATA_CHANGED_EVENT));
    });
    expect(result.current.progress).toMatchObject({ bestScore: 0, attempts: 0 });
    expect(result.current.analytics.history).toHaveLength(0);

    act(() => {
      result.current.recordAttempt(30);
    });
    expect(result.current.progress).toMatchObject({ bestScore: 30, attempts: 1 });
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? 'null')).toMatchObject({ bestScore: 30, attempts: 1 });
  });

  it('builds each attempt on a fresh read, so an import in this tab is kept', () => {
    const { result } = renderHook(() => useExerciseProgress('example-exercise'));
    act(() => {
      result.current.recordAttempt(40);
    });
    // An import wrote newer numbers without announcing them yet.
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ bestScore: 95, attempts: 9 }));
    act(() => {
      result.current.recordAttempt(50);
    });
    expect(result.current.progress).toMatchObject({ bestScore: 95, attempts: 10 });
  });

  it(`keeps only the latest ${MAX_ANALYTICS_EVENTS} analytics events`, () => {
    expect(MAX_ANALYTICS_EVENTS).toBe(200);
    const old = Array.from({ length: 250 }, (_, index) => ({ type: 'interaction', value: 1, timestamp: index }));
    window.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(old));

    const { result } = renderHook(() => useExerciseProgress('example-exercise'));
    expect(result.current.analytics.history).toHaveLength(200);
    expect(result.current.analytics.history[0].timestamp).toBe(50);

    act(() => {
      result.current.recordAttempt(75);
    });
    const stored = storedAnalytics();
    expect(stored).toHaveLength(200);
    expect(stored[0].timestamp).toBe(51);
    expect(stored[stored.length - 1]).toMatchObject({ type: 'assessment', value: 75 });
    expect(result.current.analytics.history).toHaveLength(200);

    act(() => {
      for (let index = 0; index < 20; index += 1) result.current.logInteraction();
    });
    expect(storedAnalytics()).toHaveLength(200);
  });

  it('keeps working in memory when storage cannot be written', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useExerciseProgress('example-exercise'));

    act(() => {
      result.current.recordAttempt(40);
      result.current.recordAttempt(60);
    });

    expect(result.current.progress).toMatchObject({ bestScore: 60, attempts: 2 });
    expect(result.current.analytics.history).toHaveLength(2);
  });

  describe('with storage full: one memory copy for the hook, backups and imports', () => {
    function fillStorage() {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    }

    it('a backup carries the scores this tab could only keep in memory', () => {
      fillStorage();
      const { result } = renderHook(() => useExerciseProgress('example-exercise'));
      act(() => {
        result.current.recordAttempt(70);
      });
      expect(getStorageStatus()).toBe('full');
      expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull();

      const backup = exportLearnerData({ markExported: false });
      expect(JSON.parse(backup.legacy[PROGRESS_KEY])).toMatchObject({ bestScore: 70, attempts: 1 });
      expect(JSON.parse(backup.legacy[ANALYTICS_KEY])).toEqual([{ type: 'assessment', value: 70, timestamp: expect.any(Number) }]);
    });

    it('the hook sees scores an import could only keep in memory', () => {
      fillStorage();
      const { result } = renderHook(() => useExerciseProgress('example-exercise'));
      const backup = {
        format: LEARNER_DATA_FORMAT,
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        records: {},
        legacy: { [PROGRESS_KEY]: JSON.stringify({ bestScore: 95, attempts: 9 }) },
        recovered: {},
      };

      act(() => {
        expect(importLearnerData(backup, 'merge')).toMatchObject({ ok: true, memoryOnly: 1 });
      });
      expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull();
      expect(result.current.progress).toMatchObject({ bestScore: 95, attempts: 9 });

      // The next attempt builds on the imported numbers.
      act(() => {
        result.current.recordAttempt(40);
      });
      expect(result.current.progress).toMatchObject({ bestScore: 95, attempts: 10 });
    });
  });
});
