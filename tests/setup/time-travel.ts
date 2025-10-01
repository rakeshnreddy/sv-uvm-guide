import { vi } from 'vitest';

type SupportedTimeInput = string | number | Date;

const toDate = (value: SupportedTimeInput): Date => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  return new Date(value);
};

const getCurrentMockTime = (): number => {
  const mocked = vi.getMockedSystemTime();
  return typeof mocked === 'number' ? mocked : Date.now();
};

export type FrozenTimeControls = {
  now: () => Date;
  set: (value: SupportedTimeInput) => void;
  advance: (milliseconds: number) => void;
};

export const withFrozenTime = async <T>(
  value: SupportedTimeInput,
  run: (controls: FrozenTimeControls) => Promise<T> | T,
): Promise<T> => {
  const initial = toDate(value);
  vi.useFakeTimers();
  vi.setSystemTime(initial);

  const controls: FrozenTimeControls = {
    now: () => new Date(getCurrentMockTime()),
    set: (next) => {
      const nextDate = toDate(next);
      vi.setSystemTime(nextDate);
    },
    advance: (milliseconds) => {
      vi.advanceTimersByTime(milliseconds);
    },
  };

  try {
    return await run(controls);
  } finally {
    vi.useRealTimers();
  }
};
