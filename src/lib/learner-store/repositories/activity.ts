/**
 * Daily activity counts for the dashboard (streaks, recent activity), one
 * entry per local day ('YYYY-MM-DD', see time.ts), kept for 400 days.
 */
import { ACTIVITY_KEY } from '../keys';
import { defineRecord, isNonNegativeInteger, isPlainObject, recordOf, type WriteOutcome } from '../record';
import { addDays, isDayKey, localDayKey } from '../time';

export type ActivityKind = 'lesson' | 'lab-step' | 'lab-complete' | 'review' | 'quiz' | 'placement' | 'note';

export const ACTIVITY_KINDS: readonly ActivityKind[] = Object.freeze([
  'lesson',
  'lab-step',
  'lab-complete',
  'review',
  'quiz',
  'placement',
  'note',
]);

export const ACTIVITY_RETENTION_DAYS = 400;
export const ACTIVITY_MAX_CHARS = 100_000;

export type ActivityCounts = Partial<Record<ActivityKind, number>>;

export interface ActivityData {
  days: Record<string, ActivityCounts>;
}

const EMPTY_ACTIVITY: ActivityData = Object.freeze({
  days: Object.freeze({}) as Record<string, ActivityCounts>,
});

export function isActivityKind(value: unknown): value is ActivityKind {
  return typeof value === 'string' && (ACTIVITY_KINDS as readonly string[]).includes(value);
}

function parseCounts(value: unknown, dayKey: string): ActivityCounts | null {
  if (!isDayKey(dayKey) || !isPlainObject(value)) return null;
  const counts: ActivityCounts = {};
  for (const [kind, count] of Object.entries(value)) {
    if (isActivityKind(kind) && isNonNegativeInteger(count) && count > 0) counts[kind] = count;
  }
  return Object.keys(counts).length > 0 ? counts : null;
}

export function parseActivityData(data: unknown): ActivityData | null {
  if (!isPlainObject(data)) return null;
  return { days: recordOf(data.days, parseCounts) };
}

/** The oldest day key kept on `now`'s day: days before it are pruned. */
export function activityCutoffDayKey(now: number = Date.now()): string {
  return localDayKey(addDays(now, -(ACTIVITY_RETENTION_DAYS - 1)));
}

/** Drops days older than ACTIVITY_RETENTION_DAYS (today counts as one). Returns the same object when nothing is dropped. */
export function pruneActivity(data: ActivityData, now: number = Date.now()): ActivityData {
  const cutoff = activityCutoffDayKey(now);
  const keys = Object.keys(data.days);
  if (keys.every((key) => key >= cutoff)) return data;
  const days: Record<string, ActivityCounts> = {};
  for (const key of keys) {
    if (key >= cutoff) days[key] = data.days[key];
  }
  return { days };
}

/** Per day and per kind, the larger count wins. */
export function mergeActivityData(local: ActivityData, incoming: ActivityData): ActivityData {
  const days: Record<string, ActivityCounts> = { ...local.days };
  for (const [dayKey, counts] of Object.entries(incoming.days)) {
    const merged: ActivityCounts = { ...(days[dayKey] ?? {}) };
    for (const kind of ACTIVITY_KINDS) {
      const value = counts[kind];
      if (value !== undefined) merged[kind] = Math.max(merged[kind] ?? 0, value);
    }
    days[dayKey] = merged;
  }
  return { days };
}

export const activityRecord = defineRecord<ActivityData>({
  key: ACTIVITY_KEY,
  version: 1,
  empty: EMPTY_ACTIVITY,
  parse: parseActivityData,
  maxChars: ACTIVITY_MAX_CHARS,
  merge: mergeActivityData,
});

/** Adds one `kind` to the learner's local day and prunes days older than 400. */
export function recordActivity(kind: ActivityKind, now: number = Date.now()): WriteOutcome {
  const dayKey = localDayKey(now);
  return activityRecord.update((data) => {
    const pruned = pruneActivity(data, now);
    const counts = pruned.days[dayKey] ?? {};
    return { days: { ...pruned.days, [dayKey]: { ...counts, [kind]: (counts[kind] ?? 0) + 1 } } };
  });
}
