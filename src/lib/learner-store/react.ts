'use client';

/**
 * React bindings for the learner store, all built on useSyncExternalStore.
 *
 * The server snapshots are the record's empty value, null, [], 'available'
 * and false. The server render and the hydrating render therefore always show
 * the empty state, and the stored value appears right after hydration with no
 * mismatch. Storage is read only through getSnapshot, never during the server
 * render, and these hooks never write.
 *
 * Import this module by path: the barrel (src/lib/learner-store/index.ts)
 * does not re-export it, so server components never pull it in.
 */
import { useCallback, useSyncExternalStore } from 'react';

import type { KeyedEntry, KeyedLearnerRecord, LearnerRecord } from './record';
import { getStorageStatus, subscribeStorageStatus, type StorageStatus } from './storage';

const EMPTY_ENTRIES: readonly KeyedEntry<never>[] = Object.freeze([]);

function getServerNull(): null {
  return null;
}

function getServerEntries(): readonly KeyedEntry<never>[] {
  return EMPTY_ENTRIES;
}

function getServerStatus(): StorageStatus {
  return 'available';
}

function subscribeNothing(): () => void {
  return () => undefined;
}

function getClientHydrated(): boolean {
  return true;
}

function getServerHydrated(): boolean {
  return false;
}

/** The record's value; its empty value during the server render and hydration. */
export function useRecord<T>(record: LearnerRecord<T>): T {
  const getServerSnapshot = useCallback(() => record.empty, [record]);
  return useSyncExternalStore(record.subscribe, record.read, getServerSnapshot);
}

/** One keyed entry, or null (absent, unreadable, no id, or during the server render and hydration). */
export function useKeyedRecord<T>(record: KeyedLearnerRecord<T>, id: string | null | undefined): T | null {
  const getSnapshot = useCallback(() => (id ? record.get(id) : null), [record, id]);
  return useSyncExternalStore(record.subscribe, getSnapshot, getServerNull);
}

/** Every readable entry of a keyed record, sorted by id; [] during the server render and hydration. */
export function useKeyedRecordList<T>(record: KeyedLearnerRecord<T>): readonly KeyedEntry<T>[] {
  return useSyncExternalStore(record.subscribe, record.list, getServerEntries);
}

/** 'available', 'unavailable' or 'full'; 'available' during the server render and hydration. */
export function useStorageStatus(): StorageStatus {
  return useSyncExternalStore(subscribeStorageStatus, getStorageStatus, getServerStatus);
}

/** False during the server render and the hydrating render, true afterwards (and on client-only mounts). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNothing, getClientHydrated, getServerHydrated);
}
