import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useExerciseProgress } from '@/hooks/useExerciseProgress';
import { writeSelectedRoute } from '@/lib/learning-route-state';
import {
  __resetRecordsForTests,
  __resetStorageForTests,
  activityCutoffDayKey,
  activityRecord,
  addDays,
  addPlacementAttempt,
  ASSESSMENTS_MAX_CHARS,
  assessmentRecord,
  boundQuizResults,
  canonicalLessonPath,
  countDueCards,
  createLearnerId,
  createNote,
  curriculumProgressRecord,
  dayKeysBetween,
  endOfLocalDay,
  fnv1a32Hex,
  flashcardRecord,
  isCardDue,
  isLearnerKey,
  isLegacyKey,
  isTimestamp,
  isValidRouteRaw,
  labProgressRecords,
  labRecordId,
  learnerRecords,
  lessonLogRecord,
  listLabRecords,
  localDayKey,
  logLessonVisit,
  markExported,
  mergeActivityData,
  mergeAssessmentData,
  mergeCurriculumProgress,
  mergeFlashcardData,
  mergeLabProgress,
  mergeLearnerMeta,
  mergeLessonLog,
  mergeNotebookEntry,
  metaRecord,
  normalizeLegacyRaw,
  notebookEntries,
  notebookTotalChars,
  NOTEBOOK_BODY_MAX_CHARS,
  NOTEBOOK_MAX_ENTRIES,
  NOTEBOOK_TITLE_MAX_CHARS,
  NOTEBOOK_TOTAL_MAX_CHARS,
  parseActivityData,
  parseAssessmentData,
  parseExerciseAnalyticsRaw,
  parseExerciseProgressRaw,
  parseFlashcardData,
  parseLabProgressRecord,
  parseLabRecordId,
  parseLearnerMeta,
  parseLessonLog,
  parseNotebookEntry,
  QUIZ_RESULTS_MAX,
  quizIdFromQuestions,
  quizResultKey,
  readExerciseProgress,
  readLegacyRawEntries,
  readSelectedRouteRaw,
  recordActivity,
  recordQuizResult,
  removeEntry,
  startOfLocalDay,
  teachBackEntryId,
  timestampOr,
  totalLabRecordChars,
  updateEntry,
  upsertTeachBack,
  type FlashcardData,
  type LabProgressRecord,
  type NotebookEntry,
  type PlacementAttempt,
  type QuizResult,
  type SrsCardState,
} from '@/lib/learner-store';

const storage = window.localStorage;

/** A local wall-clock time, independent of the machine's time zone. */
function local(year: number, month: number, day: number, hours = 12, minutes = 0): number {
  return new Date(year, month - 1, day, hours, minutes).getTime();
}

function stored(key: string): unknown {
  const raw = storage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  __resetStorageForTests();
  __resetRecordsForTests();
  storage.clear();
});

afterEach(() => {
  storage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
  vi.restoreAllMocks();
});

describe('keys', () => {
  it('knows the learner keys and leaves the theme and outline keys out', () => {
    expect(isLearnerKey('sv-uvm-guide:meta')).toBe(true);
    expect(isLearnerKey('sv-uvm-guide:lab:basics-1@2')).toBe(true);
    expect(isLearnerKey('sv-uvm-guide:notebook:abc')).toBe(true);
    expect(isLearnerKey('sv-uvm-guide:recovered:curriculumProgress')).toBe(true);
    expect(isLearnerKey('sv-uvm-guide:exercise:fifo')).toBe(true);
    expect(isLearnerKey('sv-uvm-guide:exercise-analytics:fifo')).toBe(true);
    expect(isLearnerKey('curriculumProgress')).toBe(true);
    expect(isLearnerKey('svuvm.learningRoute')).toBe(true);
    expect(isLearnerKey('theme')).toBe(false);
    expect(isLearnerKey('sv-uvm:outline-collapsed')).toBe(false);
    expect(isLearnerKey('sv-uvm-guide:lab:')).toBe(false);
    expect(isLearnerKey('sv-uvm-guide:something-else')).toBe(false);

    expect(isLegacyKey('curriculumProgress')).toBe(true);
    expect(isLegacyKey('svuvm.learningRoute')).toBe(true);
    expect(isLegacyKey('sv-uvm-guide:exercise:fifo')).toBe(true);
    expect(isLegacyKey('sv-uvm-guide:flashcards')).toBe(false);
  });

  it('hashes with 32-bit FNV-1a and creates ids', () => {
    expect(fnv1a32Hex('')).toBe('811c9dc5');
    expect(fnv1a32Hex('a')).toBe('e40c292c');
    expect(fnv1a32Hex('foobar')).toBe('bf9cf968');

    expect(createLearnerId()).toMatch(/^[0-9a-f-]{36}$/);
    vi.stubGlobal('crypto', undefined);
    expect(createLearnerId()).toMatch(/^[0-9a-z]+-[0-9a-z]{10}$/);
    vi.unstubAllGlobals();
  });
});

describe('time', () => {
  it('uses the local calendar day', () => {
    const lateEvening = local(2026, 10, 18, 23, 30);
    expect(localDayKey(lateEvening)).toBe('2026-10-18');
    expect(startOfLocalDay(lateEvening)).toBe(local(2026, 10, 18, 0, 0));
    expect(endOfLocalDay(lateEvening)).toBe(local(2026, 10, 19, 0, 0) - 1);
    expect(localDayKey(addDays(lateEvening, 1))).toBe('2026-10-19');
    expect(localDayKey(addDays(local(2026, 3, 1), -1))).toBe('2026-02-28');
  });

  it('lists every day key between two times, inclusive', () => {
    expect(dayKeysBetween(local(2026, 12, 30, 22), local(2027, 1, 2, 1))).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
    expect(dayKeysBetween(local(2026, 1, 2), local(2026, 1, 1))).toEqual([]);
  });
});

