import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetRecordsForTests,
  defineKeyedRecord,
  defineRecord,
  isPlainObject,
  notifyLearnerStoreChanged,
  subscribeLearnerStore,
  writeOutcomeMessage,
  type WriteOutcome,
} from '@/lib/learner-store/record';
import { __resetStorageForTests, getStorageStatus } from '@/lib/learner-store/storage';

interface Counter {
  count: number;
  label?: string;
}

const EMPTY: Counter = Object.freeze({ count: 0 });
const originalStorage = window.localStorage;
let sequence = 0;

function parseCounter(data: unknown): Counter | null {
  if (!isPlainObject(data) || typeof data.count !== 'number') return null;
  const counter: Counter = { count: data.count };
  if (typeof data.label === 'string') counter.label = data.label;
  return counter;
}

function counterRecord(options: { maxChars?: number; migrations?: Record<number, (data: unknown) => unknown>; version?: number; legacyRaw?: boolean } = {}) {
  sequence += 1;
  return defineRecord<Counter>({
    key: `sv-uvm-guide:test-record-${sequence}`,
    version: options.version ?? 1,
    empty: EMPTY,
    parse: parseCounter,
    migrations: options.migrations,
    legacyRaw: options.legacyRaw,
    maxChars: options.maxChars ?? 10_000,
    merge: (local, incoming) => ({ count: Math.max(local.count, incoming.count) }),
  });
}

function envelope(v: number, data: unknown): string {
  return JSON.stringify({ v, data });
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function useQuotaStorage(isFull: (key: string) => boolean): Map<string, string> {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (isFull(key)) throw new DOMException('full', 'QuotaExceededError');
      values.set(key, String(value));
    },
    removeItem: (key) => void values.delete(key),
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true });
  return values;
}

