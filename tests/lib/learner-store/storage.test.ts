import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetStorageForTests,
  dropMemoryOverlay,
  entryBytes,
  estimateBytes,
  getStorageStatus,
  hasMemoryOverlay,
  isQuotaExceededError,
  safeStorage,
  subscribeStorageStatus,
} from '@/lib/learner-store/storage';

const originalStorage = window.localStorage;

function memoryStorage(overrides: Partial<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>> = {}): Storage & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: overrides.getItem ?? ((key: string) => values.get(key) ?? null),
    setItem: overrides.setItem ?? ((key: string, value: string) => void values.set(key, String(value))),
    removeItem: overrides.removeItem ?? ((key: string) => void values.delete(key)),
  };
}

function useStorage(storage: Storage | null | (() => never)): void {
  if (typeof storage === 'function') {
    Object.defineProperty(window, 'localStorage', { get: storage, configurable: true });
  } else {
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true });
  }
}

function quotaError(name = 'QuotaExceededError'): DOMException {
  return new DOMException('The quota has been exceeded.', name);
}

/** localStorage that refuses every write except the probe, as when the quota is used up. */
function fullStorage(): ReturnType<typeof memoryStorage> & { full: boolean } {
  const storage = Object.assign(
    memoryStorage({
      setItem(key: string, value: string) {
        if (storage.full && key !== '__sv-uvm-guide-storage-probe__') throw quotaError();
        storage.values.set(key, value);
      },
    }),
    { full: true },
  );
  return storage;
}

function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

