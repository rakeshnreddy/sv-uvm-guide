import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useExerciseProgress } from '@/hooks/useExerciseProgress';
import {
  ACTIVITY_KEY,
  ASSESSMENTS_KEY,
  CURRICULUM_PROGRESS_KEY,
  EXERCISE_ANALYTICS_PREFIX,
  EXERCISE_PROGRESS_PREFIX,
  FLASHCARDS_KEY,
  LAB_KEY_PREFIX,
  LEARNER_DATA_CHANGED_EVENT,
  LESSONS_KEY,
  META_KEY,
  NOTEBOOK_KEY_PREFIX,
  OUTLINE_COLLAPSED_KEY,
  RECOVERED_KEY_PREFIX,
  ROUTE_STORAGE_KEY,
  THEME_KEY,
  __resetRecordsForTests,
  __resetStorageForTests,
  activityRecord,
  assessmentRecord,
  curriculumProgressRecord,
  flashcardRecord,
  labProgressRecords,
  labRecordId,
  lessonLogRecord,
  logLessonVisit,
  metaRecord,
  notebookEntries,
  recordActivity,
  recordQuizResult,
  recoveredKeyFor,
  subscribeLearnerStore,
  type CurriculumProgressData,
  type FlashcardData,
  type LabProgressRecord,
  type NotebookEntry,
} from '@/lib/learner-store';
import {
  BACKUP_ERRORS,
  LEARNER_DATA_FORMAT,
  LEARNER_DATA_MAX_BYTES,
  LEARNER_DATA_MAX_LABEL,
  RECOVERED_MAX_CHARS,
  estimateLearnerDataBytes,
  exportLearnerData,
  fitsImportLimit,
  importLearnerData,
  learnerDataFileName,
  previewLearnerData,
  previewLearnerDataFile,
  resetLearnerData,
  serializeLearnerData,
  type LearnerDataBundle,
  type LearnerDataPreview,
} from '@/lib/learner-store/backup';
import { useRecord } from '@/lib/learner-store/react';
import { readSelectedRoute, subscribeSelectedRoute, writeSelectedRoute } from '@/lib/learning-route-state';

const NOW = new Date(2026, 9, 18, 12, 0, 0).getTime();
const LESSON_A = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const LESSON_B = '/curriculum/T1_Foundational/F1B_The_Verification_Plan/index';

function card(deckId: string, lastReviewedAt: number): FlashcardData['cards'][string] {
  return { deckId, interval: 1, repetitions: 1, ease: 2.5, dueAt: lastReviewedAt + 86_400_000, lastReviewedAt, lapses: 0, reviews: 1 };
}

function note(id: string, body: string, updatedAt = NOW): NotebookEntry {
  return { id, kind: 'note', title: `Note ${id}`, body, createdAt: updatedAt, updatedAt };
}

function lab(labId: string, overrides: Partial<LabProgressRecord> = {}): LabProgressRecord {
  return {
    labId,
    labVersion: '1',
    currentStepId: 'step-1',
    completedSteps: [],
    stepEvidence: {},
    fileBuffers: { 'tb.sv': `// ${labId}` },
    status: 'in_progress',
    startedAt: NOW - 5_000,
    updatedAt: NOW - 1_000,
    ...overrides,
  };
}

function rawStore(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key !== null) entries[key] = window.localStorage.getItem(key) ?? '';
  }
  return entries;
}

/** One browser's worth of learner data, written through the repositories and the legacy owners. */
function seedBrowser(variant: 'a' | 'b'): void {
  const isA = variant === 'a';
  const progress: CurriculumProgressData = isA
    ? { F1A: { completedLessons: ['index'], completedAt: { index: NOW - 3_000 } } }
    : { F1A: { completedLessons: ['deep-dive'] }, F1B: { completedLessons: ['index'] } };
  expect(curriculumProgressRecord.write(progress)).toBe('saved');
  expect(logLessonVisit(isA ? LESSON_A : LESSON_B, NOW)).toBe('saved');
  expect(
    flashcardRecord.write({
      cards: { [`card-${variant}`]: card(`deck-${variant}`, NOW - 2_000) },
      decks: {},
      positions: {},
    }),
  ).toBe('saved');
  expect(notebookEntries.set(`note-${variant}`, note(`note-${variant}`, `Notes from browser ${variant}`))).toBe('saved');
  expect(labProgressRecords.set(labRecordId(`lab-${variant}`, '1'), lab(`lab-${variant}`))).toBe('saved');
  expect(recordQuizResult(isA ? LESSON_A : LESSON_B, isA ? 'aaaaaaaa' : 'bbbbbbbb', 2, 3, NOW)).toBe('saved');
  expect(recordActivity(isA ? 'lesson' : 'quiz', isA ? NOW : NOW - 86_400_000)).toBe('saved');
  writeSelectedRoute(isA ? 'junior' : 'expert');
  window.localStorage.setItem(
    `${EXERCISE_PROGRESS_PREFIX}scoreboard`,
    JSON.stringify(isA ? { bestScore: 90, attempts: 3 } : { bestScore: 50, attempts: 5 }),
  );
  if (!isA) {
    window.localStorage.setItem(`${EXERCISE_PROGRESS_PREFIX}arbiter`, JSON.stringify({ bestScore: 40, attempts: 1 }));
  }
}

