/**
 * safeStorage: localStorage that never throws.
 *
 * On first use in the browser it probes localStorage:
 * - 'available': reads and writes go to localStorage.
 * - 'unavailable' (SecurityError, TypeError or any other access error, as in
 *   some private windows or with site data blocked): values that cannot be
 *   written live in an in-memory Map for this page load.
 * - 'full' (a quota error): reads still come from localStorage, and values
 *   that could not be written stay readable for this session in a memory
 *   overlay. A later successful write that leaves the overlay empty returns
 *   the status to 'available'.
 *
 * Each overlay entry remembers the localStorage value it shadows. When that
 * saved value changes (another tab, or code writing localStorage directly,
 * saved the key since), the entry is older than what is saved: get and keys
 * drop it and return the saved value, so a fresh read never builds on a stale
 * memory copy, and a failed set records the value it now shadows.
 * dropMemoryOverlay() drops entries when a 'storage' event arrives. Entries
 * are kept while localStorage cannot be read, because the memory copy is then
 * the only one.
 *
 * On the server (no window) it is a no-op: get returns null, set returns
 * 'not-in-browser', keys is empty, and there is no memory map and no
 * listeners, so nothing can leak between requests in a Worker.
 */
import { isLearnerKey } from './keys';

export type StorageStatus = 'available' | 'unavailable' | 'full';

/** 'failed' only when the caller asked for no memory fallback. */
export type StorageSetResult = 'saved' | 'memory-only' | 'failed' | 'not-in-browser';

export interface StorageSetOptions {
  /** Keep the value in memory when the write hits the quota (default true). With false a quota error returns 'failed' and changes nothing. */
  memoryFallback?: boolean;
}

export interface SafeStorage {
  get(key: string): string | null;
  set(key: string, value: string, options?: StorageSetOptions): StorageSetResult;
  remove(key: string): void;
  /** Every key starting with `prefix` (all keys when omitted), from localStorage and the memory overlay. */
  keys(prefix?: string): string[];
}

const PROBE_KEY = '__sv-uvm-guide-storage-probe__';

interface OverlayEntry {
  value: string;
  /** The localStorage value this entry shadows (null when absent); undefined when localStorage could not be read. */
  baseRaw: string | null | undefined;
}

let probed = false;
let status: StorageStatus = 'available';
/** Browser only: every value while 'unavailable'; values that hit the quota while 'full'. */
let memory: Map<string, OverlayEntry> | null = null;
let relaxPending = false;
const statusListeners = new Set<() => void>();

function inBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** True for the quota errors browsers throw: QuotaExceededError (codes 22, 1014) and Firefox's NS_ERROR_DOM_QUOTA_REACHED. */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

function setStatus(next: StorageStatus): void {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}

function memoryMap(): Map<string, OverlayEntry> {
  if (!memory) memory = new Map();
  return memory;
}

