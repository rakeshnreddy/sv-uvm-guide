/**
 * Typed, versioned learner records on top of safeStorage.
 *
 * Storage format: the envelope {"v":<int>,"data":<T>}; legacy keys
 * (legacyRaw) store the bare JSON value instead.
 *
 * Reads never throw and never write over data:
 * - Unparseable JSON, or data that fails `parse`, reads as `empty` (null for a
 *   keyed entry). It is logged once and the raw value is left untouched.
 * - An older `v` runs the migrations in order; the migrated value is written
 *   back in a microtask (never during render).
 * - A newer `v` (written by a newer site) reads as empty, and writes over it
 *   are refused with 'blocked-newer-version', so it is never overwritten.
 *
 * Writes:
 * - `update(fn)` re-reads the raw value from storage, ignoring any cache,
 *   before applying fn, so writes are safe across tabs.
 * - The first write over a corrupt raw value copies it to
 *   'sv-uvm-guide:recovered:<key>'. If that copy cannot be saved, the write
 *   returns 'blocked-corrupt' and changes nothing.
 * - A serialized value longer than `maxChars` returns 'too-large' and nothing
 *   is written.
 * - A quota error keeps the value in a session memory overlay, sets storage
 *   status 'full' and returns 'memory-only'. Once another tab saves the key,
 *   the saved value wins over that memory copy (see storage.ts), so update()
 *   still builds on the newest saved value.
 * - An update() that changes nothing returns 'memory-only' while the value is
 *   held only in memory (or storage is unavailable), and 'saved' otherwise.
 * - On the server every write returns 'not-in-browser'.
 *
 * Caching: parsed snapshots are trusted without touching storage only while a
 * record has subscribers. They are invalidated by this module's own writes, by
 * notifyLearnerStoreChanged() and by window 'storage' events for the key (a
 * null key means every key). A keyed record's own write, removal or 'storage'
 * event for one entry invalidates that entry and the list only: the other
 * entries stay trusted, so a list rebuild re-reads one value plus a key scan.
 * Without subscribers every read checks the raw value in storage, so tests
 * that seed localStorage directly still work; an unchanged raw value returns
 * the same snapshot object, as useSyncExternalStore requires.
 */
import { isLearnerKey, recoveredKeyFor } from './keys';
import { dropMemoryOverlay, getStorageStatus, hasMemoryOverlay, safeStorage } from './storage';

export type WriteOutcome =
  | 'saved'
  | 'memory-only'
  | 'too-large'
  | 'blocked-newer-version'
  | 'blocked-corrupt'
  | 'not-in-browser';

/** How a stored value decoded: absent, current, migrated from an older version, unreadable, or written by a newer version. */
export type RecordReadStatus = 'missing' | 'ok' | 'migrated' | 'corrupt' | 'newer';

export interface RecordInspection<T> {
  status: RecordReadStatus;
  /** The parsed value; the record's empty value (null for a keyed entry) unless status is 'ok' or 'migrated'. */
  value: T;
  /** The raw string in storage, or null when absent. */
  raw: string | null;
  /** The envelope's `v`, or null for a legacy record or an unreadable value. */
  storedVersion: number | null;
}

/** migrations[n] turns data stored at version n into data at version n + 1. */
export type RecordMigrations = Readonly<Record<number, (data: unknown) => unknown>>;

export interface RecordConfig<T> {
  key: string;
  version: number;
  empty: T;
  /** Validates data at the current version. Returns null to reject it; may drop malformed fields. */
  parse: (data: unknown) => T | null;
  migrations?: RecordMigrations;
  /** Stored as bare JSON with no envelope (legacy keys such as 'curriculumProgress'). */
  legacyRaw?: boolean;
  /** Longest serialized value, in characters, that may be written. */
  maxChars: number;
  /** Combines a local value with an incoming one (backup merge). */
  merge: (local: T, incoming: T) => T;
}

export interface LearnerRecord<T> {
  readonly key: string;
  readonly version: number;
  readonly empty: T;
  readonly maxChars: number;
  readonly legacyRaw: boolean;
  /** The current value, or `empty`. Never throws; on the server always `empty`. */
  read(): T;
  write(value: T): WriteOutcome;
  /** Applies fn to a fresh read. Returning the same object writes nothing. */
  update(fn: (current: T) => T): WriteOutcome;
  clear(): void;
  subscribe(listener: () => void): () => void;
  merge(local: T, incoming: T): T;
  /** The record's validator, for imports. */
  parse(data: unknown): T | null;
  /** Validates an exported envelope {v, data} (bare data for legacyRaw), migrating older versions. Null when invalid or newer. */
  fromEnvelope(envelope: unknown): T | null;
  /** A fresh read of what is stored and how it decodes, for exports and diagnostics. */
  inspect(): RecordInspection<T>;
}