function backupOf(variant: 'a' | 'b'): LearnerDataBundle {
  seedBrowser(variant);
  const bundle = exportLearnerData({ now: NOW });
  resetLearnerData();
  return bundle;
}

function bundle(sections: Partial<Pick<LearnerDataBundle, 'records' | 'legacy' | 'recovered'>>): LearnerDataBundle {
  return {
    format: LEARNER_DATA_FORMAT,
    schemaVersion: 1,
    exportedAt: new Date(NOW).toISOString(),
    records: {},
    legacy: {},
    recovered: {},
    ...sections,
  };
}

function expectPreview(result: ReturnType<typeof previewLearnerData>): LearnerDataPreview {
  if (!result.ok) throw new Error(`Expected a preview, got: ${result.error}`);
  return result;
}

beforeEach(() => {
  window.localStorage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('exportLearnerData', () => {
  it('carries the new records and the legacy keys as raw strings, and leaves out theme and the outline key', () => {
    const { result, unmount } = renderHook(() => useExerciseProgress('scoreboard-connector'));
    act(() => {
      result.current.recordAttempt(70);
    });
    unmount();
    seedBrowser('a');
    window.localStorage.setItem(THEME_KEY, 'ocean-dark');
    window.localStorage.setItem(OUTLINE_COLLAPSED_KEY, 'true');
    window.localStorage.setItem('someone-elses-key', 'leave me alone');

    const exported = exportLearnerData({ now: NOW });

    expect(exported.format).toBe('sv-uvm-guide/learner-data');
    expect(exported.schemaVersion).toBe(1);
    expect(exported.exportedAt).toBe(new Date(NOW).toISOString());

    expect(Object.keys(exported.records).sort()).toEqual(
      [
        ACTIVITY_KEY,
        ASSESSMENTS_KEY,
        FLASHCARDS_KEY,
        `${LAB_KEY_PREFIX}lab-a@1`,
        LESSONS_KEY,
        META_KEY,
        `${NOTEBOOK_KEY_PREFIX}note-a`,
      ].sort(),
    );
    expect(exported.records[FLASHCARDS_KEY]).toEqual({ v: 1, data: flashcardRecord.read() });
    expect(exported.records[`${NOTEBOOK_KEY_PREFIX}note-a`]).toEqual({ v: 1, data: note('note-a', 'Notes from browser a') });

    const raw = rawStore();
    expect(exported.legacy).toEqual({
      [CURRICULUM_PROGRESS_KEY]: raw[CURRICULUM_PROGRESS_KEY],
      [ROUTE_STORAGE_KEY]: 'junior',
      [`${EXERCISE_PROGRESS_PREFIX}scoreboard`]: raw[`${EXERCISE_PROGRESS_PREFIX}scoreboard`],
      [`${EXERCISE_PROGRESS_PREFIX}scoreboard-connector`]: raw[`${EXERCISE_PROGRESS_PREFIX}scoreboard-connector`],
      [`${EXERCISE_ANALYTICS_PREFIX}scoreboard-connector`]: raw[`${EXERCISE_ANALYTICS_PREFIX}scoreboard-connector`],
    });
    expect(JSON.parse(exported.legacy[`${EXERCISE_PROGRESS_PREFIX}scoreboard-connector`])).toMatchObject({ bestScore: 70, attempts: 1 });
    expect(exported.recovered).toEqual({});

    const text = serializeLearnerData(exported);
    expect(text).not.toContain(`"${THEME_KEY}"`);
    expect(text).not.toContain('ocean-dark');
    expect(text).not.toContain(OUTLINE_COLLAPSED_KEY);
    expect(text).not.toContain('someone-elses-key');
  });

  it('records the export in meta.lastExportAt, unless told not to', () => {
    seedBrowser('a');
    const withoutMark = exportLearnerData({ now: NOW, markExported: false });
    expect(metaRecord.read().lastExportAt).toBeUndefined();
    // The bundle's own meta already says when it was exported.
    expect(withoutMark.records[META_KEY]).toEqual({ v: 1, data: expect.objectContaining({ lastExportAt: NOW }) });

    exportLearnerData({ now: NOW + 10 });
    expect(metaRecord.read().lastExportAt).toBe(NOW + 10);
  });

  it('carries an unreadable record as a recovered raw copy instead of dropping it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.localStorage.setItem(ACTIVITY_KEY, '{not json');
    window.localStorage.setItem(recoveredKeyFor(FLASHCARDS_KEY), 'older broken copy');

    const exported = exportLearnerData({ now: NOW });

    expect(exported.records[ACTIVITY_KEY]).toBeUndefined();
    expect(exported.recovered).toEqual({
      [recoveredKeyFor(ACTIVITY_KEY)]: '{not json',
      [recoveredKeyFor(FLASHCARDS_KEY)]: 'older broken copy',
    });
  });

  it('carries the value that is unreadable now, and keeps an older copy of it beside it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.localStorage.setItem(ACTIVITY_KEY, 'broken again');
    window.localStorage.setItem(recoveredKeyFor(ACTIVITY_KEY), 'broken first');
    const previousKey = `${RECOVERED_KEY_PREFIX}previous:${ACTIVITY_KEY}`;

    const exported = exportLearnerData({ now: NOW });
    expect(exported.recovered).toEqual({
      [recoveredKeyFor(ACTIVITY_KEY)]: 'broken again',
      [previousKey]: 'broken first',
    });

    // A reset and a re-import lose neither value.
    resetLearnerData();
    expect(importLearnerData(exported, 'replace')).toMatchObject({ ok: true });
    expect(window.localStorage.getItem(recoveredKeyFor(ACTIVITY_KEY))).toBe('broken again');
    expect(window.localStorage.getItem(previousKey)).toBe('broken first');

    // The same unreadable value already copied is carried once.
    window.localStorage.setItem(ACTIVITY_KEY, 'broken again');
    window.localStorage.removeItem(previousKey);
    expect(exportLearnerData({ now: NOW }).recovered).toEqual({ [recoveredKeyFor(ACTIVITY_KEY)]: 'broken again' });
  });

  it(`checks the ${LEARNER_DATA_MAX_LABEL} import limit in UTF-8 bytes, so the export can warn before a backup can't be imported`, () => {
    expect(LEARNER_DATA_MAX_BYTES).toBe(16 * 1024 * 1024);
    expect(fitsImportLimit(serializeLearnerData(exportLearnerData({ now: NOW, markExported: false })))).toBe(true);
    // One character under the limit, but 3 bytes each in UTF-8.
    const cjk = '\u5b66'.repeat(Math.ceil(LEARNER_DATA_MAX_BYTES / 3) + 1);
    expect(cjk.length).toBeLessThan(LEARNER_DATA_MAX_BYTES);
    expect(fitsImportLimit(cjk)).toBe(false);
    expect(previewLearnerData(cjk)).toEqual({ ok: false, error: BACKUP_ERRORS.tooLarge });
    // A surrogate pair is one 4-byte character: these fill the limit exactly, and one more byte passes it.
    const emoji = '\ud83d\ude00'.repeat(LEARNER_DATA_MAX_BYTES / 4);
    expect(fitsImportLimit(emoji)).toBe(true);
    expect(fitsImportLimit(`${emoji}x`)).toBe(false);
  });

  it('names the file after the local day', () => {
    expect(learnerDataFileName(NOW)).toBe('sv-uvm-guide-learning-data-2026-10-18.json');
  });

  it('estimates usage from the learner keys only', () => {
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, '{}');
    window.localStorage.setItem(ROUTE_STORAGE_KEY, 'junior');
    window.localStorage.setItem(THEME_KEY, 'ocean-dark');
    const expected = (CURRICULUM_PROGRESS_KEY.length + 2 + ROUTE_STORAGE_KEY.length + 'junior'.length) * 2;
    expect(estimateLearnerDataBytes()).toBe(expected);
  });
});