describe('meta', () => {
  it('validates, marks exports and merges', () => {
    expect(parseLearnerMeta({ createdAt: 'x', lastExportAt: -1, extra: true })).toEqual({ schemaVersion: 1, createdAt: 0 });
    expect(parseLearnerMeta('nope')).toBeNull();

    expect(markExported(1_000)).toBe('saved');
    expect(metaRecord.read()).toEqual({ schemaVersion: 1, createdAt: 1_000, lastExportAt: 1_000 });
    markExported(2_000);
    expect(metaRecord.read()).toEqual({ schemaVersion: 1, createdAt: 1_000, lastExportAt: 2_000 });

    expect(
      mergeLearnerMeta({ schemaVersion: 1, createdAt: 500 }, { schemaVersion: 1, createdAt: 300, lastExportAt: 900 }),
    ).toEqual({ schemaVersion: 1, createdAt: 300, lastExportAt: 900 });
  });

  it('drops stored times no Date can hold, and an export time more than a day ahead', () => {
    const now = new Date(2026, 9, 18, 12).getTime();
    const day = 24 * 60 * 60 * 1000;
    expect(parseLearnerMeta({ createdAt: 1e300, lastExportAt: 1e300 }, now)).toEqual({ schemaVersion: 1, createdAt: 0 });
    expect(parseLearnerMeta({ createdAt: 1, lastExportAt: now + 2 * day }, now)).toEqual({ schemaVersion: 1, createdAt: 1 });
    expect(parseLearnerMeta({ createdAt: 1, lastExportAt: now + day / 2 }, now)).toEqual({
      schemaVersion: 1,
      createdAt: 1,
      lastExportAt: now + day / 2,
    });

    // Already in storage (from an old import or a hand edit): reads clean, so no page formats 1e300.
    window.localStorage.setItem('sv-uvm-guide:meta', JSON.stringify({ v: 1, data: { schemaVersion: 1, createdAt: 1, lastExportAt: 1e300 } }));
    __resetRecordsForTests();
    expect(metaRecord.read()).toEqual({ schemaVersion: 1, createdAt: 1 });
  });

  it('isTimestamp accepts only times a Date can hold', () => {
    expect(isTimestamp(0)).toBe(true);
    expect(isTimestamp(8.64e15)).toBe(true);
    expect(isTimestamp(8.64e15 + 1)).toBe(false);
    expect(isTimestamp(1e300)).toBe(false);
    expect(isTimestamp(-1)).toBe(false);
    expect(isTimestamp(Number.NaN)).toBe(false);
    expect(timestampOr(1e300, 7)).toBe(7);
  });
});

describe('labs', () => {
  const base: LabProgressRecord = {
    labId: 'basics-1',
    labVersion: '2',
    currentStepId: 'step-2',
    completedSteps: ['step-1'],
    stepEvidence: { 'step-1': { kind: 'self_attested', stepVersion: '1', recordedAt: 100 } },
    fileBuffers: { 'src/top.sv': 'module top; endmodule' },
    status: 'in_progress',
    startedAt: 50,
    updatedAt: 100,
  };

  it('builds and splits lab record ids', () => {
    expect(labRecordId('basics-1', '2')).toBe('basics-1@2');
    expect(parseLabRecordId('basics-1@2')).toEqual({ labId: 'basics-1', labVersion: '2' });
    expect(parseLabRecordId('odd@name@3')).toEqual({ labId: 'odd@name', labVersion: '3' });
    expect(parseLabRecordId('no-version')).toBeNull();
    expect(parseLabRecordId('@2')).toBeNull();
  });

  it('drops malformed fields and rejects records without a matching id', () => {
    const parsed = parseLabProgressRecord(
      {
        ...base,
        currentStepId: 7,
        completedSteps: ['step-1', 3, 'step-1', ''],
        stepEvidence: {
          'step-1': base.stepEvidence['step-1'],
          'step-2': { kind: 'graded', graderId: 'g', graderVersion: '1', stepVersion: '1', recordedAt: 5, origin: 'cloud' },
          'step-3': { kind: 'graded', graderId: 'g', graderVersion: '1', stepVersion: '1', recordedAt: 5, origin: 'browser' },
          'step-4': 'yes',
        },
        fileBuffers: { 'a.sv': 'ok', 'b.sv': 12, 'huge.sv': 'x'.repeat(128_001) },
        status: 'weird',
        completedAt: 'soon',
      },
      'basics-1@2',
    );

    expect(parsed).toEqual({
      ...base,
      currentStepId: null,
      completedSteps: ['step-1'],
      stepEvidence: {
        'step-1': base.stepEvidence['step-1'],
        'step-3': { kind: 'graded', graderId: 'g', graderVersion: '1', stepVersion: '1', recordedAt: 5, origin: 'browser' },
      },
      fileBuffers: { 'a.sv': 'ok' },
      status: 'in_progress',
    });
    expect(parseLabProgressRecord(base, 'basics-1@3')).toBeNull();
    expect(parseLabProgressRecord({ ...base, labId: '' })).toBeNull();
  });

  it('lists records newest first, optionally for one lab, and totals their size', () => {
    labProgressRecords.set('basics-1@1', { ...base, labVersion: '1', updatedAt: 10 });
    labProgressRecords.set('basics-1@2', base);
    labProgressRecords.set('fifo@1', { ...base, labId: 'fifo', labVersion: '1', updatedAt: 500 });

    expect(listLabRecords().map((record) => `${record.labId}@${record.labVersion}`)).toEqual([
      'fifo@1',
      'basics-1@2',
      'basics-1@1',
    ]);
    expect(listLabRecords('basics-1').map((record) => record.labVersion)).toEqual(['2', '1']);

    const all = totalLabRecordChars();
    expect(all).toBeGreaterThan(0);
    expect(totalLabRecordChars('fifo@1')).toBe(all - (storage.getItem(labProgressRecords.keyFor('fifo@1'))?.length ?? 0));
  });

  it('merges completions and keeps the newer workspace', () => {
    const other: LabProgressRecord = {
      ...base,
      currentStepId: 'step-3',
      completedSteps: ['step-1', 'step-2'],
      stepEvidence: {
        'step-1': { kind: 'graded', graderId: 'g', graderVersion: '1', stepVersion: '1', recordedAt: 50, origin: 'server' },
        'step-2': { kind: 'self_attested', stepVersion: '1', recordedAt: 150 },
      },
      fileBuffers: { 'src/top.sv': 'newer' },
      status: 'completed',
      startedAt: 70,
      updatedAt: 200,
      completedAt: 200,
    };

    expect(mergeLabProgress(base, other)).toEqual({
      ...base,
      currentStepId: 'step-3',
      completedSteps: ['step-1', 'step-2'],
      stepEvidence: other.stepEvidence,
      fileBuffers: { 'src/top.sv': 'newer' },
      status: 'completed',
      startedAt: 50,
      updatedAt: 200,
      completedAt: 200,
    });
  });
});

