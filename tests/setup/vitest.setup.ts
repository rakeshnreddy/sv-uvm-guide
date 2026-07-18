import '@testing-library/jest-dom/vitest';
import { afterAll, beforeAll, vi } from 'vitest';

process.env.SESSION_SECRET = 'test-session-secret-32-bytes-minimum';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

// Node 25 exposes an incomplete experimental global localStorage unless it is
// launched with a backing file. Pin tests to an isolated in-memory Storage so
// browser hooks see the same deterministic contract under every Node release.
const localStorageMock = createMemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  });
}

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