describe('safeStorage', () => {
  beforeEach(() => {
    __resetStorageForTests();
    originalStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', { value: originalStorage, configurable: true, writable: true });
    originalStorage.clear();
    vi.unstubAllGlobals();
    __resetStorageForTests();
  });

  it('round-trips values through localStorage when it is available', () => {
    expect(safeStorage.set('sv-uvm-guide:meta', '{"v":1}')).toBe('saved');
    expect(safeStorage.set('sv-uvm-guide:lab:a@1', 'x')).toBe('saved');
    expect(safeStorage.set('theme', 'dark')).toBe('saved');

    expect(getStorageStatus()).toBe('available');
    expect(safeStorage.get('sv-uvm-guide:meta')).toBe('{"v":1}');
    expect(originalStorage.getItem('sv-uvm-guide:meta')).toBe('{"v":1}');
    expect(safeStorage.keys('sv-uvm-guide:').sort()).toEqual(['sv-uvm-guide:lab:a@1', 'sv-uvm-guide:meta']);

    safeStorage.remove('sv-uvm-guide:meta');
    expect(safeStorage.get('sv-uvm-guide:meta')).toBeNull();
    expect(originalStorage.getItem('sv-uvm-guide:meta')).toBeNull();
    expect(originalStorage.getItem('__sv-uvm-guide-storage-probe__')).toBeNull();
  });

  it('falls back to memory with status unavailable when localStorage throws a SecurityError', () => {
    useStorage(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    expect(safeStorage.set('sv-uvm-guide:flashcards', '{"v":1,"data":{}}')).toBe('memory-only');
    expect(getStorageStatus()).toBe('unavailable');
    expect(safeStorage.get('sv-uvm-guide:flashcards')).toBe('{"v":1,"data":{}}');
    expect(safeStorage.keys('sv-uvm-guide:')).toEqual(['sv-uvm-guide:flashcards']);

    safeStorage.remove('sv-uvm-guide:flashcards');
    expect(safeStorage.get('sv-uvm-guide:flashcards')).toBeNull();
  });

  it('treats a missing localStorage (TypeError) as unavailable', () => {
    useStorage(null);

    expect(getStorageStatus()).toBe('unavailable');
    expect(safeStorage.set('sv-uvm-guide:meta', '1')).toBe('memory-only');
    expect(safeStorage.get('sv-uvm-guide:meta')).toBe('1');
  });

  it('keeps a value readable for this session with status full when the quota is exceeded', () => {
    let full = true;
    const storage = memoryStorage({
      setItem(key: string, value: string) {
        if (full && key !== '__sv-uvm-guide-storage-probe__') throw quotaError();
        storage.values.set(key, value);
      },
    });
    useStorage(storage);
    const onStatus = vi.fn();
    subscribeStorageStatus(onStatus);

    expect(getStorageStatus()).toBe('available');
    expect(safeStorage.set('sv-uvm-guide:notebook:n1', 'body')).toBe('memory-only');
    expect(getStorageStatus()).toBe('full');
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(safeStorage.get('sv-uvm-guide:notebook:n1')).toBe('body');
    expect(storage.values.has('sv-uvm-guide:notebook:n1')).toBe(false);
    expect(safeStorage.keys('sv-uvm-guide:notebook:')).toEqual(['sv-uvm-guide:notebook:n1']);

    // Space frees up: the next write of that value lands and the status recovers.
    full = false;
    expect(safeStorage.set('sv-uvm-guide:notebook:n1', 'body 2')).toBe('saved');
    expect(storage.values.get('sv-uvm-guide:notebook:n1')).toBe('body 2');
    expect(getStorageStatus()).toBe('available');
    expect(onStatus).toHaveBeenCalledTimes(2);
  });

  it('drops a memory copy once another tab saves the key, so reads return the newer saved value', async () => {
    const storage = fullStorage();
    storage.values.set('sv-uvm-guide:flashcards', 'saved 0');
    useStorage(storage);

    expect(safeStorage.set('sv-uvm-guide:flashcards', 'memory 1')).toBe('memory-only');
    expect(safeStorage.get('sv-uvm-guide:flashcards')).toBe('memory 1');
    expect(hasMemoryOverlay('sv-uvm-guide:flashcards')).toBe(true);
    expect(getStorageStatus()).toBe('full');

    // Another tab saves the key; no 'storage' event has arrived yet.
    storage.values.set('sv-uvm-guide:flashcards', 'other tab 9');
    expect(safeStorage.get('sv-uvm-guide:flashcards')).toBe('other tab 9');
    expect(hasMemoryOverlay('sv-uvm-guide:flashcards')).toBe(false);

    // The status relaxes outside the read, which may run during a render.
    expect(getStorageStatus()).toBe('full');
    await flushMicrotasks();
    expect(getStorageStatus()).toBe('available');
  });

  it('leaves a key out of keys() once another tab removes the value its memory copy shadowed', async () => {
    const storage = fullStorage();
    storage.values.set('sv-uvm-guide:notebook:a', 'saved a');
    useStorage(storage);

    expect(safeStorage.set('sv-uvm-guide:notebook:a', 'memory a')).toBe('memory-only');
    expect(safeStorage.set('sv-uvm-guide:notebook:b', 'memory b')).toBe('memory-only');
    expect(safeStorage.keys('sv-uvm-guide:notebook:').sort()).toEqual(['sv-uvm-guide:notebook:a', 'sv-uvm-guide:notebook:b']);

    storage.values.delete('sv-uvm-guide:notebook:a');
    expect(safeStorage.keys('sv-uvm-guide:notebook:')).toEqual(['sv-uvm-guide:notebook:b']);
    expect(safeStorage.get('sv-uvm-guide:notebook:a')).toBeNull();
    expect(safeStorage.get('sv-uvm-guide:notebook:b')).toBe('memory b');

    // b is still held only in memory, so the status stays 'full'.
    await flushMicrotasks();
    expect(getStorageStatus()).toBe('full');
  });

  it("drops memory copies for a 'storage' event's key, or every one for a null key", () => {
    const storage = fullStorage();
    useStorage(storage);
    safeStorage.set('sv-uvm-guide:meta', 'memory meta');
    safeStorage.set('sv-uvm-guide:flashcards', 'memory cards');
    safeStorage.set('sv-uvm-guide:lessons', 'memory lessons');

    // The other tab may have saved the very value this one shadowed; the event still wins.
    dropMemoryOverlay('sv-uvm-guide:meta');
    expect(safeStorage.get('sv-uvm-guide:meta')).toBeNull();
    expect(safeStorage.get('sv-uvm-guide:flashcards')).toBe('memory cards');
    expect(getStorageStatus()).toBe('full');

    dropMemoryOverlay(null);
    expect(safeStorage.get('sv-uvm-guide:flashcards')).toBeNull();
    expect(safeStorage.get('sv-uvm-guide:lessons')).toBeNull();
    expect(safeStorage.keys('sv-uvm-guide:')).toEqual([]);
    expect(getStorageStatus()).toBe('available');
  });

  it('keeps memory copies while localStorage cannot be read, since they are the only copy', () => {
    useStorage(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    safeStorage.set('sv-uvm-guide:meta', 'only copy');

    dropMemoryOverlay('sv-uvm-guide:meta');
    dropMemoryOverlay(null);
    expect(safeStorage.get('sv-uvm-guide:meta')).toBe('only copy');
    expect(hasMemoryOverlay('sv-uvm-guide:meta')).toBe(true);
    expect(getStorageStatus()).toBe('unavailable');
  });

  it('returns failed and keeps nothing when the caller asks for no memory fallback', () => {
    useStorage(
      memoryStorage({
        setItem(key: string) {
          if (key !== '__sv-uvm-guide-storage-probe__') throw quotaError('NS_ERROR_DOM_QUOTA_REACHED');
        },
      }),
    );

    expect(safeStorage.set('sv-uvm-guide:recovered:x', 'raw', { memoryFallback: false })).toBe('failed');
    expect(getStorageStatus()).toBe('full');
    expect(safeStorage.get('sv-uvm-guide:recovered:x')).toBeNull();
  });

  it('starts as full when the probe write hits the quota, and still reads stored values', () => {
    const storage = memoryStorage({
      setItem() {
        throw quotaError();
      },
    });
    storage.values.set('sv-uvm-guide:meta', 'stored');
    useStorage(storage);

    expect(getStorageStatus()).toBe('full');
    expect(safeStorage.get('sv-uvm-guide:meta')).toBe('stored');
  });

  it('recognises the quota errors browsers throw', () => {
    expect(isQuotaExceededError(quotaError())).toBe(true);
    expect(isQuotaExceededError(quotaError('NS_ERROR_DOM_QUOTA_REACHED'))).toBe(true);
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(isQuotaExceededError({ code: 1014 })).toBe(true);
    expect(isQuotaExceededError(new DOMException('x', 'SecurityError'))).toBe(false);
    expect(isQuotaExceededError(new TypeError('x'))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
  });

  it('notifies status subscribers on changes and stops after unsubscribe', () => {
    let fail = false;
    useStorage(
      memoryStorage({
        setItem(key: string) {
          if (fail && key !== '__sv-uvm-guide-storage-probe__') throw new DOMException('denied', 'SecurityError');
        },
      }),
    );
    const listener = vi.fn();
    const unsubscribe = subscribeStorageStatus(listener);

    fail = true;
    safeStorage.set('sv-uvm-guide:meta', '1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getStorageStatus()).toBe('unavailable');

    unsubscribe();
    fail = false;
    safeStorage.remove('sv-uvm-guide:meta');
    safeStorage.set('sv-uvm-guide:meta', '2');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does nothing on the server: no writes, no memory map and no listeners', () => {
    vi.stubGlobal('window', undefined);

    expect(safeStorage.set('sv-uvm-guide:meta', 'server')).toBe('not-in-browser');
    expect(safeStorage.get('sv-uvm-guide:meta')).toBeNull();
    expect(safeStorage.keys()).toEqual([]);
    safeStorage.remove('sv-uvm-guide:meta');
    expect(getStorageStatus()).toBe('available');
    const unsubscribe = subscribeStorageStatus(() => undefined);
    expect(typeof unsubscribe).toBe('function');
    expect(estimateBytes()).toBe(0);
    expect(hasMemoryOverlay('sv-uvm-guide:meta')).toBe(false);
    dropMemoryOverlay(null);

    vi.unstubAllGlobals();
    expect(originalStorage.length).toBe(0);
    expect(safeStorage.get('sv-uvm-guide:meta')).toBeNull();
  });

  it('estimates 2 bytes per UTF-16 unit of key plus value for learner keys only', () => {
    safeStorage.set('sv-uvm-guide:flashcards', 'abc');
    safeStorage.set('curriculumProgress', '{}');
    safeStorage.set('sv-uvm-guide:notebook:é', 'ü');
    safeStorage.set('theme', 'dark');
    safeStorage.set('sv-uvm:outline-collapsed', '1');

    expect(entryBytes('ab', 'c')).toBe(6);
    expect(estimateBytes()).toBe(
      entryBytes('sv-uvm-guide:flashcards', 'abc') + entryBytes('curriculumProgress', '{}') + entryBytes('sv-uvm-guide:notebook:é', 'ü'),
    );
    expect(estimateBytes(['theme'])).toBe((5 + 4) * 2);
  });
});