describe('flashcards', () => {
  const now = local(2026, 10, 18, 9);
  const card = (overrides: Partial<SrsCardState> = {}): SrsCardState => ({
    deckId: 'F2A',
    interval: 1,
    repetitions: 1,
    ease: 2.5,
    dueAt: now,
    lastReviewedAt: now - 86_400_000,
    lapses: 0,
    reviews: 1,
    ...overrides,
  });

  it('drops malformed card states, decks and positions', () => {
    const parsed = parseFlashcardData({
      cards: { good: card(), noDeck: { ...card(), deckId: '' }, badEase: { ...card(), ease: 'high' }, negative: { ...card(), lapses: -1 } },
      decks: {
        F2A: {
          lessons: [{ href: '/a', title: 'A' }, { href: '/a', title: 'dup' }, { href: 3 }, { href: '/b', title: 'B' }, { href: '/c', title: 'C' }, { href: '/d', title: 'D' }],
          cardIds: ['good', 4, 'good'],
          firstSeenAt: 10,
          lastSeenAt: 'later',
        },
        broken: 'x',
      },
      positions: { F2A: 2, bad: -1, worse: 1.5 },
    });

    expect(Object.keys(parsed?.cards ?? {})).toEqual(['good', 'negative']);
    expect(parsed?.cards.negative.lapses).toBe(0);
    expect(parsed?.decks).toEqual({
      F2A: {
        lessons: [{ href: '/a', title: 'A' }, { href: '/b', title: 'B' }, { href: '/c', title: 'C' }],
        cardIds: ['good'],
        firstSeenAt: 10,
        lastSeenAt: 10,
      },
    });
    expect(parsed?.positions).toEqual({ F2A: 2 });
    expect(parseFlashcardData([])).toBeNull();
  });

  it('keeps only same-site lesson links for a deck, and drops a due time no Date can hold', () => {
    const parsed = parseFlashcardData({
      cards: { good: card(), farFuture: card({ dueAt: 1e300 }) },
      decks: {
        F2A: {
          lessons: [
            { href: 'javascript:alert(1)', title: 'Script' },
            { href: '//evil.example/x', title: 'Other host' },
            { href: '/\\evil.example', title: 'Backslash' },
            { href: '/a b', title: 'Whitespace' },
            { href: 'https://evil.example/', title: 'Absolute' },
            { href: '/curriculum/T1_Foundational/F2A/index', title: 'Lesson' },
          ],
          cardIds: ['good'],
          firstSeenAt: 1,
          lastSeenAt: 1,
        },
      },
      positions: {},
    });

    expect(Object.keys(parsed?.cards ?? {})).toEqual(['good']);
    expect(parsed?.decks.F2A.lessons).toEqual([{ href: '/curriculum/T1_Foundational/F2A/index', title: 'Lesson' }]);
  });

  it('counts a card as due until the end of the local day', () => {
    expect(isCardDue(card({ dueAt: local(2026, 10, 18, 23, 59) }), now)).toBe(true);
    expect(isCardDue(card({ dueAt: endOfLocalDay(now) }), now)).toBe(true);
    expect(isCardDue(card({ dueAt: endOfLocalDay(now) + 1 }), now)).toBe(false);
  });

  it("counts only due cards whose ids are in their deck's current card ids", () => {
    const data: FlashcardData = {
      cards: {
        a: card(),
        b: card({ dueAt: local(2026, 10, 18, 22) }),
        removed: card(),
        later: card({ dueAt: local(2026, 10, 20) }),
        otherDeck: card({ deckId: 'I-UVM-1' }),
        orphanDeck: card({ deckId: 'gone' }),
      },
      decks: {
        F2A: { lessons: [], cardIds: ['a', 'b', 'later'], firstSeenAt: 1, lastSeenAt: 1 },
        'I-UVM-1': { lessons: [], cardIds: ['otherDeck'], firstSeenAt: 1, lastSeenAt: 1 },
      },
      positions: {},
    };

    expect(countDueCards(data, now)).toBe(3);
    expect(countDueCards(data, now, 'F2A')).toBe(2);
    expect(countDueCards(data, local(2026, 10, 20, 8))).toBe(4);
  });

  it('merges by the newest lastReviewedAt per card', () => {
    const local1: FlashcardData = {
      cards: { a: card({ lastReviewedAt: 100, interval: 1 }), b: card({ lastReviewedAt: 300, interval: 3 }) },
      decks: { F2A: { lessons: [{ href: '/one', title: 'One' }], cardIds: ['a', 'b'], firstSeenAt: 50, lastSeenAt: 100 } },
      positions: { F2A: 1 },
    };
    const incoming: FlashcardData = {
      cards: { a: card({ lastReviewedAt: 200, interval: 6 }), b: card({ lastReviewedAt: 250, interval: 9 }), c: card() },
      decks: { F2A: { lessons: [{ href: '/two', title: 'Two' }], cardIds: ['a', 'b', 'c'], firstSeenAt: 20, lastSeenAt: 400 } },
      positions: { F2A: 0, X: 2 },
    };

    const merged = mergeFlashcardData(local1, incoming);
    expect(merged.cards.a.interval).toBe(6);
    expect(merged.cards.b.interval).toBe(3);
    expect(merged.cards.c).toBeDefined();
    expect(merged.decks.F2A).toEqual({
      lessons: [{ href: '/two', title: 'Two' }, { href: '/one', title: 'One' }],
      cardIds: ['a', 'b', 'c'],
      firstSeenAt: 20,
      lastSeenAt: 400,
    });
    expect(merged.positions).toEqual({ F2A: 1, X: 2 });
    expect(flashcardRecord.write(merged)).toBe('saved');
  });
});

