/**
 * Backups of this browser's learner data: export, preview, import and reset.
 *
 * The bundle, which is also the payload a future POST /api/me/import will take
 * on a learner's first sign-in:
 *
 *   {
 *     format: 'sv-uvm-guide/learner-data',
 *     schemaVersion: 1,
 *     exportedAt: '<ISO 8601>',
 *     records:   { [key]: { v, data } },  // the versioned learner records (learnerRecords)
 *     legacy:    { [key]: rawString },    // 'curriculumProgress', 'svuvm.learningRoute' and the
 *                                         // exercise keys, exactly as stored
 *     recovered: { [key]: rawString },    // 'sv-uvm-guide:recovered:<key>' copies of unreadable values
 *   }                                     // ('sv-uvm-guide:recovered:previous:<key>' for an older copy)
 *
 * Imports are untrusted input. A file is at most LEARNER_DATA_MAX_BYTES, is
 * parsed with JSON.parse inside try, must carry exactly this format and a
 * schemaVersion no newer than this site's, and every entry is validated on its
 * own: records with their record's parse (through fromEnvelope), legacy keys
 * with the validators in repositories/legacy.ts. Times are checked first
 * (checkTimes): one no Date can hold is dropped and one more than a day ahead
 * of this browser's clock becomes now, so a hand-edited backup cannot break the
 * pages that show dates. Unknown keys are ignored, and invalid entries are
 * counted and skipped. Nothing is ever evaluated or rendered as markup;
 * recovered copies are stored back as opaque strings.
 *
 * 'replace' deletes the learner keys and then writes the backup; if a write
 * throws, the deleted values are put back. 'merge' calls each record's
 * merge(local, incoming). Afterwards, as after a reset, listeners
 * are told in this order: notifyLearnerStoreChanged() (store subscribers),
 * writeSelectedRoute(route | null) (which dispatches the route event), then
 * LEARNER_DATA_CHANGED_EVENT on window (useExerciseProgress and other code that
 * keeps its own copy). Reset removes only known learner keys, never 'theme' or
 * the outline key.
 *
 * Import this module by path; the barrel does not re-export it.
 */
import { readSelectedRoute, writeSelectedRoute, type RouteId } from '@/lib/learning-route-state';

import {
  CURRICULUM_PROGRESS_KEY,
  EXERCISE_ANALYTICS_PREFIX,
  EXERCISE_PROGRESS_PREFIX,
  LAB_KEY_PREFIX,
  LEARNER_DATA_CHANGED_EVENT,
  LAB_TOTAL_MAX_CHARS,
  MAX_DATE_MS,
  META_KEY,
  NOTEBOOK_KEY_PREFIX,
  NOTEBOOK_MAX_ENTRIES,
  NOTEBOOK_TOTAL_MAX_CHARS,
  RECOVERED_KEY_PREFIX,
  ROUTE_STORAGE_KEY,
  curriculumProgressRecord,
  estimateBytes,
  isLearnerKey,
  isLegacyKey,
  isNonNegativeInteger,
  isPlainObject,
  isValidRouteRaw,
  learnerRecords,
  localDayKey,
  markExported,
  metaRecord,
  notebookTotalChars,
  notifyLearnerStoreChanged,
  parseCurriculumProgressRaw,
  parseExerciseAnalyticsRaw,
  parseExerciseProgressRaw,
  recoveredKeyFor,
  safeStorage,
  totalLabRecordChars,
  LEGACY_EXERCISE_MAX_EVENTS,
  type CurriculumProgressData,
  type KeyedLearnerRecord,
  type LearnerArea,
  type LearnerRecord,
  type LegacyAnalyticsEvent,
  type LegacyExerciseProgress,
  type RecordInspection,
  type StorageSetResult,
  type WriteOutcome,
} from './index';

export const LEARNER_DATA_FORMAT = 'sv-uvm-guide/learner-data' as const;
export const LEARNER_DATA_SCHEMA_VERSION = 1 as const;
/**
 * Largest backup file accepted for import, in bytes, as LEARNER_DATA_MAX_LABEL
 * says it. localStorage holds about 5 million UTF-16 units, and a character
 * outside ASCII takes up to 3 bytes in the UTF-8 file, so a full browser fits.
 */
export const LEARNER_DATA_MAX_BYTES = 16 * 1024 * 1024;
export const LEARNER_DATA_MAX_LABEL = '16 MB';
/** Longest storage key accepted from a backup. */
const MAX_KEY_LENGTH = 300;
/** Longest recovered copy accepted from a backup, in characters (the largest record cap). */
export const RECOVERED_MAX_CHARS = 400_000;

export interface RecordEnvelope {
  v: number;
  data: unknown;
}

export interface LearnerDataBundle {
  format: typeof LEARNER_DATA_FORMAT;
  schemaVersion: number;
  /** ISO 8601. */
  exportedAt: string;
  records: Record<string, RecordEnvelope>;
  legacy: Record<string, string>;
  recovered: Record<string, string>;
}

/** The learner-facing areas a backup is counted in. */
export type BackupArea = LearnerArea | 'curriculum' | 'route' | 'exercises' | 'recovered';