describe('previewLearnerData and importLearnerData: the file is untrusted', () => {
  it('rejects text that is not JSON', () => {
    expect(previewLearnerData('this is not json')).toEqual({ ok: false, error: BACKUP_ERRORS.notJson });
  });

  it('rejects a wrong format, a missing or newer schemaVersion, and anything that is not a string', () => {
    expect(previewLearnerData(JSON.stringify({ ...bundle({}), format: 'someone-else/data' }))).toEqual({
      ok: false,
      error: BACKUP_ERRORS.notBackup,
    });
    expect(previewLearnerData(JSON.stringify({ ...bundle({}), schemaVersion: undefined }))).toEqual({
      ok: false,
      error: BACKUP_ERRORS.notBackup,
    });
    expect(previewLearnerData(JSON.stringify({ ...bundle({}), schemaVersion: 2 }))).toEqual({
      ok: false,
      error: BACKUP_ERRORS.newer,
    });
    expect(previewLearnerData(JSON.stringify({ ...bundle({}), records: [] }))).toEqual({
      ok: false,
      error: BACKUP_ERRORS.notBackup,
    });
    expect(previewLearnerData(JSON.stringify([1, 2, 3]))).toEqual({ ok: false, error: BACKUP_ERRORS.notBackup });
    expect(previewLearnerData(42)).toEqual({ ok: false, error: BACKUP_ERRORS.notBackup });
  });

  it(`rejects files over ${LEARNER_DATA_MAX_LABEL}, before reading them`, async () => {
    const tooLong = ' '.repeat(LEARNER_DATA_MAX_BYTES + 1);
    expect(previewLearnerData(tooLong)).toEqual({ ok: false, error: BACKUP_ERRORS.tooLarge });

    const file = new Blob(['{}'], { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: LEARNER_DATA_MAX_BYTES + 1 });
    const text = vi.fn(() => Promise.resolve('{}'));
    Object.defineProperty(file, 'text', { value: text });
    await expect(previewLearnerDataFile(file)).resolves.toEqual({ ok: false, error: BACKUP_ERRORS.tooLarge });
    expect(text).not.toHaveBeenCalled();
  });

  it('reads a chosen file and previews it', async () => {
    const exported = backupOf('a');
    const file = new Blob([serializeLearnerData(exported)], { type: 'application/json' });
    const preview = expectPreview(await previewLearnerDataFile(file));
    expect(preview.areas.curriculum).toEqual({ entries: 1, items: 1, invalid: 0, newer: 0 });
  });

  it('changes nothing when importLearnerData gets a wrong format or a newer schemaVersion', () => {
    seedBrowser('a');
    const before = rawStore();
    expect(importLearnerData({ ...bundle({}), format: 'nope' }, 'replace')).toEqual({ ok: false, error: BACKUP_ERRORS.notBackup });
    expect(importLearnerData({ ...bundle({}), schemaVersion: 3 }, 'replace')).toEqual({ ok: false, error: BACKUP_ERRORS.newer });
    expect(importLearnerData('{"format":"sv-uvm-guide/learner-data"}', 'merge')).toEqual({ ok: false, error: BACKUP_ERRORS.notBackup });
    expect(importLearnerData(bundle({}), 'overwrite' as never)).toEqual({ ok: false, error: BACKUP_ERRORS.badMode });
    expect(rawStore()).toEqual(before);
  });

  it('counts invalid entries per area, skips them, and ignores unknown keys', () => {
    const analytics = Array.from({ length: 250 }, (_, index) => ({ type: 'interaction', value: 1, timestamp: NOW + index }));
    const input = bundle({
      records: {
        [FLASHCARDS_KEY]: { v: 1, data: 'not flashcards' },
        [LESSONS_KEY]: { v: 1, data: { lessons: { [LESSON_A]: { firstVisitedAt: NOW, lastVisitedAt: NOW, visits: 2 } } } },
        // The entry's id must match its key.
        [`${NOTEBOOK_KEY_PREFIX}note-1`]: { v: 1, data: note('note-2', 'mismatched id') },
        [`${NOTEBOOK_KEY_PREFIX}note-3`]: { v: 1, data: note('note-3', '<img src=x onerror="alert(1)"> kept as text') },
        [`${LAB_KEY_PREFIX}lab-a@1`]: { v: 2, data: lab('lab-a') },
        'sv-uvm-guide:unknown-record': { v: 1, data: {} },
        [THEME_KEY]: { v: 1, data: 'ocean-dark' },
      },
      legacy: {
        [ROUTE_STORAGE_KEY]: 'nonsense',
        [`${EXERCISE_PROGRESS_PREFIX}bad`]: JSON.stringify({ bestScore: 'high', attempts: 1 }),
        [`${EXERCISE_ANALYTICS_PREFIX}chatty`]: JSON.stringify(analytics),
        [CURRICULUM_PROGRESS_KEY]: 7 as unknown as string,
        [OUTLINE_COLLAPSED_KEY]: 'true',
      },
      recovered: {
        [recoveredKeyFor(ACTIVITY_KEY)]: 'x'.repeat(RECOVERED_MAX_CHARS + 1),
        'not-a-recovered-key': 'raw',
      },
    });
    // A "__proto__" key, as JSON.parse creates it: an own key, which must be ignored rather than pollute anything.
    const text = JSON.stringify(input).replace('"records":{', '"records":{"__proto__":{"v":1,"data":{"polluted":true}},');
    expect(text).toContain('"__proto__"');

    const preview = expectPreview(previewLearnerData(text));
    // Previewing writes nothing.
    expect(window.localStorage.length).toBe(0);
    expect(preview.areas.flashcards).toEqual({ entries: 0, items: 0, invalid: 1, newer: 0 });
    expect(preview.areas.lessons).toEqual({ entries: 1, items: 1, invalid: 0, newer: 0 });
    expect(preview.areas.notebook).toEqual({ entries: 1, items: 1, invalid: 1, newer: 0 });
    expect(preview.areas.labs).toEqual({ entries: 0, items: 0, invalid: 0, newer: 1 });
    expect(preview.areas.route).toEqual({ entries: 0, items: 0, invalid: 1, newer: 0 });
    expect(preview.areas.exercises).toEqual({ entries: 1, items: 0, invalid: 1, newer: 0 });
    expect(preview.areas.curriculum).toEqual({ entries: 0, items: 0, invalid: 1, newer: 0 });
    expect(preview.areas.recovered).toEqual({ entries: 0, items: 0, invalid: 1, newer: 0 });
    expect(preview.invalidEntries).toBe(6);
    expect(preview.newerEntries).toBe(1);
    expect(preview.ignoredKeys).toBe(5);

    const report = importLearnerData(preview.bundle, 'merge');
    if (!report.ok) throw new Error(report.error);
    expect(report.areas.flashcards).toEqual({ imported: 0, skipped: 0, keptLocal: 0, invalid: 1 });
    expect(report.areas.lessons).toEqual({ imported: 1, skipped: 0, keptLocal: 0, invalid: 0 });
    expect(report.areas.notebook).toEqual({ imported: 1, skipped: 0, keptLocal: 0, invalid: 1 });
    expect(report.areas.labs).toEqual({ imported: 0, skipped: 1, keptLocal: 0, invalid: 0 });
    expect(report.areas.exercises).toEqual({ imported: 1, skipped: 0, keptLocal: 0, invalid: 1 });
    expect(report.ignored).toBe(5);

    const stored = rawStore();
    expect(Object.keys(stored).sort()).toEqual(
      [LESSONS_KEY, `${NOTEBOOK_KEY_PREFIX}note-3`, `${EXERCISE_ANALYTICS_PREFIX}chatty`].sort(),
    );
    expect(notebookEntries.get('note-3')?.body).toBe('<img src=x onerror="alert(1)"> kept as text');
    const keptEvents = JSON.parse(stored[`${EXERCISE_ANALYTICS_PREFIX}chatty`]) as { timestamp: number }[];
    expect(keptEvents).toHaveLength(200);
    expect(keptEvents[keptEvents.length - 1].timestamp).toBe(NOW + 249);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("refuses a backup with nothing usable, so 'replace' never deletes data to write nothing", () => {
    seedBrowser('a');
    const before = rawStore();
    const useless = bundle({ records: { [FLASHCARDS_KEY]: { v: 1, data: null } }, legacy: { [ROUTE_STORAGE_KEY]: 'nope' } });
    expect(importLearnerData(useless, 'replace')).toEqual({ ok: false, error: BACKUP_ERRORS.nothingToImport });
    expect(rawStore()).toEqual(before);
  });
});

describe('importLearnerData: merge versus replace', () => {
  it("merge keeps this browser's data and adds the backup's, area by area", () => {
    const backup = backupOf('b');
    seedBrowser('a');
    window.localStorage.setItem(THEME_KEY, 'forest-light');

    const report = importLearnerData(backup, 'merge');
    if (!report.ok) throw new Error(report.error);
    expect(report.mode).toBe('merge');

    expect(curriculumProgressRecord.read()).toEqual({
      F1A: { completedLessons: ['index', 'deep-dive'], completedAt: { index: NOW - 3_000 } },
      F1B: { completedLessons: ['index'] },
    });
    expect(Object.keys(lessonLogRecord.read().lessons).sort()).toEqual([LESSON_A, LESSON_B].sort());
    expect(Object.keys(flashcardRecord.read().cards).sort()).toEqual(['card-a', 'card-b']);
    expect(notebookEntries.list().map((entry) => entry.id)).toEqual(['note-a', 'note-b']);
    expect(labProgressRecords.list().map((entry) => entry.id)).toEqual(['lab-a@1', 'lab-b@1']);
    expect(Object.keys(assessmentRecord.read().quizzes).sort()).toEqual([`${LESSON_A}#aaaaaaaa`, `${LESSON_B}#bbbbbbbb`].sort());
    expect(Object.keys(activityRecord.read().days)).toHaveLength(2);
    // Exercise scores: the best score and the most attempts win.
    expect(JSON.parse(window.localStorage.getItem(`${EXERCISE_PROGRESS_PREFIX}scoreboard`) ?? 'null')).toEqual({ bestScore: 90, attempts: 5 });
    expect(JSON.parse(window.localStorage.getItem(`${EXERCISE_PROGRESS_PREFIX}arbiter`) ?? 'null')).toEqual({ bestScore: 40, attempts: 1 });
    // The route this browser chose is kept: counted as kept, not as a skipped entry.
    expect(readSelectedRoute()).toBe('junior');
    expect(report.areas.route).toEqual({ imported: 0, skipped: 0, keptLocal: 1, invalid: 0 });
    expect(report.keptLocal).toBe(1);
    expect(window.localStorage.getItem(THEME_KEY)).toBe('forest-light');
  });

  it("merge takes the backup's route when this browser has none", () => {
    const backup = backupOf('b');
    expect(importLearnerData(backup, 'merge')).toMatchObject({ ok: true });
    expect(readSelectedRoute()).toBe('expert');
  });

  it("replace deletes this browser's data first, then restores the backup exactly", () => {
    const backup = backupOf('b');
    seedBrowser('b');
    const expected = rawStore();
    resetLearnerData();
    seedBrowser('a');
    window.localStorage.setItem(THEME_KEY, 'forest-light');
    window.localStorage.setItem(recoveredKeyFor(FLASHCARDS_KEY), 'stale copy');

    const report = importLearnerData(backup, 'replace');
    if (!report.ok) throw new Error(report.error);

    const after = rawStore();
    expect(after[THEME_KEY]).toBe('forest-light');
    delete after[THEME_KEY];
    // The backup's meta records when it was exported.
    expect(JSON.parse(after[META_KEY])).toEqual({ v: 1, data: expect.objectContaining({ lastExportAt: NOW }) });
    delete after[META_KEY];
    expect(after).toEqual(expected);
    expect(readSelectedRoute()).toBe('expert');
    expect(report.areas.curriculum.imported).toBe(1);
    expect(report.areas.route.imported).toBe(1);
    expect(report.areas.exercises.imported).toBe(2);
    expect(report.invalid).toBe(0);
  });

  it('merge keeps an existing recovered copy and adds new ones', () => {
    window.localStorage.setItem(recoveredKeyFor(FLASHCARDS_KEY), 'local copy');
    const input = bundle({
      recovered: { [recoveredKeyFor(FLASHCARDS_KEY)]: 'backup copy', [recoveredKeyFor(LESSONS_KEY)]: 'other copy' },
    });
    const report = importLearnerData(input, 'merge');
    if (!report.ok) throw new Error(report.error);
    expect(report.areas.recovered).toEqual({ imported: 1, skipped: 0, keptLocal: 1, invalid: 0 });
    expect(report.skipped).toBe(0);
    expect(window.localStorage.getItem(recoveredKeyFor(FLASHCARDS_KEY))).toBe('local copy');
    expect(window.localStorage.getItem(recoveredKeyFor(LESSONS_KEY))).toBe('other copy');
  });

  it('round-trips: export, reset, then import restores every key byte for byte', () => {
    seedBrowser('a');
    const exported = exportLearnerData({ now: NOW });
    const before = rawStore();

    resetLearnerData();
    expect(window.localStorage.length).toBe(0);

    const preview = expectPreview(previewLearnerData(serializeLearnerData(exported)));
    expect(importLearnerData(preview.bundle, 'replace')).toMatchObject({ ok: true, invalid: 0, skipped: 0 });
    expect(rawStore()).toEqual(before);
  });
});

describe('importLearnerData: times a Date cannot hold, or far in the future', () => {
  const NOTE_ID = 'note-times';
  const DAY = 86_400_000;

  function timesBundle() {
    return bundle({
      records: {
        // A hand-edited backup: Intl would throw 'Invalid time value' on any of these.
        [META_KEY]: { v: 1, data: { schemaVersion: 1, createdAt: 1, lastExportAt: 1e300 } },
        [`${NOTEBOOK_KEY_PREFIX}${NOTE_ID}`]: { v: 1, data: { ...note(NOTE_ID, 'body', NOW), updatedAt: 1e300 } },
        [LESSONS_KEY]: {
          v: 1,
          data: {
            lessons: {
              [LESSON_A]: { firstVisitedAt: NOW, lastVisitedAt: -1e300, visits: 2 },
              [LESSON_B]: { firstVisitedAt: NOW - DAY, lastVisitedAt: NOW + 30 * DAY, visits: 1 },
            },
          },
        },
        [FLASHCARDS_KEY]: {
          v: 1,
          data: {
            cards: {
              broken: { ...card('deck', NOW), dueAt: 1e300 },
              // Due in a year: a future dueAt is how spaced repetition works.
              later: { ...card('deck', NOW), dueAt: NOW + 365 * DAY },
            },
            decks: {},
            positions: {},
          },
        },
      },
      legacy: {
        [CURRICULUM_PROGRESS_KEY]: JSON.stringify({ F1A: { completedLessons: ['index'], completedAt: { index: 9e15 }, lastVisitedAt: 9e15 } }),
        [`${EXERCISE_ANALYTICS_PREFIX}times`]: JSON.stringify([
          { type: 'interaction', value: 1, timestamp: 1e300 },
          { type: 'assessment', value: 80, timestamp: NOW },
        ]),
      },
    });
  }

  it('drops a time no Date can hold, so the parse falls back, and pulls a time far ahead back to now', () => {
    const preview = expectPreview(previewLearnerData(JSON.stringify(timesBundle()), { now: NOW }));
    expect(preview.invalidEntries).toBe(0);
    // The lesson visit with no usable time is left out; the card due in 1e300 ms too.
    expect(preview.areas.lessons.items).toBe(1);
    expect(preview.areas.flashcards.items).toBe(1);

    const report = importLearnerData(preview.bundle, 'merge', { now: NOW });
    if (!report.ok) throw new Error(report.error);
    expect(report.invalid).toBe(0);

    const meta = metaRecord.read();
    expect(meta.createdAt).toBe(1);
    expect(meta.lastExportAt).toBeUndefined();
    const entry = notebookEntries.get(NOTE_ID);
    expect(entry?.updatedAt).toBe(entry?.createdAt);
    expect(lessonLogRecord.read().lessons).toEqual({ [LESSON_B]: { firstVisitedAt: NOW - DAY, lastVisitedAt: NOW, visits: 1 } });
    expect(Object.keys(flashcardRecord.read().cards)).toEqual(['later']);
    expect(flashcardRecord.read().cards.later.dueAt).toBe(NOW + 365 * DAY);
    expect(curriculumProgressRecord.read()).toEqual({ F1A: { completedLessons: ['index'] } });
    expect(JSON.parse(window.localStorage.getItem(`${EXERCISE_ANALYTICS_PREFIX}times`) ?? '[]')).toEqual([
      { type: 'assessment', value: 80, timestamp: NOW },
    ]);
    // Every stored time can be shown.
    const format = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
    expect(() => format.format(entry?.updatedAt)).not.toThrow();
  });

  it("a 'replace' of a backup with a future lastExportAt keeps the backup reminder working", () => {
    const input = bundle({ records: { [META_KEY]: { v: 1, data: { schemaVersion: 1, createdAt: NOW - DAY, lastExportAt: NOW + 400 * DAY } } } });
    expect(importLearnerData(input, 'replace', { now: NOW })).toMatchObject({ ok: true, invalid: 0 });
    expect(metaRecord.read()).toEqual({ schemaVersion: 1, createdAt: NOW - DAY, lastExportAt: NOW });
  });

  it("counts an analytics history whose every time is unusable as invalid", () => {
    const input = bundle({
      legacy: { [`${EXERCISE_ANALYTICS_PREFIX}times`]: JSON.stringify([{ type: 'interaction', value: 1, timestamp: 1e300 }]) },
    });
    const preview = expectPreview(previewLearnerData(JSON.stringify(input), { now: NOW }));
    expect(preview.areas.exercises).toEqual({ entries: 0, items: 0, invalid: 1, newer: 0 });
  });

  it('leaves an own "__proto__" key a plain key while it fixes the times beside it', () => {
    const text = JSON.stringify(bundle({ records: { [LESSONS_KEY]: { v: 1, data: { lessons: {} } } } })).replace(
      '"lessons":{}',
      `"lessons":{"__proto__":{"lastVisitedAt":1e300},"${LESSON_A}":{"firstVisitedAt":${NOW},"lastVisitedAt":1e300,"visits":1}}`,
    );
    const report = importLearnerData(expectPreview(previewLearnerData(text, { now: NOW })).bundle, 'merge', { now: NOW });
    expect(report).toMatchObject({ ok: true });
    expect(Object.getPrototypeOf(lessonLogRecord.read().lessons)).toBe(Object.prototype);
    expect(({} as { lastVisitedAt?: number }).lastVisitedAt).toBeUndefined();
  });
});

describe('importLearnerData: a write that throws', () => {
  it("'replace' puts back what it deleted, tells the listeners, and reports an error", () => {
    const backup = backupOf('b');
    seedBrowser('a');
    window.localStorage.setItem(THEME_KEY, 'forest-light');
    const before = rawStore();
    const changed = vi.fn();
    window.addEventListener(LEARNER_DATA_CHANGED_EVENT, changed);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Flashcards are written after lesson progress and the lesson log, so the throw comes partway through.
    vi.spyOn(flashcardRecord, 'write').mockImplementation(() => {
      throw new Error('write failed');
    });

    expect(importLearnerData(backup, 'replace')).toEqual({ ok: false, error: BACKUP_ERRORS.replaceFailed });

    expect(rawStore()).toEqual(before);
    expect(readSelectedRoute()).toBe('junior');
    expect(changed).toHaveBeenCalledTimes(1);
    window.removeEventListener(LEARNER_DATA_CHANGED_EVENT, changed);
  });

  it("'merge' keeps what it merged, deletes nothing, tells the listeners, and reports an error", () => {
    const backup = backupOf('b');
    seedBrowser('a');
    const changed = vi.fn();
    window.addEventListener(LEARNER_DATA_CHANGED_EVENT, changed);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(flashcardRecord, 'update').mockImplementation(() => {
      throw new Error('write failed');
    });

    expect(importLearnerData(backup, 'merge')).toEqual({ ok: false, error: BACKUP_ERRORS.mergeFailed });

    // Lesson progress was merged before the throw; this browser's own data is all still there.
    expect(Object.keys(curriculumProgressRecord.read()).sort()).toEqual(['F1A', 'F1B']);
    expect(Object.keys(flashcardRecord.read().cards)).toEqual(['card-a']);
    expect(readSelectedRoute()).toBe('junior');
    expect(changed).toHaveBeenCalledTimes(1);
    window.removeEventListener(LEARNER_DATA_CHANGED_EVENT, changed);
  });
});

describe('resetLearnerData', () => {
  it('removes only the known learner keys, including recovered copies', () => {
    seedBrowser('a');
    window.localStorage.setItem(recoveredKeyFor(ACTIVITY_KEY), 'broken');
    window.localStorage.setItem(`${EXERCISE_ANALYTICS_PREFIX}scoreboard`, '[]');
    window.localStorage.setItem(THEME_KEY, 'ocean-dark');
    window.localStorage.setItem(OUTLINE_COLLAPSED_KEY, 'true');
    window.localStorage.setItem('sv-uvm-guide:not-a-learner-key', 'keep');
    window.localStorage.setItem('another-site-key', 'keep');
    const learnerKeys = Object.keys(rawStore()).length - 4;

    expect(resetLearnerData()).toEqual({ removed: learnerKeys });

    expect(rawStore()).toEqual({
      [THEME_KEY]: 'ocean-dark',
      [OUTLINE_COLLAPSED_KEY]: 'true',
      'sv-uvm-guide:not-a-learner-key': 'keep',
      'another-site-key': 'keep',
    });
  });
});

describe('listeners after an import or a reset', () => {
  it('notify the store, then the route, then LEARNER_DATA_CHANGED_EVENT', () => {
    const backup = backupOf('b');
    const calls: string[] = [];
    const unsubscribeStore = subscribeLearnerStore(() => calls.push('store'));
    const unsubscribeRoute = subscribeSelectedRoute(() => calls.push('route'));
    const onChanged = () => calls.push('learner-data-changed');
    window.addEventListener(LEARNER_DATA_CHANGED_EVENT, onChanged);

    // Each import write also notifies the store, so repeats are collapsed: the order is what matters.
    const inOrder = () => calls.filter((call, index) => call !== calls[index - 1]);

    resetLearnerData();
    expect(inOrder()).toEqual(['store', 'route', 'learner-data-changed']);

    calls.length = 0;
    importLearnerData(backup, 'replace');
    expect(inOrder()).toEqual(['store', 'route', 'learner-data-changed']);

    unsubscribeStore();
    unsubscribeRoute();
    window.removeEventListener(LEARNER_DATA_CHANGED_EVENT, onChanged);
  });

  it('a subscribed record, subscribeSelectedRoute and useExerciseProgress all see the new values without a reload', () => {
    seedBrowser('a');
    const exported = exportLearnerData({ now: NOW });

    const progress = renderHook(() => useRecord(curriculumProgressRecord));
    const exercise = renderHook(() => useExerciseProgress('scoreboard'));
    const routeSeen: (string | null)[] = [];
    const unsubscribeRoute = subscribeSelectedRoute(() => routeSeen.push(readSelectedRoute()));

    expect(progress.result.current).toEqual({ F1A: { completedLessons: ['index'], completedAt: { index: NOW - 3_000 } } });
    expect(exercise.result.current.progress.bestScore).toBe(90);

    act(() => {
      resetLearnerData();
    });
    expect(progress.result.current).toEqual({});
    expect(exercise.result.current.progress).toMatchObject({ bestScore: 0, attempts: 0 });
    expect(routeSeen).toEqual([null]);

    // A new attempt builds on the reset, not on the numbers this tab had before.
    act(() => {
      exercise.result.current.recordAttempt(20);
    });
    expect(exercise.result.current.progress).toMatchObject({ bestScore: 20, attempts: 1 });

    act(() => {
      importLearnerData(exported, 'replace');
    });
    expect(progress.result.current).toEqual({ F1A: { completedLessons: ['index'], completedAt: { index: NOW - 3_000 } } });
    expect(exercise.result.current.progress).toMatchObject({ bestScore: 90, attempts: 3 });
    expect(routeSeen).toEqual([null, 'junior']);

    unsubscribeRoute();
    progress.unmount();
    exercise.unmount();
  });
});