describe('notebook', () => {
  const entry: NotebookEntry = {
    id: 'n1',
    kind: 'note',
    title: 'Title',
    body: 'Body',
    createdAt: 1,
    updatedAt: 2,
  };

  it('validates entries and drops malformed fields', () => {
    expect(parseNotebookEntry({ ...entry, lessonPath: 5, lessonTitle: 'L', extra: 1 }, 'n1')).toEqual({ ...entry, lessonTitle: 'L' });
    expect(parseNotebookEntry({ ...entry, title: 'x'.repeat(300) })?.title).toHaveLength(NOTEBOOK_TITLE_MAX_CHARS);
    expect(parseNotebookEntry(entry, 'other')).toBeNull();
    expect(parseNotebookEntry({ ...entry, kind: 'essay' })).toBeNull();
    expect(parseNotebookEntry({ ...entry, body: 'x'.repeat(NOTEBOOK_BODY_MAX_CHARS + 1) })).toBeNull();
  });

  it('derives a deterministic, key-safe teach-back id', () => {
    const id = teachBackEntryId('/curriculum/T1_Foundational/F2A_Basic_Data_Types/four-state');
    expect(id).toBe(teachBackEntryId('/curriculum/T1_Foundational/F2A_Basic_Data_Types/four-state'));
    expect(id).toMatch(/^teach-back-[a-z0-9-]+-[0-9a-f]{8}$/);
    expect(teachBackEntryId('/curriculum/a/b/c')).not.toBe(teachBackEntryId('/curriculum/a/b/d'));
  });

  it('creates, updates and keeps a teach-back entry, writing nothing when unchanged', () => {
    const lessonPath = '/curriculum/T1/F2A/four-state';
    expect(upsertTeachBack({ lessonPath, lessonTitle: 'Four-state logic', body: 'X and Z', now: 10 })).toBe('saved');
    const id = teachBackEntryId(lessonPath);
    expect(notebookEntries.get(id)).toEqual({
      id,
      kind: 'teach-back',
      lessonPath,
      lessonTitle: 'Four-state logic',
      title: 'Four-state logic',
      body: 'X and Z',
      createdAt: 10,
      updatedAt: 10,
    });

    const setItem = vi.spyOn(storage, 'setItem');
    expect(upsertTeachBack({ lessonPath, lessonTitle: 'Four-state logic', body: 'X and Z', now: 20 })).toBe('saved');
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();

    upsertTeachBack({ lessonPath, lessonTitle: 'Four-state logic', body: 'X, Z and 0/1', now: 30 });
    expect(notebookEntries.get(id)).toMatchObject({ body: 'X, Z and 0/1', createdAt: 10, updatedAt: 30 });
  });

  it('keeps a teach-back title the learner changed unless a new title is passed', () => {
    const lessonPath = '/curriculum/T1/F2A/four-state';
    const id = teachBackEntryId(lessonPath);
    upsertTeachBack({ lessonPath, lessonTitle: 'Four-state logic', body: 'X and Z', now: 10 });
    expect(updateEntry(id, { title: 'My X/Z summary' }, 15)).toBe('saved');

    expect(upsertTeachBack({ lessonPath, lessonTitle: 'Four-state logic', body: 'X, Z and 0/1', now: 20 })).toBe('saved');
    expect(notebookEntries.get(id)).toMatchObject({ title: 'My X/Z summary', body: 'X, Z and 0/1', lessonTitle: 'Four-state logic' });

    expect(upsertTeachBack({ lessonPath, lessonTitle: 'Four-state logic', body: 'X, Z and 0/1', title: 'Renamed', now: 30 })).toBe('saved');
    expect(notebookEntries.get(id)).toMatchObject({ title: 'Renamed', updatedAt: 30 });

    // An empty title (an entry re-created by an edit after it was deleted) falls back to the lesson title.
    expect(updateEntry(id, { title: '' }, 40)).toBe('saved');
    upsertTeachBack({ lessonPath, lessonTitle: 'Four-state logic', body: 'Again', now: 50 });
    expect(notebookEntries.get(id)?.title).toBe('Four-state logic');
  });

  it('creates notes, updates them on a fresh read and removes them', () => {
    const { outcome, id } = createNote({ title: 'Clocking', body: 'Skew', now: 5 });
    expect(outcome).toBe('saved');
    expect(id).not.toBeNull();

    expect(updateEntry(id as string, { body: 'Input skew', title: 'Clocking blocks' }, 9)).toBe('saved');
    expect(notebookEntries.get(id as string)).toMatchObject({ title: 'Clocking blocks', body: 'Input skew', createdAt: 5, updatedAt: 9 });

    // Deleted in another tab while this tab still had an edit: the edit is kept.
    storage.removeItem(notebookEntries.keyFor(id as string));
    expect(updateEntry(id as string, { body: 'Kept' }, 12)).toBe('saved');
    expect(notebookEntries.get(id as string)).toMatchObject({ kind: 'note', body: 'Kept' });

    removeEntry(id as string);
    expect(notebookEntries.get(id as string)).toBeNull();
  });

  it("returns 'too-large' past the title and body limits", () => {
    expect(createNote({ title: 'x'.repeat(NOTEBOOK_TITLE_MAX_CHARS + 1), body: '' }).outcome).toBe('too-large');
    expect(createNote({ title: 't', body: 'x'.repeat(NOTEBOOK_BODY_MAX_CHARS + 1) })).toEqual({ outcome: 'too-large', id: null });
    expect(createNote({ title: 't', body: 'x'.repeat(NOTEBOOK_BODY_MAX_CHARS) }).outcome).toBe('saved');

    const { id } = createNote({ title: 't', body: 'short' });
    expect(updateEntry(id as string, { body: 'x'.repeat(NOTEBOOK_BODY_MAX_CHARS + 1) })).toBe('too-large');
    expect(notebookEntries.get(id as string)?.body).toBe('short');
    expect(
      upsertTeachBack({ lessonPath: '/curriculum/a/b/c', lessonTitle: 'C', body: 'x'.repeat(NOTEBOOK_BODY_MAX_CHARS + 1) }),
    ).toBe('too-large');
  });

  it(`returns 'too-large' for a new entry once ${NOTEBOOK_MAX_ENTRIES} entries exist`, () => {
    for (let index = 0; index < NOTEBOOK_MAX_ENTRIES; index += 1) {
      notebookEntries.set(`seed-${index}`, { ...entry, id: `seed-${index}` });
    }

    expect(createNote({ title: 'one more', body: '' }).outcome).toBe('too-large');
    expect(upsertTeachBack({ lessonPath: '/curriculum/a/b/c', lessonTitle: 'C', body: 'b' })).toBe('too-large');
    expect(updateEntry('seed-1', { body: 'editing an existing entry still works' })).toBe('saved');
  });

  it(`returns 'too-large' once the notebook would exceed ${NOTEBOOK_TOTAL_MAX_CHARS} characters`, () => {
    const body = 'x'.repeat(NOTEBOOK_BODY_MAX_CHARS);
    let index = 0;
    for (;;) {
      const next: NotebookEntry = { ...entry, id: `big-${index}`, body };
      const size = JSON.stringify({ v: 1, data: next }).length;
      if (notebookTotalChars() + size * 2 > NOTEBOOK_TOTAL_MAX_CHARS) break;
      notebookEntries.set(next.id, next);
      index += 1;
    }
    expect(createNote({ title: 'fits', body }).outcome).toBe('saved');
    expect(createNote({ title: 'does not fit', body }).outcome).toBe('too-large');
    expect(notebookTotalChars()).toBeLessThanOrEqual(NOTEBOOK_TOTAL_MAX_CHARS);
  });

  it('merges by the newest updatedAt', () => {
    expect(mergeNotebookEntry(entry, { ...entry, body: 'newer', updatedAt: 5 }).body).toBe('newer');
    expect(mergeNotebookEntry({ ...entry, updatedAt: 9 }, { ...entry, body: 'older', updatedAt: 5 }).body).toBe('Body');
  });
});