/** Display order. */
export const BACKUP_AREAS: readonly BackupArea[] = Object.freeze([
  'curriculum',
  'lessons',
  'route',
  'labs',
  'flashcards',
  'notebook',
  'assessments',
  'exercises',
  'activity',
  'recovered',
  'meta',
] satisfies BackupArea[]);

export const BACKUP_AREA_LABELS: Readonly<Record<BackupArea, string>> = Object.freeze({
  curriculum: 'Lesson progress',
  lessons: 'Lesson visits',
  route: 'Chosen route',
  labs: 'Labs',
  flashcards: 'Flashcard reviews',
  notebook: 'Notebook',
  assessments: 'Quiz and placement results',
  exercises: 'Exercise scores',
  activity: 'Activity log',
  recovered: 'Copies of unreadable data',
  meta: 'Backup details',
});

export type ImportMode = 'replace' | 'merge';

export interface AreaPreview {
  /** Valid entries (storage keys) this browser can import. */
  entries: number;
  /** What those entries hold, counted the way a learner would: lessons, cards, notes, days... */
  items: number;
  /** Entries that failed validation. */
  invalid: number;
  /** Entries written by a newer version of the site, which this version cannot read. */
  newer: number;
}

export interface LearnerDataPreview {
  ok: true;
  bundle: LearnerDataBundle;
  /** The bundle's exportedAt, when it is a valid date. */
  exportedAt: string | null;
  areas: Record<BackupArea, AreaPreview>;
  validEntries: number;
  invalidEntries: number;
  newerEntries: number;
  /** Keys this site does not know, ignored. */
  ignoredKeys: number;
}

export interface LearnerDataError {
  ok: false;
  error: string;
}

export type LearnerDataPreviewResult = LearnerDataPreview | LearnerDataError;

export interface AreaImportCounts {
  imported: number;
  /** Valid entries not written: newer than this site, over a limit, or blocked by what is stored. */
  skipped: number;
  /** Valid entries a merge left out because this browser already has its own (its chosen route, a recovered copy). */
  keptLocal: number;
  invalid: number;
}

export interface LearnerDataImportReport {
  ok: true;
  mode: ImportMode;
  areas: Record<BackupArea, AreaImportCounts>;
  imported: number;
  skipped: number;
  keptLocal: number;
  invalid: number;
  ignored: number;
  /** Writes kept only in memory for this visit (storage blocked or full). */
  memoryOnly: number;
}

export type LearnerDataImportResult = LearnerDataImportReport | LearnerDataError;

export interface LearnerDataResetReport {
  /** Learner keys removed. */
  removed: number;
}

