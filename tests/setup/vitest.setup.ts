import '@testing-library/jest-dom/vitest';
import { afterAll, beforeAll, vi } from 'vitest';

const originalWarn = console.warn;
let warnSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeAll(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
    const [first] = args;
    if (typeof first === 'string' && first.includes('Could not load source map')) {
      return;
    }
    originalWarn(...args);
  });
});

afterAll(() => {
  warnSpy?.mockRestore();
});