describe('assessments', () => {
  const attempt = (completedAt: number, overrides: Partial<PlacementAttempt> = {}): PlacementAttempt => ({
    assessmentVersion: 'placement-v2',
    scoringVersion: 'placement-scoring-v2',
    responses: [{ questionId: 'q1', optionId: 'a' }],
    tier: 2,
    routeId: 'junior',
    percent: 0.5,
    categories: [{ id: 'foundations', percent: 0.75 }],
    completedAt,
    ...overrides,
  });

  it('drops malformed attempts, responses, categories and quiz results', () => {
    const parsed = parseAssessmentData({
      placement: [
        { ...attempt(1), responses: [{ questionId: 'q1', optionId: 'a' }, { questionId: 2 }], categories: [{ id: 'x', percent: 3 }] },
        attempt(2, { tier: 7 }),
        attempt(3, { routeId: 'senior' as never }),
        'nope',
      ],
      quizzes: {
        '/curriculum/a/b/c#0011aabb': { lessonPath: '/curriculum/a/b/c', best: 3, last: 2, total: 4, attempts: 2, lastAt: 9 },
        '/curriculum/a/b/c#mismatch': { lessonPath: '/elsewhere', best: 1, last: 1, total: 1, attempts: 1, lastAt: 1 },
        '/curriculum/a/b/c#toomany': { lessonPath: '/curriculum/a/b/c', best: 5, last: 1, total: 4, attempts: 1, lastAt: 1 },
      },
    });

    expect(parsed?.placement).toEqual([{ ...attempt(1), categories: [] }]);
    expect(Object.keys(parsed?.quizzes ?? {})).toEqual(['/curriculum/a/b/c#0011aabb']);
  });

  it('keeps placement attempts newest first, at most 10, ignoring duplicates by completedAt', () => {
    for (let index = 1; index <= 12; index += 1) {
      expect(addPlacementAttempt(attempt(index * 100))).toBe('saved');
    }
    addPlacementAttempt(attempt(1200, { tier: 4 }));

    const { placement } = assessmentRecord.read();
    expect(placement).toHaveLength(10);
    expect(placement[0].completedAt).toBe(1200);
    expect(placement[0].tier).toBe(2);
    expect(placement[9].completedAt).toBe(300);
  });

  it('records quiz results per lesson and quiz id', () => {
    const quizId = quizIdFromQuestions(['What is X?', 'What is Z?']);
    expect(quizId).toMatch(/^[0-9a-f]{8}$/);
    expect(quizIdFromQuestions(['What is X?', 'What is Z?'])).toBe(quizId);
    const otherQuiz = quizIdFromQuestions(['Something else?']);

    recordQuizResult('/curriculum/a/b/c', quizId, 1, 2, 10);
    recordQuizResult('/curriculum/a/b/c', quizId, 2, 2, 20);
    recordQuizResult('/curriculum/a/b/c', quizId, 0, 2, 30);
    recordQuizResult('/curriculum/a/b/c', otherQuiz, 1, 1, 40);

    const { quizzes } = assessmentRecord.read();
    expect(quizzes[quizResultKey('/curriculum/a/b/c', quizId)]).toEqual({
      lessonPath: '/curriculum/a/b/c',
      best: 2,
      last: 0,
      total: 2,
      attempts: 3,
      lastAt: 30,
    });
    expect(Object.keys(quizzes)).toHaveLength(2);
  });

  it('drops quiz results whose lesson path is not a canonical lesson path', () => {
    const result = (lessonPath: string) => ({ lessonPath, best: 1, last: 1, total: 1, attempts: 1, lastAt: 1 });
    const parsed = parseAssessmentData({
      placement: [],
      quizzes: {
        'javascript:x#deadbeef': result('javascript:x'),
        '//evil/x#deadbeef': result('//evil/x'),
        '/curriculum/a/b/c/#deadbeef': result('/curriculum/a/b/c/'),
        '/curriculum/a/b/c#deadbeef': result('/curriculum/a/b/c'),
      },
    });
    expect(Object.keys(parsed?.quizzes ?? {})).toEqual(['/curriculum/a/b/c#deadbeef']);
  });

  it('still saves a new quiz result when the record is full of stale results for the same lesson', () => {
    const lesson = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
    const stale: Record<string, unknown> = {};
    for (let index = 0; index < 600; index += 1) {
      const quizId = index.toString(16).padStart(8, '0');
      stale[`${lesson}#${quizId}`] = { lessonPath: lesson, best: 1, last: 1, total: 2, attempts: 1, lastAt: 1_000 + index };
    }
    storage.setItem('sv-uvm-guide:assessments', JSON.stringify({ v: 1, data: { placement: [], quizzes: stale } }));
    expect(storage.getItem('sv-uvm-guide:assessments')!.length).toBeGreaterThan(ASSESSMENTS_MAX_CHARS / 2);

    expect(recordQuizResult(lesson, 'feedface', 2, 2, 5_000)).toBe('saved');

    const { quizzes } = assessmentRecord.read();
    // The new result plus the newest stale ones for that lesson, QUIZ_RESULTS_PER_LESSON_MAX in all.
    expect(Object.keys(quizzes).sort()).toEqual(
      [`${lesson}#feedface`, `${lesson}#00000257`, `${lesson}#00000256`].sort(),
    );
    expect(quizzes[`${lesson}#feedface`]).toEqual(expect.objectContaining({ best: 2, last: 2, total: 2, attempts: 1, lastAt: 5_000 }));
  });

  it('keeps the result just recorded even when a device clock makes it the oldest', () => {
    const lesson = '/curriculum/a/b/c';
    recordQuizResult(lesson, '00000001', 1, 1, 9_000);
    recordQuizResult(lesson, '00000002', 1, 1, 9_001);
    recordQuizResult(lesson, '00000003', 1, 1, 9_002);
    expect(recordQuizResult(lesson, '00000004', 1, 1, 10)).toBe('saved');
    expect(Object.keys(assessmentRecord.read().quizzes).sort()).toEqual(
      [`${lesson}#00000002`, `${lesson}#00000003`, `${lesson}#00000004`].sort(),
    );
  });

  it('bounds quiz results per lesson and in all', () => {
    const quizzes: Record<string, QuizResult> = {};
    for (let index = 0; index < QUIZ_RESULTS_MAX + 50; index += 1) {
      const lessonPath = `/curriculum/T/M/lesson-${index}`;
      quizzes[`${lessonPath}#00000000`] = { lessonPath, best: 1, last: 1, total: 1, attempts: 1, lastAt: index };
    }
    const bounded = boundQuizResults(quizzes);
    expect(Object.keys(bounded)).toHaveLength(QUIZ_RESULTS_MAX);
    // The oldest 50 go; the order of the rest is unchanged.
    expect(Object.keys(bounded)[0]).toBe('/curriculum/T/M/lesson-50#00000000');

    const small = { '/curriculum/a/b/c#00000001': quizzes['/curriculum/T/M/lesson-1#00000000'] };
    expect(boundQuizResults(small)).toBe(small);
  });

  it('bounds quiz results when an import is merged in', () => {
    const lesson = '/curriculum/a/b/c';
    const result = (lastAt: number): QuizResult => ({ lessonPath: lesson, best: 1, last: 1, total: 1, attempts: 1, lastAt });
    const merged = mergeAssessmentData(
      { placement: [], quizzes: { [`${lesson}#00000001`]: result(1), [`${lesson}#00000002`]: result(2) } },
      { placement: [], quizzes: { [`${lesson}#00000003`]: result(3), [`${lesson}#00000004`]: result(4) } },
    );
    expect(Object.keys(merged.quizzes).sort()).toEqual([`${lesson}#00000002`, `${lesson}#00000003`, `${lesson}#00000004`]);
  });

  it('merges attempts and quiz results', () => {
    const key = '/curriculum/a/b/c#00000001';
    const merged = mergeAssessmentData(
      { placement: [attempt(1), attempt(3)], quizzes: { [key]: { lessonPath: '/curriculum/a/b/c', best: 3, last: 1, total: 4, attempts: 2, lastAt: 10 } } },
      { placement: [attempt(2), attempt(3)], quizzes: { [key]: { lessonPath: '/curriculum/a/b/c', best: 2, last: 2, total: 4, attempts: 5, lastAt: 20 } } },
    );
    expect(merged.placement.map((item) => item.completedAt)).toEqual([3, 2, 1]);
    expect(merged.quizzes[key]).toEqual({ lessonPath: '/curriculum/a/b/c', best: 3, last: 2, total: 4, attempts: 5, lastAt: 20 });
  });
});