export interface KeyedRecordConfig<T> {
  /** The full storage prefix, for example 'sv-uvm-guide:lab:'. */
  prefix: string;
  version: number;
  /** Validates one entry at the current version; `id` is the part of the key after the prefix. */
  parse: (data: unknown, id: string) => T | null;
  migrations?: RecordMigrations;
  /** Longest serialized entry, in characters, that may be written. */
  maxChars: number;
  merge: (local: T, incoming: T) => T;
}

export interface KeyedEntry<T> {
  id: string;
  value: T;
}

export interface KeyedLearnerRecord<T> {
  readonly prefix: string;
  readonly version: number;
  readonly maxChars: number;
  keyFor(id: string): string;
  /** The entry, or null when absent, unreadable or newer. */
  get(id: string): T | null;
  set(id: string, value: T): WriteOutcome;
  /** Applies fn to a fresh read of the entry (null when absent). Returning the same object, or null, writes nothing. */
  update(id: string, fn: (current: T | null) => T | null): WriteOutcome;
  remove(id: string): void;
  /** Every readable entry, sorted by id. */
  list(): readonly KeyedEntry<T>[];
  subscribe(listener: () => void): () => void;
  merge(local: T, incoming: T): T;
  parse(data: unknown, id: string): T | null;
  fromEnvelope(envelope: unknown, id: string): T | null;
  inspect(id: string): RecordInspection<T | null>;
}

// ---------------------------------------------------------------------------
// Small validation helpers shared by the repositories
// ---------------------------------------------------------------------------

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * True for a same-site path such as /curriculum/…, the only kind of link a
 * stored record may carry. Stored values come from this browser's storage and
 * from imported backups, so a scheme (javascript:), a protocol-relative //host,
 * a backslash form or whitespace (which URL parsing strips) is never a link.
 */
export function isSameSitePath(href: string): boolean {
  return /^\/(?![/\\])[^\s\\]*$/.test(href);
}

/** The string items of an array, de-duplicated in order; [] for anything else. */
export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) seen.add(item);
  }
  return [...seen];
}

/** The largest time a Date can hold, in ms either side of the epoch: past it, Date and Intl throw 'Invalid time value'. */
export const MAX_DATE_MS = 8.64e15;

/**
 * A finite, non-negative time that a Date can hold. Every stored time is
 * checked with this, so a value from a hand-edited store or an old backup
 * (1e300, say) never reaches a date formatter.
 */
export function isTimestamp(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= MAX_DATE_MS;
}

/** A finite, non-negative timestamp a Date can hold (isTimestamp), or `fallback`. */
export function timestampOr(value: unknown, fallback: number): number {
  return isTimestamp(value) ? value : fallback;
}

/** A plain object with only the own string keys whose values pass `parse` (which may transform them). */
export function recordOf<V>(value: unknown, parse: (item: unknown, key: string) => V | null): Record<string, V> {
  const result: Record<string, V> = {};
  if (!isPlainObject(value)) return result;
  for (const [key, item] of Object.entries(value)) {
    if (!key) continue;
    const parsed = parse(item, key);
    if (parsed !== null) result[key] = parsed;
  }
  return result;
}

