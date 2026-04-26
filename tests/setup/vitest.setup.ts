import '@testing-library/jest-dom/vitest';
import { afterAll, beforeAll, vi } from 'vitest';

process.env.SESSION_SECRET = 'test-session-secret-32-bytes-minimum';

const originalWarn = console.warn;
let warnSpy: ReturnType<typeof vi.spyOn> | undefined;

if (typeof document !== 'undefined' && !document.queryCommandSupported) {
  document.queryCommandSupported = () => false;
}
if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).postMessage) {
    (globalThis as any).postMessage = () => { };
  }
  if (!(globalThis as any).CSS) {
    (globalThis as any).CSS = { escape: (v: string) => v };
  }
}

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