export const BACKUP_ERRORS = Object.freeze({
  notInBrowser: 'Backups work only in the browser.',
  tooLarge: `This file is larger than ${LEARNER_DATA_MAX_LABEL}, so it isn't a backup from this site.`,
  unreadable: "This file couldn't be read. Choose the file again.",
  notJson: "This file isn't a backup from this site: it isn't valid JSON.",
  notBackup: "This file isn't a learning-data backup from this site.",
  newer: "This backup was made by a newer version of this site, so this version can't read it.",
  nothingToImport: 'This backup holds no learning data this site can use, so nothing was changed.',
  badMode: 'Choose whether to replace or merge your data.',
  replaceFailed:
    'Something went wrong during the import, so the learning data in this browser was put back as it was. Try the import again.',
  mergeFailed:
    'Something went wrong partway through the import. What was merged so far is kept and nothing was deleted. Try the import again.',
  importFailed: 'Something went wrong during the import. Reload the page to see the learning data in this browser, then try again.',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inBrowser(): boolean {
  return typeof window !== 'undefined';
}

function emptyAreas<T>(make: () => T): Record<BackupArea, T> {
  const areas = {} as Record<BackupArea, T>;
  for (const area of BACKUP_AREAS) areas[area] = make();
  return areas;
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Whether the UTF-8 bytes of `text` pass `limit`, counted only when the character count alone cannot decide, and without encoding it. */
function exceedsBytes(text: string, limit: number): boolean {
  if (text.length > limit) return true;
  // A UTF-16 code unit takes at most 3 bytes in UTF-8.
  if (text.length * 3 <= limit) return false;
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && (text.charCodeAt(index + 1) & 0xfc00) === 0xdc00) {
      // A surrogate pair: one 4-byte character.
      bytes += 4;
      index += 1;
    } else bytes += 3;
    if (bytes > limit) return true;
  }
  return false;
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && !Number.isNaN(Date.parse(value));
}

function envelopeLength(version: number, data: unknown): number {
  return JSON.stringify({ v: version, data }).length;
}

function updatedAtOf(value: unknown): number {
  return isPlainObject(value) && typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : 0;
}

// ---------------------------------------------------------------------------
// Times in an imported backup
// ---------------------------------------------------------------------------

/** How far past this browser's clock an imported time may be, for a device whose clock runs ahead. */
const FUTURE_SLACK_MS = 24 * 60 * 60 * 1000;
/** Time fields that point to the future by design: when a flashcard is next due. */
const FUTURE_TIME_KEYS: ReadonlySet<string> = new Set(['dueAt']);
/** How deep checkTimes looks. The records nest about four levels. */
const MAX_TIME_CHECK_DEPTH = 8;

/** The time fields of the records ('createdAt', 'lastExportAt', 'dueAt'...) and of exercise analytics events ('timestamp'). */
function isTimeKey(key: string): boolean {
  return key.endsWith('At') || key === 'timestamp';
}

/** The time to keep: unchanged, `now` for one more than a day ahead of this browser's clock, or undefined to drop one no Date can hold. */
function checkedTime(time: number, key: string, now: number): number | undefined {
  if (!Number.isFinite(time)) return time;
  if (Math.abs(time) > MAX_DATE_MS) return undefined;
  if (!FUTURE_TIME_KEYS.has(key) && time > now + FUTURE_SLACK_MS) return now;
  return time;
}

/**
 * `value` with every time in it checked by checkedTime, before a record's parse
 * or a legacy validator sees it. A dropped time reads as a missing field, so
 * the parse falls back as it always does: an optional time is left out, a
 * required one drops its item. A time field holding an object (completedAt:
 * { [lesson]: time }) has the numbers in it checked the same way. The input is
 * never changed: what changes is copied, and when nothing changes `value`
 * itself is returned.
 */
function checkTimes(value: unknown, now: number, depth = 0, timeKey: string | null = null): unknown {
  if (depth > MAX_TIME_CHECK_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    let items: unknown[] | null = null;
    for (let index = 0; index < value.length; index += 1) {
      const next = checkTimes(value[index], now, depth + 1);
      if (next === value[index]) continue;
      items ??= [...value];
      items[index] = next;
    }
    return items ?? value;
  }
  if (!isPlainObject(value)) return value;
  let copy: Record<string, unknown> | null = null;
  for (const [key, item] of Object.entries(value)) {
    const fieldTimeKey = isTimeKey(key) ? key : null;
    let next: unknown;
    if (typeof item === 'number') {
      const itemTimeKey = fieldTimeKey ?? timeKey;
      next = itemTimeKey === null ? item : checkedTime(item, itemTimeKey, now);
    } else {
      next = checkTimes(item, now, depth + 1, fieldTimeKey);
    }
    if (next === item) continue;
    // A spread copies an own '__proto__' key as a key; defineProperty sets one without touching the prototype.
    copy ??= { ...value };
    if (next === undefined) delete copy[key];
    else Object.defineProperty(copy, key, { value: next, writable: true, enumerable: true, configurable: true });
  }
  return copy ?? value;
}

/** A record envelope whose data has its times checked; the same envelope when nothing changes. */
function envelopeWithCheckedTimes(envelope: unknown, now: number): unknown {
  if (!isPlainObject(envelope) || !('data' in envelope)) return envelope;
  const data = checkTimes(envelope.data, now);
  return data === envelope.data ? envelope : { v: envelope.v, data };
}

/** A validated legacy value with its times checked. When that changes it, the key's validator runs again on the result. */
function legacyWithCheckedTimes<T>(value: T | null, validate: (raw: string) => T | null, now: number): T | null {
  if (value === null) return null;
  const checked = checkTimes(value, now);
  return checked === value ? value : validate(JSON.stringify(checked));
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportOptions {
  now?: number;
  /** Record the export in meta.lastExportAt (default true). Pass false and call markExported() once the download has started. */
  markExported?: boolean;
}

/** At most this many older copies of one key are carried ('previous:', 'previous-2:'...). */
const MAX_PREVIOUS_COPIES = 10;

/** 'sv-uvm-guide:recovered:previous:<key>', then 'previous-2:'... No learner key starts with 'previous', so these never stand for a real key's copy. */
function previousCopyKey(key: string, index: number): string {
  return `${RECOVERED_KEY_PREFIX}${index === 1 ? 'previous' : `previous-${index}`}:${key}`;
}

/** Keeps an older recovered copy of `key` beside the one that takes its place, under the first free previous-copy key. */
function keepPreviousCopy(key: string, raw: string, recovered: Record<string, string>): void {
  for (let index = 1; index <= MAX_PREVIOUS_COPIES; index += 1) {
    const copyKey = previousCopyKey(key, index);
    const existing = recovered[copyKey];
    if (existing === raw) return;
    if (existing === undefined) {
      recovered[copyKey] = raw;
      return;
    }
  }
}

function collectInspection(
  key: string,
  version: number,
  inspection: RecordInspection<unknown>,
  records: Record<string, RecordEnvelope>,
  recovered: Record<string, string>,
): void {
  switch (inspection.status) {
    case 'ok':
    case 'migrated':
      records[key] = { v: version, data: inspection.value };
      return;
    case 'newer': {
      // Kept as stored, so a newer version of the site can import it again.
      const parsed = parseJson(inspection.raw);
      if (isPlainObject(parsed) && isNonNegativeInteger(parsed.v) && 'data' in parsed) {
        records[key] = { v: parsed.v, data: parsed.data };
      }
      return;
    }
    case 'corrupt': {
      if (inspection.raw === null) return;
      // The value stored now goes under the usual copy key, as the next write over it would put it there,
      // and an older copy already stored there is kept beside it: a reset and re-import loses neither.
      const copyKey = recoveredKeyFor(key);
      const older = recovered[copyKey];
      recovered[copyKey] = inspection.raw;
      if (older !== undefined && older !== inspection.raw) keepPreviousCopy(key, older, recovered);
      return;
    }
    case 'missing':
      return;
  }
}

/**
 * Builds the backup bundle from this browser's learner data and, unless told
 * not to, records the export in meta.lastExportAt (for the dashboard's backup
 * reminder). On the server it returns an empty bundle and writes nothing.
 */
export function exportLearnerData(options: ExportOptions = {}): LearnerDataBundle {
  const now = options.now ?? Date.now();
  const records: Record<string, RecordEnvelope> = {};
  const legacy: Record<string, string> = {};
  const recovered: Record<string, string> = {};
  const bundle: LearnerDataBundle = {
    format: LEARNER_DATA_FORMAT,
    schemaVersion: LEARNER_DATA_SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    records,
    legacy,
    recovered,
  };
  if (!inBrowser()) return bundle;

  for (const key of safeStorage.keys(RECOVERED_KEY_PREFIX)) {
    if (key.length === RECOVERED_KEY_PREFIX.length) continue;
    const raw = safeStorage.get(key);
    if (raw !== null) recovered[key] = raw;
  }

  for (const entry of learnerRecords) {
    if (entry.kind === 'record') {
      const { record } = entry;
      const inspection = record.inspect();
      if (record.key === META_KEY && (inspection.status === 'ok' || inspection.status === 'migrated' || inspection.status === 'missing')) {
        continue;
      }
      collectInspection(record.key, record.version, inspection, records, recovered);
      continue;
    }
    const { record } = entry;
    for (const key of safeStorage.keys(record.prefix).sort()) {
      const id = key.slice(record.prefix.length);
      if (!id) continue;
      collectInspection(key, record.version, record.inspect(id), records, recovered);
    }
  }

  // Meta, as it will read once this export is recorded.
  if (records[META_KEY] === undefined) {
    const meta = metaRecord.read();
    records[META_KEY] = {
      v: metaRecord.version,
      data: { ...meta, createdAt: meta.createdAt > 0 ? meta.createdAt : now, lastExportAt: now },
    };
  }

  const legacyKeys = [
    CURRICULUM_PROGRESS_KEY,
    ROUTE_STORAGE_KEY,
    ...safeStorage.keys(EXERCISE_PROGRESS_PREFIX).sort(),
    ...safeStorage.keys(EXERCISE_ANALYTICS_PREFIX).sort(),
  ];
  for (const key of legacyKeys) {
    if (!isLegacyKey(key)) continue;
    const raw = safeStorage.get(key);
    if (raw !== null) legacy[key] = raw;
  }

  if (options.markExported !== false) markExported(now);
  return bundle;
}

/** The bundle as the JSON text of a backup file: indented, or compact when indenting would pass the import limit. */
export function serializeLearnerData(bundle: LearnerDataBundle): string {
  const pretty = JSON.stringify(bundle, null, 2);
  return exceedsBytes(pretty, LEARNER_DATA_MAX_BYTES) ? JSON.stringify(bundle) : pretty;
}

/**
 * False when a backup's text is larger than LEARNER_DATA_MAX_BYTES, so this
 * site would refuse to import it: check it before offering the download, and
 * say so (serializeLearnerData already falls back to compact JSON).
 */
export function fitsImportLimit(text: string): boolean {
  return !exceedsBytes(text, LEARNER_DATA_MAX_BYTES);
}

/** 'sv-uvm-guide-learning-data-YYYY-MM-DD.json', dated in the learner's local zone. */
export function learnerDataFileName(now: number = Date.now()): string {
  return `sv-uvm-guide-learning-data-${localDayKey(now)}.json`;
}

/** Estimated bytes of learner data in this browser (2 bytes per UTF-16 unit of key plus value). 0 on the server. */
export function estimateLearnerDataBytes(): number {
  return estimateBytes();
}

// ---------------------------------------------------------------------------
// Validation (shared by preview and import)
// ---------------------------------------------------------------------------

type PlannedEntry =
  | { area: BackupArea; kind: 'record'; record: LearnerRecord<unknown>; value: unknown }
  | { area: BackupArea; kind: 'keyed'; record: KeyedLearnerRecord<unknown>; id: string; value: unknown }
  | { area: 'curriculum'; kind: 'curriculum'; value: CurriculumProgressData }
  | { area: 'route'; kind: 'route'; value: RouteId }
  | { area: 'exercises'; kind: 'exercise-progress'; key: string; value: LegacyExerciseProgress }
  | { area: 'exercises'; kind: 'exercise-analytics'; key: string; value: LegacyAnalyticsEvent[] }
  | { area: 'recovered'; kind: 'recovered'; key: string; raw: string };

interface ImportPlan {
  entries: PlannedEntry[];
  invalid: Record<BackupArea, number>;
  newer: Record<BackupArea, number>;
  ignored: number;
}

type BundleCheck = { ok: true; bundle: LearnerDataBundle } | LearnerDataError;

/** Checks the bundle's frame: format, schemaVersion and the three sections. Entries are checked by planImport. */
function checkBundle(value: unknown): BundleCheck {
  if (!isPlainObject(value) || value.format !== LEARNER_DATA_FORMAT) return { ok: false, error: BACKUP_ERRORS.notBackup };
  const { schemaVersion } = value;
  if (!isNonNegativeInteger(schemaVersion) || schemaVersion < 1) return { ok: false, error: BACKUP_ERRORS.notBackup };
  if (schemaVersion > LEARNER_DATA_SCHEMA_VERSION) return { ok: false, error: BACKUP_ERRORS.newer };
  for (const section of ['records', 'legacy', 'recovered'] as const) {
    if (value[section] !== undefined && !isPlainObject(value[section])) return { ok: false, error: BACKUP_ERRORS.notBackup };
  }
  return {
    ok: true,
    bundle: {
      format: LEARNER_DATA_FORMAT,
      schemaVersion,
      exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
      records: (value.records ?? {}) as Record<string, RecordEnvelope>,
      legacy: (value.legacy ?? {}) as Record<string, string>,
      recovered: (value.recovered ?? {}) as Record<string, string>,
    },
  };
}

type RecordTarget =
  | { area: LearnerArea; kind: 'record'; record: LearnerRecord<unknown> }
  | { area: LearnerArea; kind: 'keyed'; record: KeyedLearnerRecord<unknown>; id: string };

function findRecordFor(key: string): RecordTarget | null {
  for (const entry of learnerRecords) {
    if (entry.kind === 'record') {
      if (entry.record.key === key) return { area: entry.area, kind: 'record', record: entry.record };
    } else if (key.startsWith(entry.record.prefix) && key.length > entry.record.prefix.length) {
      return { area: entry.area, kind: 'keyed', record: entry.record, id: key.slice(entry.record.prefix.length) };
    }
  }
  return null;
}

function legacyAreaFor(key: string): 'curriculum' | 'route' | 'exercises' {
  if (key === CURRICULUM_PROGRESS_KEY) return 'curriculum';
  if (key === ROUTE_STORAGE_KEY) return 'route';
  return 'exercises';
}

/** Validates every entry of the bundle, with its times checked against `now` (this browser's clock). */
function planImport(bundle: LearnerDataBundle, now: number): ImportPlan {
  const plan: ImportPlan = { entries: [], invalid: emptyAreas(() => 0), newer: emptyAreas(() => 0), ignored: 0 };

  for (const [key, envelope] of Object.entries(bundle.records)) {
    const target = key.length <= MAX_KEY_LENGTH ? findRecordFor(key) : null;
    if (!target) {
      plan.ignored += 1;
      continue;
    }
    const { area, record } = target;
    if (isPlainObject(envelope) && isNonNegativeInteger(envelope.v) && envelope.v > record.version) {
      plan.newer[area] += 1;
      continue;
    }
    const checked = envelopeWithCheckedTimes(envelope, now);
    if (target.kind === 'record') {
      const value = target.record.fromEnvelope(checked);
      if (value === null) plan.invalid[area] += 1;
      else plan.entries.push({ area, kind: 'record', record: target.record, value });
    } else {
      const value = target.record.fromEnvelope(checked, target.id);
      if (value === null) plan.invalid[area] += 1;
      else plan.entries.push({ area, kind: 'keyed', record: target.record, id: target.id, value });
    }
  }

  for (const [key, raw] of Object.entries(bundle.legacy)) {
    if (key.length > MAX_KEY_LENGTH || !isLegacyKey(key)) {
      plan.ignored += 1;
      continue;
    }
    const area = legacyAreaFor(key);
    if (typeof raw !== 'string') {
      plan.invalid[area] += 1;
      continue;
    }
    if (key === ROUTE_STORAGE_KEY) {
      if (isValidRouteRaw(raw)) plan.entries.push({ area: 'route', kind: 'route', value: raw });
      else plan.invalid.route += 1;
    } else if (key === CURRICULUM_PROGRESS_KEY) {
      const value = legacyWithCheckedTimes(parseCurriculumProgressRaw(raw), parseCurriculumProgressRaw, now);
      if (value) plan.entries.push({ area: 'curriculum', kind: 'curriculum', value });
      else plan.invalid.curriculum += 1;
    } else if (key.startsWith(EXERCISE_ANALYTICS_PREFIX)) {
      const value = legacyWithCheckedTimes(parseExerciseAnalyticsRaw(raw), parseExerciseAnalyticsRaw, now);
      if (value) plan.entries.push({ area: 'exercises', kind: 'exercise-analytics', key, value });
      else plan.invalid.exercises += 1;
    } else {
      const value = parseExerciseProgressRaw(raw);
      if (value) plan.entries.push({ area: 'exercises', kind: 'exercise-progress', key, value });
      else plan.invalid.exercises += 1;
    }
  }

  for (const [key, raw] of Object.entries(bundle.recovered)) {
    if (key.length > MAX_KEY_LENGTH || !key.startsWith(RECOVERED_KEY_PREFIX) || key.length === RECOVERED_KEY_PREFIX.length) {
      plan.ignored += 1;
      continue;
    }
    if (typeof raw !== 'string' || raw.length > RECOVERED_MAX_CHARS) plan.invalid.recovered += 1;
    else plan.entries.push({ area: 'recovered', kind: 'recovered', key, raw });
  }

  return plan;
}

function countItems(entry: PlannedEntry): number {
  switch (entry.kind) {
    case 'curriculum':
      return Object.values(entry.value).reduce((sum, module) => sum + module.completedLessons.length, 0);
    case 'route':
      return 1;
    case 'exercise-progress':
      return 1;
    case 'exercise-analytics':
      return 0;
    case 'recovered':
      return 1;
    case 'keyed':
      return 1;
    case 'record': {
      const value = entry.value;
      if (!isPlainObject(value)) return 0;
      switch (entry.area) {
        case 'flashcards':
          return isPlainObject(value.cards) ? Object.keys(value.cards).length : 0;
        case 'lessons':
          return isPlainObject(value.lessons) ? Object.keys(value.lessons).length : 0;
        case 'activity':
          return isPlainObject(value.days) ? Object.keys(value.days).length : 0;
        case 'assessments':
          return (
            (Array.isArray(value.placement) ? value.placement.length : 0) +
            (isPlainObject(value.quizzes) ? Object.keys(value.quizzes).length : 0)
          );
        default:
          return 0;
      }
    }
  }
}

function summarize(bundle: LearnerDataBundle, plan: ImportPlan): LearnerDataPreview {
  const areas = emptyAreas<AreaPreview>(() => ({ entries: 0, items: 0, invalid: 0, newer: 0 }));
  for (const entry of plan.entries) {
    areas[entry.area].entries += 1;
    areas[entry.area].items += countItems(entry);
  }
  let invalidEntries = 0;
  let newerEntries = 0;
  for (const area of BACKUP_AREAS) {
    areas[area].invalid = plan.invalid[area];
    areas[area].newer = plan.newer[area];
    invalidEntries += plan.invalid[area];
    newerEntries += plan.newer[area];
  }
  return {
    ok: true,
    bundle,
    exportedAt: isValidDateString(bundle.exportedAt) ? bundle.exportedAt : null,
    areas,
    validEntries: plan.entries.length,
    invalidEntries,
    newerEntries,
    ignoredKeys: plan.ignored,
  };
}

export interface ImportOptions {
  /** This browser's clock, which imported times are checked against (default Date.now()). */
  now?: number;
}

/**
 * Parses and validates the text of a backup file without writing anything.
 * Returns what each area holds, or a learner-facing error.
 */
export function previewLearnerData(input: unknown, options: ImportOptions = {}): LearnerDataPreviewResult {
  if (typeof input !== 'string') return { ok: false, error: BACKUP_ERRORS.notBackup };
  if (exceedsBytes(input, LEARNER_DATA_MAX_BYTES)) return { ok: false, error: BACKUP_ERRORS.tooLarge };
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch {
    return { ok: false, error: BACKUP_ERRORS.notJson };
  }
  const checked = checkBundle(parsed);
  if (!checked.ok) return checked;
  return summarize(checked.bundle, planImport(checked.bundle, options.now ?? Date.now()));
}

function readBlobText(file: Blob): Promise<string> {
  const withText = file as Blob & { text?: () => Promise<string> };
  if (typeof withText.text === 'function') return withText.text();
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader is not available'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(file);
  });
}