/** Runs the probe once per page load. The initial status is set silently: nobody can have read another value yet. */
function ensureProbed(): void {
  if (probed || !inBrowser()) return;
  probed = true;
  memoryMap();
  try {
    const storage = window.localStorage;
    storage.setItem(PROBE_KEY, '1');
    storage.removeItem(PROBE_KEY);
    status = 'available';
  } catch (error) {
    status = isQuotaExceededError(error) ? 'full' : 'unavailable';
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** localStorage.getItem(key), or undefined when localStorage cannot be read. */
function readStored(storage: Storage | null, key: string): string | null | undefined {
  if (!storage) return undefined;
  try {
    return storage.getItem(key);
  } catch {
    return undefined;
  }
}

function markUnavailable(): void {
  setStatus('unavailable');
}

/** After a successful write or removal: back to 'available' once nothing is held only in memory. */
function relaxStatus(): void {
  if (status !== 'available' && memoryMap().size === 0) setStatus('available');
}

function scheduleMicrotask(task: () => void): void {
  if (typeof queueMicrotask === 'function') queueMicrotask(task);
  else void Promise.resolve().then(task);
}

/**
 * relaxStatus() for a 'full' status, in a microtask: reads can run during a
 * React render, where calling status listeners would update other components.
 * 'unavailable' is left alone, since a read proves nothing about writes.
 */
function relaxStatusSoon(): void {
  if (relaxPending) return;
  relaxPending = true;
  scheduleMicrotask(() => {
    relaxPending = false;
    if (status === 'full') relaxStatus();
  });
}

/**
 * The overlay entry for `key`, unless the localStorage value it shadows has
 * changed since it was stored: then the saved value is newer, so the entry is
 * dropped and undefined returned.
 */
function currentOverlayEntry(key: string, storage: Storage | null): OverlayEntry | undefined {
  const overlay = memoryMap();
  const entry = overlay.get(key);
  if (!entry || entry.baseRaw === undefined) return entry;
  const stored = readStored(storage, key);
  if (stored === undefined || stored === entry.baseRaw) return entry;
  overlay.delete(key);
  relaxStatusSoon();
  return undefined;
}

export const safeStorage: SafeStorage = {
  get(key) {
    if (!inBrowser()) return null;
    ensureProbed();
    const storage = localStorageOrNull();
    const entry = currentOverlayEntry(key, storage);
    if (entry) return entry.value;
    if (!storage) {
      markUnavailable();
      return null;
    }
    try {
      return storage.getItem(key);
    } catch {
      markUnavailable();
      return null;
    }
  },

  set(key, value, options) {
    if (!inBrowser()) return 'not-in-browser';
    ensureProbed();
    const overlay = memoryMap();
    const storage = localStorageOrNull();
    try {
      if (!storage) throw new TypeError('localStorage is not available');
      storage.setItem(key, value);
      overlay.delete(key);
      relaxStatus();
      return 'saved';
    } catch (error) {
      if (isQuotaExceededError(error)) {
        setStatus('full');
        if (options?.memoryFallback === false) return 'failed';
      } else {
        markUnavailable();
      }
      // Remember the saved value this shadows, so a newer save from another tab wins over it.
      overlay.set(key, { value, baseRaw: readStored(storage, key) });
      return 'memory-only';
    }
  },

  remove(key) {
    if (!inBrowser()) return;
    ensureProbed();
    memoryMap().delete(key);
    const storage = localStorageOrNull();
    try {
      storage?.removeItem(key);
    } catch {
      markUnavailable();
      return;
    }
    if (status === 'full') relaxStatus();
  },

  keys(prefix = '') {
    if (!inBrowser()) return [];
    ensureProbed();
    const found = new Set<string>();
    const storage = localStorageOrNull();
    try {
      if (storage) {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key !== null && key !== PROBE_KEY && key.startsWith(prefix)) found.add(key);
        }
      }
    } catch {
      markUnavailable();
    }
    for (const key of [...memoryMap().keys()]) {
      if (key.startsWith(prefix) && currentOverlayEntry(key, storage)) found.add(key);
    }
    return [...found];
  },
};

/** True when this tab holds `key` only in memory because it could not be saved to localStorage. False on the server. */
export function hasMemoryOverlay(key: string): boolean {
  if (!inBrowser()) return false;
  ensureProbed();
  return currentOverlayEntry(key, localStorageOrNull()) !== undefined;
}

/**
 * Call when a 'storage' event says another tab saved `key` (every key when
 * null): the values this tab held only in memory for it are older, so they are
 * dropped and reads return what was saved. Entries are kept while localStorage
 * cannot be read. A no-op on the server.
 */
export function dropMemoryOverlay(key: string | null): void {
  if (!inBrowser() || !memory || memory.size === 0) return;
  const storage = localStorageOrNull();
  const candidates = key === null ? [...memory.keys()] : memory.has(key) ? [key] : [];
  let dropped = false;
  for (const candidate of candidates) {
    const entry = memory.get(candidate);
    if (!entry || entry.baseRaw === undefined || readStored(storage, candidate) === undefined) continue;
    memory.delete(candidate);
    dropped = true;
  }
  if (dropped && status === 'full') relaxStatus();
}

/** The current status; 'available' on the server. */
export function getStorageStatus(): StorageStatus {
  if (!inBrowser()) return 'available';
  ensureProbed();
  return status;
}

/** Calls `listener` whenever the status changes. Returns the unsubscribe function; a no-op on the server. */
export function subscribeStorageStatus(listener: () => void): () => void {
  if (!inBrowser()) return () => undefined;
  ensureProbed();
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/** Bytes a key and value take, counting 2 bytes per UTF-16 unit as browsers do against the quota. */
export function entryBytes(key: string, value: string): number {
  return (key.length + value.length) * 2;
}

/**
 * Estimated bytes used by learner data: 2 bytes per UTF-16 unit of key plus
 * value. With no argument it counts every known learner key (isLearnerKey);
 * with `prefixes` it counts keys that start with any of them. 0 on the server.
 */
export function estimateBytes(prefixes?: readonly string[]): number {
  if (!inBrowser()) return 0;
  const matches = prefixes
    ? (key: string) => prefixes.some((prefix) => key.startsWith(prefix))
    : isLearnerKey;
  let total = 0;
  for (const key of safeStorage.keys()) {
    if (!matches(key)) continue;
    const value = safeStorage.get(key);
    if (value !== null) total += entryBytes(key, value);
  }
  return total;
}

/** Test-only: forget the probe, the status, the memory map and the status listeners. */
export function __resetStorageForTests(): void {
  probed = false;
  status = 'available';
  memory = null;
  relaxPending = false;
  statusListeners.clear();
}