describe('lessons', () => {
  it('canonicalizes lesson paths', () => {
    expect(canonicalLessonPath('/curriculum/T1/F2A/four-state/')).toBe('/curriculum/T1/F2A/four-state');
    expect(canonicalLessonPath('/curriculum/T1/F2A/four-state?x=1#quiz')).toBe('/curriculum/T1/F2A/four-state');
    expect(canonicalLessonPath('/curriculum')).toBeNull();
    expect(canonicalLessonPath('/practice/lab/basics-1')).toBeNull();
    expect(canonicalLessonPath(null)).toBeNull();
  });

  it('logs visits on a fresh read and validates the log', () => {
    logLessonVisit('/curriculum/a/b/c', 100);
    logLessonVisit('/curriculum/a/b/c', 200);
    logLessonVisit('/curriculum/a/b/d', 150);

    expect(lessonLogRecord.read().lessons).toEqual({
      '/curriculum/a/b/c': { firstVisitedAt: 100, lastVisitedAt: 200, visits: 2 },
      '/curriculum/a/b/d': { firstVisitedAt: 150, lastVisitedAt: 150, visits: 1 },
    });
    expect(
      parseLessonLog({
        lessons: { '/ok': { lastVisitedAt: 5 }, 'bad?query': { lastVisitedAt: 5 }, '/trailing/': { lastVisitedAt: 1 }, '/nope': { lastVisitedAt: 'x' } },
      }),
    ).toEqual({ lessons: { '/ok': { firstVisitedAt: 5, lastVisitedAt: 5, visits: 1 } } });
    expect(
      mergeLessonLog(
        { lessons: { '/a': { firstVisitedAt: 5, lastVisitedAt: 10, visits: 3 } } },
        { lessons: { '/a': { firstVisitedAt: 2, lastVisitedAt: 8, visits: 1 }, '/b': { firstVisitedAt: 1, lastVisitedAt: 1, visits: 1 } } },
      ),
    ).toEqual({
      lessons: { '/a': { firstVisitedAt: 2, lastVisitedAt: 10, visits: 3 }, '/b': { firstVisitedAt: 1, lastVisitedAt: 1, visits: 1 } },
    });
  });

  it("reads today's bare 'curriculumProgress' JSON unchanged and writes it back bare", () => {
    const today = {
      'F2A': { completedLessons: ['index', 'four-state'], lastVisitedAt: 1_760_000_000_000, lastVisitedLesson: 'four-state' },
      'I-UVM-1': { completedLessons: [] },
    };
    storage.setItem('curriculumProgress', JSON.stringify(today));

    expect(curriculumProgressRecord.read()).toEqual(today);
    curriculumProgressRecord.update((progress) => ({
      ...progress,
      F2B: { completedLessons: ['index'], completedAt: { index: 5 } },
    }));
    expect(stored('curriculumProgress')).toEqual({ ...today, F2B: { completedLessons: ['index'], completedAt: { index: 5 } } });
  });

  it('merges curriculum progress', () => {
    expect(
      mergeCurriculumProgress(
        { F2A: { completedLessons: ['a'], completedAt: { a: 10 }, lastVisitedAt: 50, lastVisitedLesson: 'a' } },
        { F2A: { completedLessons: ['a', 'b'], completedAt: { a: 5, b: 20 }, lastVisitedAt: 60, lastVisitedLesson: 'b' }, F2B: { completedLessons: [] } },
      ),
    ).toEqual({
      F2A: { completedLessons: ['a', 'b'], completedAt: { a: 5, b: 20 }, lastVisitedAt: 60, lastVisitedLesson: 'b' },
      F2B: { completedLessons: [] },
    });
  });
});

