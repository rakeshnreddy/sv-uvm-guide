/**
 * Store metadata: when this browser's learner data was first created and when
 * it was last exported (for backup reminders, since some browsers delete
 * site data that has not been used for a while).
 */
import { META_KEY } from '../keys';
import { defineRecord, isPlainObject, isTimestamp, timestampOr, type WriteOutcome } from '../record';

export const LEARNER_SCHEMA_VERSION = 1 as const;

export interface LearnerMeta {
  schemaVersion: typeof LEARNER_SCHEMA_VERSION;
  /** Epoch ms of the first write; 0 until something is saved. */
  createdAt: number;
  /** Epoch ms of the last export. */
  lastExportAt?: number;
}

const EMPTY_META: LearnerMeta = Object.freeze({ schemaVersion: LEARNER_SCHEMA_VERSION, createdAt: 0 });

/** How far past this browser's clock a stored export time may be, for a device whose clock ran ahead. */
const EXPORT_FUTURE_SLACK_MS = 24 * 60 * 60 * 1000;

/**
 * Reads the stored metadata. A lastExportAt no Date can hold, or one more than
 * a day after `now`, is dropped: the backup reminder then shows, rather than a
 * date that crashes the page or a reminder that never comes back.
 */
export function parseLearnerMeta(data: unknown, now: number = Date.now()): LearnerMeta | null {
  if (!isPlainObject(data)) return null;
  const meta: LearnerMeta = {
    schemaVersion: LEARNER_SCHEMA_VERSION,
    createdAt: timestampOr(data.createdAt, 0),
  };
  const { lastExportAt } = data;
  if (isTimestamp(lastExportAt) && lastExportAt > 0 && lastExportAt <= now + EXPORT_FUTURE_SLACK_MS) {
    meta.lastExportAt = lastExportAt;
  }
  return meta;
}

function earliest(a: number, b: number): number {
  if (a <= 0) return b;
  if (b <= 0) return a;
  return Math.min(a, b);
}

export function mergeLearnerMeta(local: LearnerMeta, incoming: LearnerMeta): LearnerMeta {
  const merged: LearnerMeta = {
    schemaVersion: LEARNER_SCHEMA_VERSION,
    createdAt: earliest(local.createdAt, incoming.createdAt),
  };
  const lastExportAt = Math.max(local.lastExportAt ?? 0, incoming.lastExportAt ?? 0);
  if (lastExportAt > 0) merged.lastExportAt = lastExportAt;
  return merged;
}

export const metaRecord = defineRecord<LearnerMeta>({
  key: META_KEY,
  version: 1,
  empty: EMPTY_META,
  parse: (data) => parseLearnerMeta(data),
  maxChars: 2_000,
  merge: mergeLearnerMeta,
});

/** Records createdAt once (the first time learner data is saved). Writes nothing when it is already set. */
export function ensureMetaCreated(now: number = Date.now()): WriteOutcome {
  return metaRecord.update((meta) => (meta.createdAt > 0 ? meta : { ...meta, createdAt: now }));
}

/** Sets lastExportAt (and createdAt if it was never set) after a successful export. */
export function markExported(now: number = Date.now()): WriteOutcome {
  return metaRecord.update((meta) => ({
    ...meta,
    createdAt: meta.createdAt > 0 ? meta.createdAt : now,
    lastExportAt: now,
  }));
}