describe('defineRecord', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    originalStorage.clear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    Object.defineProperty(window, 'localStorage', { value: originalStorage, configurable: true, writable: true });
    originalStorage.clear();
    vi.unstubAllGlobals();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  it('round-trips a value in the versioned envelope', () => {
    const record = counterRecord();

    expect(record.read()).toBe(EMPTY);
    expect(record.write({ count: 3, label: 'three' })).toBe('saved');
    expect(JSON.parse(originalStorage.getItem(record.key) ?? 'null')).toEqual({ v: 1, data: { count: 3, label: 'three' } });
    expect(record.read()).toEqual({ count: 3, label: 'three' });

    record.clear();
    expect(originalStorage.getItem(record.key)).toBeNull();
    expect(record.read()).toBe(EMPTY);
  });

  it('reads corrupt JSON as empty, leaves the raw value alone and logs once', () => {
    const record = counterRecord();
    originalStorage.setItem(record.key, '{not json');

    expect(record.read()).toBe(EMPTY);
    expect(record.read()).toBe(EMPTY);
    originalStorage.setItem(record.key, '{still not json');
    expect(record.read()).toBe(EMPTY);

    expect(originalStorage.getItem(record.key)).toBe('{still not json');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(record.inspect()).toMatchObject({ status: 'corrupt', raw: '{still not json', value: EMPTY });
  });

  it('reads data that fails parse as empty without touching it', () => {
    const record = counterRecord();
    originalStorage.setItem(record.key, envelope(1, { count: 'many' }));

    expect(record.read()).toBe(EMPTY);
    expect(originalStorage.getItem(record.key)).toBe(envelope(1, { count: 'many' }));
  });

  it('copies a corrupt raw value to recovered:<key> before the first write over it', () => {
    const record = counterRecord();
    originalStorage.setItem(record.key, '{broken');

    expect(record.write({ count: 1 })).toBe('saved');
    expect(originalStorage.getItem(`sv-uvm-guide:recovered:${record.key}`)).toBe('{broken');
    expect(record.read()).toEqual({ count: 1 });

    // Later writes are over valid data, so the recovered copy is not replaced.
    expect(record.write({ count: 2 })).toBe('saved');
    expect(originalStorage.getItem(`sv-uvm-guide:recovered:${record.key}`)).toBe('{broken');
  });

  it("returns 'blocked-corrupt' and changes nothing when the recovered copy cannot be saved", () => {
    const record = counterRecord();
    const values = useQuotaStorage((key) => key.startsWith('sv-uvm-guide:recovered:'));
    values.set(record.key, '{broken');

    expect(record.write({ count: 1 })).toBe('blocked-corrupt');
    expect(record.update(() => ({ count: 5 }))).toBe('blocked-corrupt');
    expect(values.get(record.key)).toBe('{broken');
    expect(values.has(`sv-uvm-guide:recovered:${record.key}`)).toBe(false);
    expect(record.read()).toBe(EMPTY);
  });

  it('migrates an older version and writes it back outside render', async () => {
    const record = counterRecord({
      version: 1,
      migrations: { 0: (data) => ({ count: Number((data as { total: string }).total) }) },
    });
    originalStorage.setItem(record.key, envelope(0, { total: '7' }));

    expect(record.read()).toEqual({ count: 7 });
    expect(originalStorage.getItem(record.key)).toBe(envelope(0, { total: '7' }));

    await flushMicrotasks();
    expect(originalStorage.getItem(record.key)).toBe(envelope(1, { count: 7 }));
    expect(record.read()).toEqual({ count: 7 });
  });

  it('treats an older version without a migration as corrupt', () => {
    const record = counterRecord({ version: 2 });
    originalStorage.setItem(record.key, envelope(1, { count: 1 }));

    expect(record.read()).toBe(EMPTY);
    expect(record.inspect().status).toBe('corrupt');
  });

  it('refuses to write over a newer version and preserves it', () => {
    const record = counterRecord();
    const newer = envelope(2, { count: 99, extra: true });
    originalStorage.setItem(record.key, newer);
    const fn = vi.fn((current: Counter) => ({ count: current.count + 1 }));

    expect(record.read()).toBe(EMPTY);
    expect(record.write({ count: 1 })).toBe('blocked-newer-version');
    expect(record.update(fn)).toBe('blocked-newer-version');
    expect(fn).not.toHaveBeenCalled();
    expect(originalStorage.getItem(record.key)).toBe(newer);
    expect(record.inspect()).toMatchObject({ status: 'newer', storedVersion: 2 });
  });

  it("returns 'too-large' and writes nothing past maxChars", () => {
    const record = counterRecord({ maxChars: 40 });
    expect(record.write({ count: 1 })).toBe('saved');
    const before = originalStorage.getItem(record.key);

    expect(record.write({ count: 2, label: 'x'.repeat(100) })).toBe('too-large');
    expect(originalStorage.getItem(record.key)).toBe(before);
    expect(record.read()).toEqual({ count: 1 });
  });

  it("keeps the value in memory and returns 'memory-only' on a quota error", () => {
    const record = counterRecord();
    useQuotaStorage((key) => key === record.key);

    expect(record.write({ count: 4 })).toBe('memory-only');
    expect(getStorageStatus()).toBe('full');
    expect(record.read()).toEqual({ count: 4 });
  });

  it("builds update() on another tab's value after a quota failure kept this tab's value in memory", () => {
    const record = counterRecord();
    let full = true;
    const values = useQuotaStorage((key) => full && key === record.key);
    const unsubscribe = record.subscribe(() => undefined);

    // This tab's update hits the quota: its value is kept for this visit only.
    expect(record.update((current) => ({ count: current.count + 1 }))).toBe('memory-only');
    expect(record.read()).toEqual({ count: 1 });

    // Another tab saves a newer value and its 'storage' event arrives.
    values.set(record.key, envelope(1, { count: 9 }));
    window.dispatchEvent(new StorageEvent('storage', { key: record.key }));
    expect(record.read()).toEqual({ count: 9 });

    // The next update here builds on the other tab's value, not on the stale memory copy.
    full = false;
    expect(record.update((current) => ({ count: current.count + 1 }))).toBe('saved');
    expect(values.get(record.key)).toBe(envelope(1, { count: 10 }));
    expect(getStorageStatus()).toBe('available');
    unsubscribe();
  });

  it("builds update() on another tab's value after a quota failure even before its 'storage' event", () => {
    const record = counterRecord();
    const values = useQuotaStorage((key) => key === record.key);
    values.set(record.key, envelope(1, { count: 1 }));

    expect(record.update((current) => ({ count: current.count + 1 }))).toBe('memory-only');
    expect(record.read()).toEqual({ count: 2 });

    values.set(record.key, envelope(1, { count: 9 }));
    expect(record.update((current) => ({ count: current.count + 1 }))).toBe('memory-only');
    expect(record.read()).toEqual({ count: 10 });
  });

  it("reports 'memory-only' for an unchanged update while the value is held only in memory", () => {
    const record = counterRecord();
    const saved = counterRecord();
    let full = false;
    useQuotaStorage(() => full);
    expect(saved.write({ count: 1 })).toBe('saved');

    full = true;
    expect(record.write({ count: 4 })).toBe('memory-only');
    expect(getStorageStatus()).toBe('full');
    expect(record.update((current) => current)).toBe('memory-only');
    // Storage is full, but this value is in localStorage: it really is saved.
    expect(saved.update((current) => current)).toBe('saved');

    full = false;
    expect(record.write({ count: 5 })).toBe('saved');
    expect(record.update((current) => current)).toBe('saved');
  });

  it('applies update() to a fresh read, so a value another tab wrote is not lost', () => {
    const record = counterRecord();
    const unsubscribe = record.subscribe(() => undefined);
    record.write({ count: 1 });
    expect(record.read()).toEqual({ count: 1 });

    // Another tab writes directly; no event has arrived yet.
    originalStorage.setItem(record.key, envelope(1, { count: 10 }));
    expect(record.read()).toEqual({ count: 1 });

    expect(record.update((current) => ({ count: current.count + 1 }))).toBe('saved');
    expect(record.read()).toEqual({ count: 11 });
    unsubscribe();
  });

  it('writes nothing when update() returns the current value', () => {
    const record = counterRecord();
    record.write({ count: 2 });
    const setItem = vi.spyOn(originalStorage, 'setItem');

    expect(record.update((current) => current)).toBe('saved');
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('returns the same snapshot object while subscribed and unchanged', () => {
    const record = counterRecord();
    record.write({ count: 5 });
    const getItem = vi.spyOn(originalStorage, 'getItem');
    const unsubscribe = record.subscribe(() => undefined);

    const first = record.read();
    getItem.mockClear();
    expect(record.read()).toBe(first);
    expect(record.read()).toBe(first);
    expect(getItem).not.toHaveBeenCalled();

    unsubscribe();
    getItem.mockRestore();
  });

  it('returns the same object for an unchanged raw value even without subscribers, and re-reads storage', () => {
    const record = counterRecord();
    originalStorage.setItem(record.key, envelope(1, { count: 1 }));
    const first = record.read();

    expect(record.read()).toBe(first);
    originalStorage.setItem(record.key, envelope(1, { count: 2 }));
    expect(record.read()).toEqual({ count: 2 });
  });

  it('notifies subscribers on their own writes and on clear', () => {
    const record = counterRecord();
    const listener = vi.fn();
    const unsubscribe = record.subscribe(listener);

    record.write({ count: 1 });
    record.update((current) => ({ count: current.count + 1 }));
    record.clear();
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    record.write({ count: 9 });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("notifies subscribers on a 'storage' event for the key, or with a null key", () => {
    const record = counterRecord();
    const other = counterRecord();
    const listener = vi.fn();
    const otherListener = vi.fn();
    const unsubscribe = record.subscribe(listener);
    const unsubscribeOther = other.subscribe(otherListener);
    record.write({ count: 1 });
    expect(record.read()).toEqual({ count: 1 });
    listener.mockClear();

    // Another tab writes; until its 'storage' event arrives the cached snapshot stands.
    originalStorage.setItem(record.key, envelope(1, { count: 8 }));
    expect(record.read()).toEqual({ count: 1 });
    window.dispatchEvent(new StorageEvent('storage', { key: record.key }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(otherListener).not.toHaveBeenCalled();
    expect(record.read()).toEqual({ count: 8 });

    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(otherListener).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    unsubscribeOther();
  });

  it('notifies and invalidates every record on notifyLearnerStoreChanged()', () => {
    const record = counterRecord();
    const listener = vi.fn();
    const storeListener = vi.fn();
    const unsubscribe = record.subscribe(listener);
    const unsubscribeStore = subscribeLearnerStore(storeListener);
    record.write({ count: 1 });
    expect(storeListener).toHaveBeenCalledTimes(1);
    listener.mockClear();

    originalStorage.setItem(record.key, envelope(1, { count: 3 }));
    notifyLearnerStoreChanged();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(storeListener).toHaveBeenCalledTimes(2);
    expect(record.read()).toEqual({ count: 3 });
    unsubscribe();
    unsubscribeStore();
  });

  it('stores legacyRaw records as bare JSON', () => {
    const record = counterRecord({ legacyRaw: true });
    originalStorage.setItem(record.key, JSON.stringify({ count: 2 }));

    expect(record.read()).toEqual({ count: 2 });
    expect(record.write({ count: 3 })).toBe('saved');
    expect(originalStorage.getItem(record.key)).toBe(JSON.stringify({ count: 3 }));
    expect(record.fromEnvelope({ count: 4 })).toEqual({ count: 4 });
  });

  it('validates exported envelopes with migrations and refuses newer ones', () => {
    const record = counterRecord({ version: 2, migrations: { 1: (data) => data } });

    expect(record.fromEnvelope({ v: 2, data: { count: 1 } })).toEqual({ count: 1 });
    expect(record.fromEnvelope({ v: 1, data: { count: 1 } })).toEqual({ count: 1 });
    expect(record.fromEnvelope({ v: 3, data: { count: 1 } })).toBeNull();
    expect(record.fromEnvelope({ count: 1 })).toBeNull();
    expect(record.parse({ count: 'x' })).toBeNull();
  });

  it('does nothing on the server', () => {
    const record = counterRecord();
    vi.stubGlobal('window', undefined);

    expect(record.read()).toBe(EMPTY);
    expect(record.write({ count: 1 })).toBe('not-in-browser');
    expect(record.update(() => ({ count: 1 }))).toBe('not-in-browser');
    const unsubscribe = record.subscribe(() => undefined);
    unsubscribe();

    vi.unstubAllGlobals();
    expect(originalStorage.getItem(record.key)).toBeNull();
  });

  it('describes every outcome other than saved for the learner', () => {
    const outcomes: WriteOutcome[] = ['memory-only', 'too-large', 'blocked-newer-version', 'blocked-corrupt'];
    for (const outcome of outcomes) {
      expect(writeOutcomeMessage(outcome)).toMatch(/\S/);
    }
    expect(writeOutcomeMessage('saved')).toBeNull();
    expect(writeOutcomeMessage('not-in-browser')).toBeNull();
  });
});

describe('defineKeyedRecord', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  function notes() {
    sequence += 1;
    return defineKeyedRecord<Counter>({
      prefix: `sv-uvm-guide:test-keyed-${sequence}:`,
      version: 1,
      parse: (data) => parseCounter(data),
      maxChars: 200,
      merge: (local, incoming) => (incoming.count > local.count ? incoming : local),
    });
  }

  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    originalStorage.clear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    Object.defineProperty(window, 'localStorage', { value: originalStorage, configurable: true, writable: true });
    originalStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  it('sets, gets, lists (sorted by id), updates and removes entries', () => {
    const record = notes();

    expect(record.set('b', { count: 2 })).toBe('saved');
    expect(record.set('a', { count: 1 })).toBe('saved');
    expect(originalStorage.getItem(record.keyFor('a'))).toBe(envelope(1, { count: 1 }));
    expect(record.get('a')).toEqual({ count: 1 });
    expect(record.get('missing')).toBeNull();
    expect(record.list()).toEqual([
      { id: 'a', value: { count: 1 } },
      { id: 'b', value: { count: 2 } },
    ]);

    expect(record.update('a', (current) => ({ count: (current?.count ?? 0) + 10 }))).toBe('saved');
    expect(record.get('a')).toEqual({ count: 11 });
    expect(record.update('c', (current) => current)).toBe('saved');
    expect(record.get('c')).toBeNull();

    record.remove('b');
    expect(record.list()).toEqual([{ id: 'a', value: { count: 11 } }]);
    expect(originalStorage.getItem(record.keyFor('b'))).toBeNull();
  });

  it('skips unreadable entries in the list and copies them aside before overwriting', () => {
    const record = notes();
    record.set('ok', { count: 1 });
    originalStorage.setItem(record.keyFor('bad'), 'nope');

    expect(record.list().map((entry) => entry.id)).toEqual(['ok']);
    expect(record.get('bad')).toBeNull();
    expect(record.set('bad', { count: 2 })).toBe('saved');
    expect(originalStorage.getItem(`sv-uvm-guide:recovered:${record.keyFor('bad')}`)).toBe('nope');
  });

  it("enforces maxChars per entry with 'too-large'", () => {
    const record = notes();
    expect(record.set('long', { count: 1, label: 'x'.repeat(300) })).toBe('too-large');
    expect(originalStorage.getItem(record.keyFor('long'))).toBeNull();
  });

  it('returns the same list array while nothing changed, and a new one after a write', () => {
    const record = notes();
    record.set('a', { count: 1 });
    const unsubscribe = record.subscribe(() => undefined);

    const first = record.list();
    expect(record.list()).toBe(first);
    record.set('b', { count: 2 });
    const second = record.list();
    expect(second).not.toBe(first);
    expect(second).toHaveLength(2);
    unsubscribe();

    expect(record.list()).toBe(second);
  });

  it("notifies subscribers on a 'storage' event for any key under the prefix", () => {
    const record = notes();
    const listener = vi.fn();
    const unsubscribe = record.subscribe(listener);

    originalStorage.setItem(record.keyFor('x'), envelope(1, { count: 5 }));
    window.dispatchEvent(new StorageEvent('storage', { key: record.keyFor('x') }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(record.get('x')).toEqual({ count: 5 });
    unsubscribe();
  });

  it('re-reads only the written entry after its own write, keeping the other snapshots', () => {
    const record = notes();
    record.set('a', { count: 1 });
    record.set('b', { count: 2 });
    record.set('c', { count: 3 });
    const unsubscribe = record.subscribe(() => undefined);
    const first = record.list();
    const getItem = vi.spyOn(originalStorage, 'getItem');

    record.set('b', { count: 20 });
    getItem.mockClear();
    const second = record.list();

    expect(getItem.mock.calls.map(([key]) => key)).toEqual([record.keyFor('b')]);
    expect(second).not.toBe(first);
    expect(second[0].value).toBe(first[0].value);
    expect(second[1].value).toEqual({ count: 20 });
    expect(second[2].value).toBe(first[2].value);
    expect(record.get('a')).toBe(first[0].value);

    // A new entry and a removal also re-read nothing but the key scan and that entry.
    record.set('d', { count: 4 });
    record.remove('a');
    getItem.mockClear();
    expect(record.list().map((entry) => entry.id)).toEqual(['b', 'c', 'd']);
    expect(getItem.mock.calls.map(([key]) => key)).toEqual([record.keyFor('d')]);

    getItem.mockRestore();
    unsubscribe();
  });

  it("re-reads only the changed entry on a 'storage' event for it, and every entry for a null key", () => {
    const record = notes();
    record.set('a', { count: 1 });
    record.set('b', { count: 2 });
    const unsubscribe = record.subscribe(() => undefined);
    const first = record.list();
    const getItem = vi.spyOn(originalStorage, 'getItem');

    originalStorage.setItem(record.keyFor('b'), envelope(1, { count: 7 }));
    window.dispatchEvent(new StorageEvent('storage', { key: record.keyFor('b') }));
    getItem.mockClear();
    const second = record.list();
    expect(getItem.mock.calls.map(([key]) => key)).toEqual([record.keyFor('b')]);
    expect(second[0].value).toBe(first[0].value);
    expect(second[1].value).toEqual({ count: 7 });

    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    getItem.mockClear();
    expect(record.list()).toBe(second);
    expect(getItem.mock.calls.map(([key]) => key).sort()).toEqual([record.keyFor('a'), record.keyFor('b')]);

    getItem.mockRestore();
    unsubscribe();
  });

  it("builds update() on another tab's entry after a quota failure and its 'storage' event", () => {
    const record = notes();
    let full = true;
    const values = useQuotaStorage((key) => full && key === record.keyFor('a'));
    const unsubscribe = record.subscribe(() => undefined);

    expect(record.update('a', (current) => ({ count: (current?.count ?? 0) + 1 }))).toBe('memory-only');
    expect(record.update('a', (current) => current)).toBe('memory-only');

    values.set(record.keyFor('a'), envelope(1, { count: 9 }));
    window.dispatchEvent(new StorageEvent('storage', { key: record.keyFor('a') }));
    expect(record.get('a')).toEqual({ count: 9 });

    full = false;
    expect(record.update('a', (current) => ({ count: (current?.count ?? 0) + 1 }))).toBe('saved');
    expect(values.get(record.keyFor('a'))).toBe(envelope(1, { count: 10 }));
    unsubscribe();
  });

  it('applies update() to a fresh read of the entry', () => {
    const record = notes();
    const unsubscribe = record.subscribe(() => undefined);
    record.set('a', { count: 1 });
    expect(record.get('a')).toEqual({ count: 1 });
    originalStorage.setItem(record.keyFor('a'), envelope(1, { count: 20 }));

    record.update('a', (current) => ({ count: (current?.count ?? 0) + 1 }));
    expect(record.get('a')).toEqual({ count: 21 });
    unsubscribe();
  });

  it('rejects an empty id', () => {
    const record = notes();
    expect(() => record.keyFor('')).toThrow(TypeError);
  });
});