/** previewLearnerData for a chosen file: refuses files over LEARNER_DATA_MAX_BYTES before reading them. */
export async function previewLearnerDataFile(file: Blob): Promise<LearnerDataPreviewResult> {
  if (file.size > LEARNER_DATA_MAX_BYTES) return { ok: false, error: BACKUP_ERRORS.tooLarge };
  let text: string;
  try {
    text = await readBlobText(file);
  } catch {
    return { ok: false, error: BACKUP_ERRORS.unreadable };
  }
  return previewLearnerData(text);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** 'kept-local': a merge keeps this browser's own value (its chosen route, an existing recovered copy). */
type ApplyOutcome = 'imported' | 'memory-only' | 'skipped' | 'kept-local';

function fromWriteOutcome(outcome: WriteOutcome): ApplyOutcome {
  if (outcome === 'saved') return 'imported';
  if (outcome === 'memory-only') return 'memory-only';
  return 'skipped';
}

function fromSetResult(result: StorageSetResult): ApplyOutcome {
  if (result === 'saved') return 'imported';
  if (result === 'memory-only') return 'memory-only';
  return 'skipped';
}

function notebookEntryCount(): number {
  return safeStorage.keys(NOTEBOOK_KEY_PREFIX).filter((key) => key.length > NOTEBOOK_KEY_PREFIX.length).length;
}

/** The limits the lab store and the notebook enforce across entries, applied to imported entries too. */
function fitsAcrossEntries(record: KeyedLearnerRecord<unknown>, id: string, next: unknown, isNew: boolean): boolean {
  const length = envelopeLength(record.version, next);
  if (record.prefix === LAB_KEY_PREFIX) return totalLabRecordChars(id) + length <= LAB_TOTAL_MAX_CHARS;
  if (record.prefix === NOTEBOOK_KEY_PREFIX) {
    if (isNew && notebookEntryCount() >= NOTEBOOK_MAX_ENTRIES) return false;
    return notebookTotalChars(id) + length <= NOTEBOOK_TOTAL_MAX_CHARS;
  }
  return true;
}

function mergeExerciseProgress(local: LegacyExerciseProgress, incoming: LegacyExerciseProgress): LegacyExerciseProgress {
  const merged: LegacyExerciseProgress = {
    bestScore: Math.max(local.bestScore, incoming.bestScore),
    attempts: Math.max(local.attempts, incoming.attempts),
  };
  const lastPlayed = [local.lastPlayed, incoming.lastPlayed]
    .filter((value): value is string => typeof value === 'string')
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .pop();
  if (lastPlayed) merged.lastPlayed = lastPlayed;
  return merged;
}

function mergeAnalytics(local: LegacyAnalyticsEvent[], incoming: LegacyAnalyticsEvent[]): LegacyAnalyticsEvent[] {
  const seen = new Set<string>();
  const events: LegacyAnalyticsEvent[] = [];
  for (const event of [...local, ...incoming]) {
    const id = `${event.type}:${event.value}:${event.timestamp}`;
    if (seen.has(id)) continue;
    seen.add(id);
    events.push(event);
  }
  return events.sort((a, b) => a.timestamp - b.timestamp).slice(-LEGACY_EXERCISE_MAX_EVENTS);
}

function applyEntry(entry: PlannedEntry, mode: ImportMode, localRoute: RouteId | null): ApplyOutcome {
  switch (entry.kind) {
    case 'record': {
      const { record, value } = entry;
      const outcome = mode === 'merge' ? record.update((local) => record.merge(local, value)) : record.write(value);
      return fromWriteOutcome(outcome);
    }
    case 'keyed': {
      const { record, id, value } = entry;
      let overLimit = false;
      const outcome = record.update(id, (current) => {
        const next = current !== null && mode === 'merge' ? record.merge(current, value) : value;
        if (!fitsAcrossEntries(record, id, next, current === null)) {
          overLimit = true;
          return null;
        }
        return next;
      });
      return overLimit ? 'skipped' : fromWriteOutcome(outcome);
    }
    case 'curriculum': {
      const { value } = entry;
      const outcome =
        mode === 'merge'
          ? curriculumProgressRecord.update((local) => curriculumProgressRecord.merge(local, value))
          : curriculumProgressRecord.write(value);
      return fromWriteOutcome(outcome);
    }
    case 'route':
      // Written once, after the store is notified (see announceLearnerDataChanged).
      return mode === 'merge' && localRoute !== null ? 'kept-local' : 'imported';
    case 'exercise-progress': {
      const local = mode === 'merge' ? parseExerciseProgressRaw(safeStorage.get(entry.key)) : null;
      const next = local ? mergeExerciseProgress(local, entry.value) : entry.value;
      return fromSetResult(safeStorage.set(entry.key, JSON.stringify(next)));
    }
    case 'exercise-analytics': {
      const local = mode === 'merge' ? parseExerciseAnalyticsRaw(safeStorage.get(entry.key)) : null;
      const next = local ? mergeAnalytics(local, entry.value) : entry.value.slice(-LEGACY_EXERCISE_MAX_EVENTS);
      return fromSetResult(safeStorage.set(entry.key, JSON.stringify(next)));
    }
    case 'recovered': {
      if (mode === 'merge' && safeStorage.get(entry.key) !== null) return 'kept-local';
      // Opaque copies: never parsed, and not worth a place in the memory overlay.
      return fromSetResult(safeStorage.set(entry.key, entry.raw, { memoryFallback: false }));
    }
  }
}

/** Areas written first, so the data learners care about most gets in if storage fills up. */
const APPLY_ORDER: readonly BackupArea[] = [
  'curriculum',
  'lessons',
  'route',
  'flashcards',
  'assessments',
  'notebook',
  'labs',
  'exercises',
  'activity',
  'meta',
  'recovered',
];

function orderEntries(entries: readonly PlannedEntry[]): PlannedEntry[] {
  const rank = (area: BackupArea) => APPLY_ORDER.indexOf(area);
  // Within an area, newest first, so the most recent notes and labs fit when a limit is reached.
  return [...entries].sort((a, b) => {
    const byArea = rank(a.area) - rank(b.area);
    if (byArea !== 0) return byArea;
    const aTime = a.kind === 'keyed' ? updatedAtOf(a.value) : 0;
    const bTime = b.kind === 'keyed' ? updatedAtOf(b.value) : 0;
    return bTime - aTime;
  });
}

/** Removes every known learner key (new, recovered and legacy), never 'theme' or the outline key. */
function clearLearnerKeys(): number {
  let removed = 0;
  for (const key of safeStorage.keys()) {
    if (!isLearnerKey(key)) continue;
    safeStorage.remove(key);
    removed += 1;
  }
  return removed;
}

/** Every learner key with its raw value, as safeStorage reads it (memory-only values included). */
function snapshotLearnerKeys(): Map<string, string> {
  const snapshot = new Map<string, string>();
  for (const key of safeStorage.keys()) {
    if (!isLearnerKey(key)) continue;
    const raw = safeStorage.get(key);
    if (raw !== null) snapshot.set(key, raw);
  }
  return snapshot;
}

/** Puts the learner keys back as `snapshot` holds them: what an interrupted import wrote is removed first. */
function restoreLearnerKeys(snapshot: ReadonlyMap<string, string>): void {
  clearLearnerKeys();
  // A value that no longer fits stays in safeStorage's memory overlay, and the storage note says so.
  for (const [key, raw] of snapshot) safeStorage.set(key, raw);
}

/** Tells every listener that learner data changed under it, in the order GD14 fixes. */
function announceLearnerDataChanged(route: RouteId | null): void {
  notifyLearnerStoreChanged();
  writeSelectedRoute(route);
  window.dispatchEvent(new Event(LEARNER_DATA_CHANGED_EVENT));
}

/**
 * Imports a backup bundle (an untrusted object, normally preview.bundle).
 * 'replace' deletes this browser's learner data and then writes the backup;
 * 'merge' combines each area with what is stored, and keeps this browser's
 * own route and recovered copies (counted as keptLocal). Invalid entries are
 * counted and skipped. Nothing is changed when the frame itself is invalid,
 * or when no entry is usable (so 'replace' never deletes data to write
 * nothing). If a write throws, 'replace' puts back what it deleted, 'merge'
 * keeps what it merged, and the result is an error; listeners are told either way.
 */
export function importLearnerData(bundle: unknown, mode: ImportMode, options: ImportOptions = {}): LearnerDataImportResult {
  if (!inBrowser()) return { ok: false, error: BACKUP_ERRORS.notInBrowser };
  if (mode !== 'replace' && mode !== 'merge') return { ok: false, error: BACKUP_ERRORS.badMode };
  const checked = checkBundle(bundle);
  if (!checked.ok) return checked;
  const plan = planImport(checked.bundle, options.now ?? Date.now());
  if (plan.entries.length === 0) return { ok: false, error: BACKUP_ERRORS.nothingToImport };

  const areas = emptyAreas<AreaImportCounts>(() => ({ imported: 0, skipped: 0, keptLocal: 0, invalid: 0 }));
  for (const area of BACKUP_AREAS) {
    areas[area].invalid = plan.invalid[area];
    areas[area].skipped = plan.newer[area];
  }

  const localRoute = mode === 'merge' ? readSelectedRoute() : null;
  // 'replace' keeps what it deletes until the backup is written, to put it back if a write throws.
  const snapshot = mode === 'replace' ? snapshotLearnerKeys() : null;
  if (snapshot) clearLearnerKeys();

  let incomingRoute: RouteId | null = null;
  let memoryOnly = 0;
  let failed = false;
  try {
    for (const entry of orderEntries(plan.entries)) {
      const outcome = applyEntry(entry, mode, localRoute);
      if (outcome === 'skipped' || outcome === 'kept-local') {
        if (outcome === 'skipped') areas[entry.area].skipped += 1;
        else areas[entry.area].keptLocal += 1;
        continue;
      }
      areas[entry.area].imported += 1;
      if (outcome === 'memory-only') memoryOnly += 1;
      if (entry.kind === 'route') incomingRoute = entry.value;
    }
  } catch (error) {
    failed = true;
    console.error('[learner-store] The import stopped with an error.', error);
    if (snapshot) restoreLearnerKeys(snapshot);
  } finally {
    // Listeners hear about every outcome, including an interrupted import and a restore.
    let route: RouteId | null;
    if (mode === 'merge') route = localRoute ?? incomingRoute;
    else if (failed && snapshot) {
      const previous = snapshot.get(ROUTE_STORAGE_KEY);
      route = isValidRouteRaw(previous) ? previous : null;
    } else route = incomingRoute;
    announceLearnerDataChanged(route);
  }
  if (failed) return { ok: false, error: mode === 'replace' ? BACKUP_ERRORS.replaceFailed : BACKUP_ERRORS.mergeFailed };

  let imported = 0;
  let skipped = 0;
  let keptLocal = 0;
  let invalid = 0;
  for (const area of BACKUP_AREAS) {
    imported += areas[area].imported;
    skipped += areas[area].skipped;
    keptLocal += areas[area].keptLocal;
    invalid += areas[area].invalid;
  }
  return { ok: true, mode, areas, imported, skipped, keptLocal, invalid, ignored: plan.ignored, memoryOnly };
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/**
 * Deletes every known learner key in this browser (the records, recovered
 * copies, 'curriculumProgress', the route choice and the exercise keys), then
 * notifies the listeners. 'theme', the outline key and keys this site does not
 * know are left alone.
 */
export function resetLearnerData(): LearnerDataResetReport {
  if (!inBrowser()) return { removed: 0 };
  const removed = clearLearnerKeys();
  announceLearnerDataChanged(null);
  return { removed };
}