describe('activity', () => {
  it('counts activity on the local day', () => {
    const lateEvening = local(2026, 10, 18, 23, 45);
    recordActivity('lesson', lateEvening);
    recordActivity('lesson', lateEvening);
    recordActivity('review', local(2026, 10, 19, 0, 15));

    expect(activityRecord.read().days).toEqual({
      '2026-10-18': { lesson: 2 },
      '2026-10-19': { review: 1 },
    });
  });

  it('prunes days older than 400', () => {
    const now = local(2026, 10, 18);
    const kept = localDayKey(addDays(now, -399));
    const dropped = localDayKey(addDays(now, -400));
    activityRecord.write({ days: { [kept]: { quiz: 1 }, [dropped]: { quiz: 1 } } });

    recordActivity('note', now);

    expect(activityCutoffDayKey(now)).toBe(kept);
    expect(Object.keys(activityRecord.read().days).sort()).toEqual([kept, '2026-10-18'].sort());
  });

  it('drops malformed days and counts, and merges by the larger count', () => {
    expect(
      parseActivityData({ days: { '2026-10-18': { lesson: 2, unknown: 4, quiz: -1, review: 1.5 }, 'yesterday': { lesson: 1 }, '2026-02-30': { lesson: 1 } } }),
    ).toEqual({ days: { '2026-10-18': { lesson: 2 } } });
    expect(
      mergeActivityData(
        { days: { '2026-10-18': { lesson: 2, quiz: 1 } } },
        { days: { '2026-10-18': { lesson: 1, review: 3 }, '2026-10-17': { note: 1 } } },
      ),
    ).toEqual({ days: { '2026-10-18': { lesson: 2, quiz: 1, review: 3 }, '2026-10-17': { note: 1 } } });
  });
});