/** Plain-language message for a write outcome, for StorageStatusNote or an inline role=status message. Null for 'saved' and 'not-in-browser'. */
export function writeOutcomeMessage(outcome: WriteOutcome): string | null {
  switch (outcome) {
    case 'saved':
    case 'not-in-browser':
      return null;
    case 'memory-only':
      return "Kept for this visit only: this browser's storage is blocked or full. Download a backup to keep it.";
    case 'too-large':
      return 'Not saved: this is too large to store in this browser. Shorten it, or delete old notes or old lab versions, and try again.';
    case 'blocked-newer-version':
      return 'Not saved: this data was saved by a newer version of the site. Reload the page and try again.';
    case 'blocked-corrupt':
      return "Not saved: the copy stored here can't be read, and there is no room to keep a backup of it. Free some space, then try again.";
  }
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

type Decoded<T> =
  | { status: 'missing' }
  | { status: 'ok' | 'migrated'; value: T; storedVersion: number | null }
  | { status: 'corrupt' }
  | { status: 'newer'; storedVersion: number };

interface Codec<T> {
  version: number;
  legacyRaw: boolean;
  migrations?: RecordMigrations;
  parse: (data: unknown) => T | null;
}

function safeParse<T>(codec: Codec<T>, data: unknown): T | null {
  try {
    return codec.parse(data);
  } catch {
    return null;
  }
}

function decodeContainer<T>(codec: Codec<T>, container: unknown): Decoded<T> {
  if (codec.legacyRaw) {
    const value = safeParse(codec, container);
    return value === null ? { status: 'corrupt' } : { status: 'ok', value, storedVersion: null };
  }
  if (!isPlainObject(container) || !isNonNegativeInteger(container.v) || !('data' in container)) {
    return { status: 'corrupt' };
  }
  const storedVersion = container.v;
  if (storedVersion > codec.version) return { status: 'newer', storedVersion };
  let data: unknown = container.data;
  for (let from = storedVersion; from < codec.version; from += 1) {
    const migrate = codec.migrations?.[from];
    if (!migrate) return { status: 'corrupt' };
    try {
      data = migrate(data);
    } catch {
      return { status: 'corrupt' };
    }
  }
  const value = safeParse(codec, data);
  if (value === null) return { status: 'corrupt' };
  return { status: storedVersion < codec.version ? 'migrated' : 'ok', value, storedVersion };
}

function decodeRaw<T>(codec: Codec<T>, raw: string | null): Decoded<T> {
  if (raw === null) return { status: 'missing' };
  let container: unknown;
  try {
    container = JSON.parse(raw);
  } catch {
    return { status: 'corrupt' };
  }
  return decodeContainer(codec, container);
}

function serialize<T>(codec: Codec<T>, value: T): string {
  return codec.legacyRaw ? JSON.stringify(value) : JSON.stringify({ v: codec.version, data: value });
}

const reportedCorrupt = new Set<string>();

function reportCorrupt(key: string): void {
  if (reportedCorrupt.has(key)) return;
  reportedCorrupt.add(key);
  console.warn(
    `[learner-store] Ignoring unreadable data in "${key}". It is kept as it is and copied to "${recoveredKeyFor(key)}" before anything is saved over it.`,
  );
}

function inBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** The outcome of an update() that writes nothing: 'memory-only' while `key` is not actually saved in localStorage. */
function unchangedOutcome(key: string): WriteOutcome {
  if (!inBrowser()) return 'not-in-browser';
  return getStorageStatus() === 'unavailable' || hasMemoryOverlay(key) ? 'memory-only' : 'saved';
}

/** Writes `next` over the freshly decoded current value of `key`. */
function commit<T>(codec: Codec<T>, key: string, maxChars: number, raw: string | null, current: Decoded<T>, next: T): WriteOutcome {
  if (!inBrowser()) return 'not-in-browser';
  if (current.status === 'newer') return 'blocked-newer-version';
  const serialized = serialize(codec, next);
  if (serialized.length > maxChars) return 'too-large';
  if (current.status === 'corrupt' && raw !== null) {
    const copy = safeStorage.set(recoveredKeyFor(key), raw, { memoryFallback: false });
    if (copy === 'failed') return 'blocked-corrupt';
  }
  const result = safeStorage.set(key, serialized);
  if (result === 'saved') return 'saved';
  if (result === 'not-in-browser') return 'not-in-browser';
  return 'memory-only';
}

// ---------------------------------------------------------------------------
// The in-module event bus
// ---------------------------------------------------------------------------

interface RegisteredRecord {
  matches(key: string): boolean;
  /** Drops trust in cached snapshots: those of `changedKey` alone, or every one when it is null. */
  invalidate(changedKey: string | null): void;
  /** Calls this record's subscribers. */
  notify(): void;
  hasSubscribers(): boolean;
}

const registeredRecords = new Set<RegisteredRecord>();
const storeListeners = new Set<() => void>();
let storageListenerInstalled = false;

function notifyStoreListeners(): void {
  [...storeListeners].forEach((listener) => listener());
}

function isLocalStorageEvent(event: StorageEvent): boolean {
  if (!event.storageArea) return true;
  try {
    return event.storageArea === window.localStorage;
  } catch {
    return true;
  }
}

function onStorageEvent(event: StorageEvent): void {
  if (!isLocalStorageEvent(event)) return;
  const { key } = event;
  // Another tab saved: a value this tab kept only in memory is older and must not shadow it.
  dropMemoryOverlay(key);
  const affected = [...registeredRecords].filter((record) => key === null || record.matches(key));
  affected.forEach((record) => record.invalidate(key));
  affected.forEach((record) => record.notify());
  if (affected.length > 0 || key === null || isLearnerKey(key)) notifyStoreListeners();
}

function hasAnyListener(): boolean {
  if (storeListeners.size > 0) return true;
  return [...registeredRecords].some((record) => record.hasSubscribers());
}

function syncStorageListener(): void {
  if (!inBrowser()) return;
  const needed = hasAnyListener();
  if (needed && !storageListenerInstalled) {
    window.addEventListener('storage', onStorageEvent);
    storageListenerInstalled = true;
  } else if (!needed && storageListenerInstalled) {
    window.removeEventListener('storage', onStorageEvent);
    storageListenerInstalled = false;
  }
}

/**
 * Tells every record that storage changed outside its own writes (an import,
 * a reset, or code that wrote localStorage directly): cached snapshots are
 * dropped and every subscriber is called.
 */
export function notifyLearnerStoreChanged(): void {
  const records = [...registeredRecords];
  records.forEach((record) => record.invalidate(null));
  records.forEach((record) => record.notify());
  notifyStoreListeners();
}

/** Calls `listener` after any learner record changes in this tab or another. Returns the unsubscribe function; a no-op on the server. */
export function subscribeLearnerStore(listener: () => void): () => void {
  if (!inBrowser()) return () => undefined;
  storeListeners.add(listener);
  syncStorageListener();
  return () => {
    storeListeners.delete(listener);
    syncStorageListener();
  };
}

function scheduleMicrotask(task: () => void): void {
  if (typeof queueMicrotask === 'function') queueMicrotask(task);
  else void Promise.resolve().then(task);
}

// ---------------------------------------------------------------------------
// defineRecord
// ---------------------------------------------------------------------------

export function defineRecord<T>(config: RecordConfig<T>): LearnerRecord<T> {
  const { key, version, empty, maxChars, merge } = config;
  const codec: Codec<T> = {
    version,
    legacyRaw: config.legacyRaw === true,
    migrations: config.migrations,
    parse: config.parse,
  };
  const listeners = new Set<() => void>();
  let generation = 0;
  let cache: { raw: string | null; value: T; checkedAt: number } | null = null;
  let writeBackPending = false;

  const valueOf = (decoded: Decoded<T>): T =>
    decoded.status === 'ok' || decoded.status === 'migrated' ? decoded.value : empty;

  const freshRead = () => {
    const raw = safeStorage.get(key);
    return { raw, decoded: decodeRaw(codec, raw) };
  };

  const scheduleWriteBack = () => {
    if (writeBackPending) return;
    writeBackPending = true;
    scheduleMicrotask(() => {
      writeBackPending = false;
      const { raw, decoded } = freshRead();
      if (decoded.status !== 'migrated') return;
      const serialized = serialize(codec, decoded.value);
      if (serialized.length > maxChars) return;
      safeStorage.set(key, serialized);
      // Same data, new encoding: keep the snapshot object so nothing re-renders.
      if (cache && cache.raw === raw) cache = { raw: safeStorage.get(key), value: cache.value, checkedAt: cache.checkedAt };
    });
  };

  const read = (): T => {
    if (!inBrowser()) return empty;
    if (cache && listeners.size > 0 && cache.checkedAt === generation) return cache.value;
    const raw = safeStorage.get(key);
    if (cache && cache.raw === raw) {
      cache.checkedAt = generation;
      return cache.value;
    }
    const decoded = decodeRaw(codec, raw);
    if (decoded.status === 'corrupt') reportCorrupt(key);
    if (decoded.status === 'migrated') scheduleWriteBack();
    const value = valueOf(decoded);
    cache = { raw, value, checkedAt: generation };
    return value;
  };

  const invalidate = () => {
    generation += 1;
  };

  const notify = () => {
    [...listeners].forEach((listener) => listener());
  };

  const afterWrite = (outcome: WriteOutcome): WriteOutcome => {
    if (outcome === 'saved' || outcome === 'memory-only') {
      invalidate();
      notify();
      notifyStoreListeners();
    }
    return outcome;
  };

  const record: LearnerRecord<T> = {
    key,
    version,
    empty,
    maxChars,
    legacyRaw: codec.legacyRaw,
    read,
    write(value) {
      if (!inBrowser()) return 'not-in-browser';
      const { raw, decoded } = freshRead();
      return afterWrite(commit(codec, key, maxChars, raw, decoded, value));
    },
    update(fn) {
      if (!inBrowser()) return 'not-in-browser';
      const { raw, decoded } = freshRead();
      if (decoded.status === 'newer') return 'blocked-newer-version';
      const current = valueOf(decoded);
      const next = fn(current);
      if (Object.is(next, current)) return unchangedOutcome(key);
      return afterWrite(commit(codec, key, maxChars, raw, decoded, next));
    },
    clear() {
      if (!inBrowser()) return;
      safeStorage.remove(key);
      invalidate();
      notify();
      notifyStoreListeners();
    },
    subscribe(listener) {
      if (!inBrowser()) return () => undefined;
      if (listeners.size === 0) invalidate();
      listeners.add(listener);
      syncStorageListener();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) invalidate();
        syncStorageListener();
      };
    },
    merge,
    parse(data) {
      return safeParse(codec, data);
    },
    fromEnvelope(envelope) {
      return valueOrNull(decodeContainer(codec, envelope));
    },
    inspect() {
      const { raw, decoded } = freshRead();
      return {
        status: decoded.status,
        value: valueOf(decoded),
        raw,
        storedVersion: 'storedVersion' in decoded ? decoded.storedVersion : null,
      };
    },
  };

  registeredRecords.add({
    matches: (changedKey) => changedKey === key,
    invalidate,
    notify,
    hasSubscribers: () => listeners.size > 0,
  });

  return record;
}

