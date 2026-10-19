/**
 * Every localStorage key the learner store knows about.
 *
 * New keys start with 'sv-uvm-guide:' and hold the versioned envelope
 * {"v":1,"data":...}. Legacy keys keep their exact formats and owners:
 * - 'curriculumProgress': bare JSON (curriculumProgressRecord, legacyRaw).
 * - 'svuvm.learningRoute': a bare route id string, owned by learning-route-state.
 * - 'sv-uvm-guide:exercise:<id>' and 'sv-uvm-guide:exercise-analytics:<id>':
 *   bare JSON, owned by useExerciseProgress.
 * 'theme' (next-themes) and 'sv-uvm:outline-collapsed' are UI conveniences:
 * never read, exported or reset as learner data.
 */
import { ROUTE_STORAGE_KEY } from '@/lib/learning-route-state';

export const KEY_PREFIX = 'sv-uvm-guide:';

export const META_KEY = `${KEY_PREFIX}meta`;
/** Keyed: one key per lab version, `sv-uvm-guide:lab:<labId>@<labVersion>`. */
export const LAB_KEY_PREFIX = `${KEY_PREFIX}lab:`;
export const FLASHCARDS_KEY = `${KEY_PREFIX}flashcards`;
/** Keyed: one key per entry, `sv-uvm-guide:notebook:<entryId>`. */
export const NOTEBOOK_KEY_PREFIX = `${KEY_PREFIX}notebook:`;
export const ASSESSMENTS_KEY = `${KEY_PREFIX}assessments`;
export const LESSONS_KEY = `${KEY_PREFIX}lessons`;
export const ACTIVITY_KEY = `${KEY_PREFIX}activity`;
/** A side copy of a corrupt raw value, taken before the first write over it: `sv-uvm-guide:recovered:<originalKey>`. */
export const RECOVERED_KEY_PREFIX = `${KEY_PREFIX}recovered:`;

export function recoveredKeyFor(originalKey: string): string {
  return `${RECOVERED_KEY_PREFIX}${originalKey}`;
}

// Legacy keys, kept in their existing formats.
export const CURRICULUM_PROGRESS_KEY = 'curriculumProgress';
export const LEARNING_ROUTE_KEY: string = ROUTE_STORAGE_KEY;
export { ROUTE_STORAGE_KEY };
export const EXERCISE_PROGRESS_PREFIX = `${KEY_PREFIX}exercise:`;
export const EXERCISE_ANALYTICS_PREFIX = `${KEY_PREFIX}exercise-analytics:`;

/** Legacy keys and prefixes that backups carry as raw strings. */
export const LEGACY_KEYS: readonly string[] = Object.freeze([CURRICULUM_PROGRESS_KEY, ROUTE_STORAGE_KEY]);
export const LEGACY_PREFIXES: readonly string[] = Object.freeze([EXERCISE_PROGRESS_PREFIX, EXERCISE_ANALYTICS_PREFIX]);

// UI conveniences: never read, exported or reset as learner data.
export const THEME_KEY = 'theme';
export const OUTLINE_COLLAPSED_KEY = 'sv-uvm:outline-collapsed';
export const EXCLUDED_KEYS: readonly string[] = Object.freeze([THEME_KEY, OUTLINE_COLLAPSED_KEY]);

/** Exact learner keys (single records and legacy keys). */
export const KNOWN_LEARNER_KEYS: readonly string[] = Object.freeze([
  META_KEY,
  FLASHCARDS_KEY,
  ASSESSMENTS_KEY,
  LESSONS_KEY,
  ACTIVITY_KEY,
  CURRICULUM_PROGRESS_KEY,
  ROUTE_STORAGE_KEY,
]);

/** Learner key prefixes (keyed records, recovered copies and legacy exercise keys). */
export const KNOWN_LEARNER_PREFIXES: readonly string[] = Object.freeze([
  LAB_KEY_PREFIX,
  NOTEBOOK_KEY_PREFIX,
  RECOVERED_KEY_PREFIX,
  EXERCISE_PROGRESS_PREFIX,
  EXERCISE_ANALYTICS_PREFIX,
]);

/**
 * Same-tab "learner data changed" event, dispatched on window after an import
 * or reset so code that keeps its own copy of learner data (useExerciseProgress,
 * for example) re-reads it. Other tabs learn about changes through 'storage'.
 */
export const LEARNER_DATA_CHANGED_EVENT = 'sv-uvm-guide:learner-data-changed';

/** True for every key that belongs to the learner (new, recovered and legacy keys); false for 'theme' and the outline key. */
export function isLearnerKey(key: string): boolean {
  if (EXCLUDED_KEYS.includes(key)) return false;
  if (KNOWN_LEARNER_KEYS.includes(key)) return true;
  return KNOWN_LEARNER_PREFIXES.some((prefix) => key.startsWith(prefix) && key.length > prefix.length);
}

/** True for the legacy keys whose raw strings a backup carries under `legacy`. */
export function isLegacyKey(key: string): boolean {
  if (LEGACY_KEYS.includes(key)) return true;
  return LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix) && key.length > prefix.length);
}

/**
 * 32-bit FNV-1a over the string's UTF-16 code units, as 8 lowercase hex digits.
 * Deterministic and key-safe; used for quiz ids and teach-back entry ids.
 */
export function fnv1a32Hex(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** A new random id: crypto.randomUUID() where available, otherwise Date.now() plus Math.random(). */
export function createLearnerId(): string {
  const cryptoApi = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `${Date.now().toString(36)}-${random}`;
}