describe('legacy keys', () => {
  it("accepts the exercise and route formats today's code writes", () => {
    const { result } = renderHook(() => useExerciseProgress('fifo-depth'));
    act(() => result.current.recordAttempt(80));
    act(() => result.current.logInteraction());
    writeSelectedRoute('practitioner');

    const progressRaw = storage.getItem('sv-uvm-guide:exercise:fifo-depth');
    const analyticsRaw = storage.getItem('sv-uvm-guide:exercise-analytics:fifo-depth');
    expect(parseExerciseProgressRaw(progressRaw)).toMatchObject({ bestScore: 80, attempts: 1, lastPlayed: expect.any(String) });
    expect(parseExerciseAnalyticsRaw(analyticsRaw)).toHaveLength(2);
    expect(readSelectedRouteRaw()).toBe('practitioner');
    expect(isValidRouteRaw(readSelectedRouteRaw())).toBe(true);
    expect(readExerciseProgress()).toEqual([
      { exerciseId: 'fifo-depth', progress: { bestScore: 80, attempts: 1, lastPlayed: expect.any(String) } },
    ]);
    expect(Object.keys(readLegacyRawEntries()).sort()).toEqual([
      'sv-uvm-guide:exercise-analytics:fifo-depth',
      'sv-uvm-guide:exercise:fifo-depth',
      'svuvm.learningRoute',
    ]);
    writeSelectedRoute(null);
  });

  it('rejects garbage and keeps at most 200 analytics events', () => {
    expect(parseExerciseProgressRaw('{bad')).toBeNull();
    expect(parseExerciseProgressRaw('{"bestScore":"high","attempts":1}')).toBeNull();
    expect(parseExerciseProgressRaw('{"bestScore":1,"attempts":1.5}')).toBeNull();
    expect(parseExerciseProgressRaw('[]')).toBeNull();
    expect(parseExerciseAnalyticsRaw('{"type":"assessment"}')).toBeNull();
    expect(parseExerciseAnalyticsRaw('[1,2,3]')).toBeNull();
    expect(parseExerciseAnalyticsRaw('[]')).toEqual([]);

    const events = Array.from({ length: 250 }, (_, index) => ({ type: 'interaction', value: 1, timestamp: index }));
    const parsed = parseExerciseAnalyticsRaw(JSON.stringify([...events, { type: 'other', value: 1, timestamp: 1 }]));
    expect(parsed).toHaveLength(200);
    expect(parsed?.[0].timestamp).toBe(50);

    expect(isValidRouteRaw('junior')).toBe(true);
    expect(isValidRouteRaw('"junior"')).toBe(false);
    expect(isValidRouteRaw('senior')).toBe(false);
  });

  it('normalizes legacy raw values for import, and refuses other keys', () => {
    expect(normalizeLegacyRaw('svuvm.learningRoute', 'expert')).toBe('expert');
    expect(normalizeLegacyRaw('svuvm.learningRoute', 'boss')).toBeNull();
    expect(normalizeLegacyRaw('curriculumProgress', '{"F2A":{"completedLessons":["a"],"junk":1}}')).toBe(
      '{"F2A":{"completedLessons":["a"]}}',
    );
    expect(normalizeLegacyRaw('curriculumProgress', '[]')).toBeNull();
    expect(normalizeLegacyRaw('sv-uvm-guide:exercise:x', '{"bestScore":3,"attempts":2}')).toBe('{"bestScore":3,"attempts":2}');
    expect(normalizeLegacyRaw('sv-uvm-guide:exercise-analytics:x', '[{"type":"assessment","value":5,"timestamp":1}]')).toBe(
      '[{"type":"assessment","value":5,"timestamp":1}]',
    );
    expect(normalizeLegacyRaw('theme', 'dark')).toBeNull();
    expect(normalizeLegacyRaw('sv-uvm-guide:flashcards', '{}')).toBeNull();
    expect(normalizeLegacyRaw('svuvm.learningRoute', 5)).toBeNull();
  });
});

describe('learnerRecords registry', () => {
  it('lists every versioned record once, by area', () => {
    expect(learnerRecords.map((entry) => `${entry.area}:${entry.kind}`)).toEqual([
      'meta:record',
      'labs:keyed',
      'flashcards:record',
      'notebook:keyed',
      'assessments:record',
      'lessons:record',
      'activity:record',
    ]);
    const keys = learnerRecords.map((entry) => (entry.kind === 'record' ? entry.record.key : entry.record.prefix));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key.startsWith('sv-uvm-guide:'))).toBe(true);
    expect(keys).not.toContain('curriculumProgress');
  });
});