function valueOrNull<T>(decoded: Decoded<T>): T | null {
  return decoded.status === 'ok' || decoded.status === 'migrated' ? decoded.value : null;
}

// ---------------------------------------------------------------------------
// defineKeyedRecord
// ---------------------------------------------------------------------------

const EMPTY_LIST: readonly KeyedEntry<never>[] = Object.freeze([]);
/** A checkedAt that never matches a generation: the snapshot must be checked against storage. */
const STALE = -1;

export function defineKeyedRecord<T>(config: KeyedRecordConfig<T>): KeyedLearnerRecord<T> {
  const { prefix, version, maxChars, merge } = config;
  const codecFor = (id: string): Codec<T> => ({
    version,
    legacyRaw: false,
    migrations: config.migrations,
    parse: (data) => config.parse(data, id),
  });
  const listeners = new Set<() => void>();
  let generation = 0;
  const entryCache = new Map<string, { raw: string | null; value: T | null; checkedAt: number }>();
  let listCache: { value: readonly KeyedEntry<T>[]; checkedAt: number } | null = null;
  const writeBacksPending = new Set<string>();

  const keyFor = (id: string): string => {
    if (typeof id !== 'string' || id.length === 0) throw new TypeError(`A ${prefix} entry needs a non-empty id.`);
    return `${prefix}${id}`;
  };

  const trusted = (checkedAt: number) => listeners.size > 0 && checkedAt === generation;

  const freshRead = (id: string) => {
    const key = keyFor(id);
    const raw = safeStorage.get(key);
    return { key, raw, decoded: decodeRaw(codecFor(id), raw) };
  };

  /** Drops trust in every cached entry and the list (another tab cleared storage, an import, a subscribe or unsubscribe). */
  const invalidateAll = () => {
    generation += 1;
  };

  /** Drops trust in one entry and in the list; every other entry's snapshot stays trusted. */
  const invalidateId = (id: string) => {
    const cached = entryCache.get(id);
    if (cached) cached.checkedAt = STALE;
    if (listCache) listCache.checkedAt = STALE;
  };

  const scheduleWriteBack = (id: string) => {
    if (writeBacksPending.has(id)) return;
    writeBacksPending.add(id);
    scheduleMicrotask(() => {
      writeBacksPending.delete(id);
      const { key, raw, decoded } = freshRead(id);
      if (decoded.status !== 'migrated') return;
      const serialized = serialize(codecFor(id), decoded.value);
      if (serialized.length > maxChars) return;
      safeStorage.set(key, serialized);
      const cached = entryCache.get(id);
      if (cached && cached.raw === raw) {
        entryCache.set(id, { raw: safeStorage.get(key), value: cached.value, checkedAt: cached.checkedAt });
      }
    });
  };

  const get = (id: string): T | null => {
    if (!inBrowser()) return null;
    const cached = entryCache.get(id);
    if (cached && trusted(cached.checkedAt)) return cached.value;
    const key = keyFor(id);
    const raw = safeStorage.get(key);
    if (cached && cached.raw === raw) {
      cached.checkedAt = generation;
      return cached.value;
    }
    const decoded = decodeRaw(codecFor(id), raw);
    if (decoded.status === 'corrupt') reportCorrupt(key);
    if (decoded.status === 'migrated') scheduleWriteBack(id);
    const value = valueOrNull(decoded);
    if (raw === null) entryCache.delete(id);
    else entryCache.set(id, { raw, value, checkedAt: generation });
    return value;
  };

  const list = (): readonly KeyedEntry<T>[] => {
    if (!inBrowser()) return EMPTY_LIST;
    if (listCache && trusted(listCache.checkedAt)) return listCache.value;
    const ids = safeStorage
      .keys(prefix)
      .map((key) => key.slice(prefix.length))
      .filter((id) => id.length > 0)
      .sort();
    const entries: KeyedEntry<T>[] = [];
    for (const id of ids) {
      const value = get(id);
      if (value !== null) entries.push({ id, value });
    }
    const previous = listCache?.value;
    const same =
      previous !== undefined &&
      previous.length === entries.length &&
      previous.every((entry, index) => entry.id === entries[index].id && entry.value === entries[index].value);
    const value = same && previous ? previous : entries.length === 0 ? (EMPTY_LIST as readonly KeyedEntry<T>[]) : entries;
    listCache = { value, checkedAt: generation };
    return value;
  };

  const notify = () => {
    [...listeners].forEach((listener) => listener());
  };

  const afterWrite = (id: string, outcome: WriteOutcome): WriteOutcome => {
    if (outcome === 'saved' || outcome === 'memory-only') {
      invalidateId(id);
      notify();
      notifyStoreListeners();
    }
    return outcome;
  };

  const record: KeyedLearnerRecord<T> = {
    prefix,
    version,
    maxChars,
    keyFor,
    get,
    set(id, value) {
      if (!inBrowser()) return 'not-in-browser';
      const { key, raw, decoded } = freshRead(id);
      return afterWrite(id, commit(codecFor(id), key, maxChars, raw, decoded, value));
    },
    update(id, fn) {
      if (!inBrowser()) return 'not-in-browser';
      const { key, raw, decoded } = freshRead(id);
      if (decoded.status === 'newer') return 'blocked-newer-version';
      const current = valueOrNull(decoded);
      const next = fn(current);
      if (next === null || Object.is(next, current)) return unchangedOutcome(key);
      return afterWrite(id, commit(codecFor(id), key, maxChars, raw, decoded, next));
    },
    remove(id) {
      if (!inBrowser()) return;
      safeStorage.remove(keyFor(id));
      entryCache.delete(id);
      invalidateId(id);
      notify();
      notifyStoreListeners();
    },
    list,
    subscribe(listener) {
      if (!inBrowser()) return () => undefined;
      if (listeners.size === 0) invalidateAll();
      listeners.add(listener);
      syncStorageListener();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) invalidateAll();
        syncStorageListener();
      };
    },
    merge,
    parse(data, id) {
      return safeParse(codecFor(id), data);
    },
    fromEnvelope(envelope, id) {
      return valueOrNull(decodeContainer(codecFor(id), envelope));
    },
    inspect(id) {
      const { raw, decoded } = freshRead(id);
      return {
        status: decoded.status,
        value: valueOrNull(decoded),
        raw,
        storedVersion: 'storedVersion' in decoded ? decoded.storedVersion : null,
      };
    },
  };

  const matches = (changedKey: string) => changedKey.startsWith(prefix) && changedKey.length > prefix.length;

  registeredRecords.add({
    matches,
    invalidate: (changedKey) => {
      if (changedKey !== null && matches(changedKey)) invalidateId(changedKey.slice(prefix.length));
      else invalidateAll();
    },
    notify,
    hasSubscribers: () => listeners.size > 0,
  });

  return record;
}

/** Test-only: forget which corrupt keys were logged and detach the 'storage' listener. Records stay registered. */
export function __resetRecordsForTests(): void {
  reportedCorrupt.clear();
  storeListeners.clear();
  notifyLearnerStoreChanged();
  if (storageListenerInstalled && inBrowser()) {
    window.removeEventListener('storage', onStorageEvent);
  }
  storageListenerInstalled = false;
}
