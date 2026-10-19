import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { curriculumData } from '@/lib/curriculum-data';
import {
  activityTotal,
  backupReminder,
  buildCurriculumTotals,
  dailyStreak,
  exerciseSummaries,
  hasLearnerData,
  indexStaticLessons,
  labSummaries,
  last7Days,
  quizzesOnKnownLessons,
  tierAndModuleProgress,
  trackedCardCount,
  weakQuizLessons,
  type LabMeta,
  type LearnerDataSnapshot,
  type StaticTier,
} from '@/lib/learner-stats';
import type { ActivityCounts } from '@/lib/learner-store/repositories/activity';
import type { QuizResult } from '@/lib/learner-store/repositories/assessments';
import type { LabProgressRecord } from '@/lib/learner-store/repositories/labs';
import { DAY_MS, localDayKey } from '@/lib/learner-store/time';

// Streaks follow local days; pin a zone with daylight-saving time so the DST cases mean something.
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/New_York';
});
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const local = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

const days = (...keys: string[]): Record<string, ActivityCounts> =>
  Object.fromEntries(keys.map((key) => [key, { lesson: 1 }]));

describe('dailyStreak', () => {
  it('counts consecutive local days ending today', () => {
    const now = local(2026, 10, 18, 9);
    expect(dailyStreak(days('2026-10-16', '2026-10-17', '2026-10-18'), now)).toBe(3);
  });

  it('keeps yesterday’s streak until today is over, and a gap breaks it', () => {
    const now = local(2026, 10, 18, 9);
    expect(dailyStreak(days('2026-10-15', '2026-10-16', '2026-10-17'), now)).toBe(3);
    expect(dailyStreak(days('2026-10-14', '2026-10-15', '2026-10-17', '2026-10-18'), now)).toBe(2);
    expect(dailyStreak(days('2026-10-15', '2026-10-16'), now)).toBe(0);
    expect(dailyStreak({}, now)).toBe(0);
  });

  it('switches days at local midnight, not UTC midnight', () => {
    const active = days('2026-10-17');
    // 23:59 local on the 17th is already the 18th in UTC; it still counts the 17th as today.
    expect(localDayKey(local(2026, 10, 17, 23, 59))).toBe('2026-10-17');
    expect(dailyStreak(active, local(2026, 10, 17, 23, 59))).toBe(1);
    // One minute later the 17th is yesterday: the streak holds until the 18th ends.
    expect(dailyStreak(active, local(2026, 10, 18, 0, 0))).toBe(1);
    expect(dailyStreak(active, local(2026, 10, 19, 0, 1))).toBe(0);
  });

  it('runs across the spring-forward and fall-back days without skipping or doubling a day', () => {
    // 8 March 2026 has 23 hours in New York, 1 November 2026 has 25.
    expect(new Date(2026, 2, 7, 12).getTimezoneOffset()).not.toBe(new Date(2026, 2, 9, 12).getTimezoneOffset());
    expect(dailyStreak(days('2026-03-07', '2026-03-08', '2026-03-09'), local(2026, 3, 9, 0, 30))).toBe(3);
    expect(dailyStreak(days('2026-10-31', '2026-11-01', '2026-11-02'), local(2026, 11, 2, 23, 30))).toBe(3);
    expect(dailyStreak(days('2026-03-07', '2026-03-09'), local(2026, 3, 9, 8))).toBe(1);
  });

  it('ignores days whose counts are all zero', () => {
    expect(dailyStreak({ '2026-10-18': {}, '2026-10-17': { lesson: 2 } }, local(2026, 10, 18))).toBe(1);
  });
});

describe('last7Days', () => {
  it('lists the last seven local days oldest first, ending today, with totals', () => {
    const result = last7Days(
      { '2026-10-18': { lesson: 2, quiz: 1 }, '2026-10-12': { review: 4 }, '2026-10-11': { note: 9 } },
      local(2026, 10, 18, 7),
    );
    expect(result.map((day) => day.dayKey)).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(result.map((day) => day.total)).toEqual([4, 0, 0, 0, 0, 0, 3]);
    expect(result[6].counts).toEqual({ lesson: 2, quiz: 1 });
  });

  it('crosses a daylight-saving change with seven distinct days', () => {
    const keys = last7Days({}, local(2026, 3, 11, 0, 15)).map((day) => day.dayKey);
    expect(keys).toEqual(['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11']);
  });

  it('sums every kind in activityTotal', () => {
    expect(activityTotal({ lesson: 1, 'lab-step': 2, review: 3 })).toBe(6);
    expect(activityTotal(undefined)).toBe(0);
  });
});

const fixtureTiers: StaticTier[] = [
  {
    id: 'T1_Foundational',
    number: 1,
    label: 'Tier 1: Foundational',
    modules: [
      {
        id: 'F1A_Intro',
        code: 'F1A',
        title: 'Intro',
        tierId: 'T1_Foundational',
        lessons: [
          { slug: 'index', title: 'Intro', href: '/curriculum/T1_Foundational/F1A_Intro/index' },
          { slug: 'more', title: 'More', href: '/curriculum/T1_Foundational/F1A_Intro/more' },
        ],
      },
      {
        id: 'F2A_Types',
        code: 'F2A',
        title: 'Types',
        tierId: 'T1_Foundational',
        lessons: [
          { slug: 'index', title: 'Types', href: '/curriculum/T1_Foundational/F2A_Types/index' },
          { slug: 'enums', title: 'Enums', href: '/curriculum/T1_Foundational/F2A_Types/enums' },
          { slug: 'structs', title: 'Structs', href: '/curriculum/T1_Foundational/F2A_Types/structs' },
          { slug: 'unions', title: 'Unions', href: '/curriculum/T1_Foundational/F2A_Types/unions' },
        ],
      },
    ],
  },
  {
    id: 'T2_Intermediate',
    number: 2,
    label: 'Tier 2: Intermediate',
    modules: [
      {
        id: 'I-SV-1_OOP',
        code: 'I-SV-1',
        title: 'OOP',
        tierId: 'T2_Intermediate',
        lessons: [{ slug: 'index', title: 'OOP', href: '/curriculum/T2_Intermediate/I-SV-1_OOP/index' }],
      },
    ],
  },
];

describe('tierAndModuleProgress', () => {
  it('counts lessons opened and done per module and tier, with lesson-weighted percentages', () => {
    const summary = tierAndModuleProgress(
      fixtureTiers,
      {
        // A done lesson, a lesson that no longer exists, and an older last-visit with no log entry.
        F1A_Intro: { completedLessons: ['index', 'gone'], lastVisitedAt: 10, lastVisitedLesson: 'more' },
        F2A_Types: { completedLessons: ['enums'] },
      },
      {
        lessons: {
          '/curriculum/T1_Foundational/F2A_Types/structs': { firstVisitedAt: 1, lastVisitedAt: 2, visits: 1 },
          '/curriculum/T1_Foundational/F2A_Types/index': { firstVisitedAt: 1, lastVisitedAt: 3, visits: 4 },
          '/curriculum/unknown/path/index': { firstVisitedAt: 1, lastVisitedAt: 3, visits: 1 },
        },
      },
    );

    const [t1, t2] = summary.tiers;
    expect(t1.modules.map((m) => [m.id, m.opened, m.done, m.total, m.percentDone])).toEqual([
      ['F1A_Intro', 2, 1, 2, 50],
      ['F2A_Types', 3, 1, 4, 25],
    ]);
    expect([t1.opened, t1.done, t1.total, t1.percentDone]).toEqual([5, 2, 6, 33]);
    expect([t2.opened, t2.done, t2.total, t2.percentDone]).toEqual([0, 0, 1, 0]);
    expect([summary.opened, summary.done, summary.total, summary.percentDone]).toEqual([5, 2, 7, 29]);
  });

  it('builds the totals from the curriculum data: every lesson once, canonical hrefs, tier labels', () => {
    const totals = buildCurriculumTotals(curriculumData);
    const lessonCount = curriculumData.reduce(
      (sum, tier) => sum + tier.sections.reduce((inner, section) => inner + section.topics.length, 0),
      0,
    );
    const index = indexStaticLessons(totals);
    expect(index.size).toBe(lessonCount);
    expect(totals[0].label).toBe('Tier 1: Foundational');
    expect(index.get('/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index')).toEqual(
      expect.objectContaining({ moduleId: 'F1A_The_Cost_of_Bugs', moduleCode: 'F1A', slug: 'index', tierId: 'T1_Foundational' }),
    );
    const empty = tierAndModuleProgress(totals, {}, { lessons: {} });
    expect([empty.total, empty.opened, empty.done, empty.percentDone]).toEqual([lessonCount, 0, 0, 0]);
  });
});

describe('weakQuizLessons', () => {
  const quiz = (lessonPath: string, id: string, best: number, total: number, lastAt = 1): [string, QuizResult] => [
    `${lessonPath}#${id}`,
    { lessonPath, best, last: best, total, attempts: 1, lastAt },
  ];

  it('groups quizzes under 75% by lesson, lowest best score first', () => {
    const result = weakQuizLessons(
      Object.fromEntries([
        quiz('/curriculum/a/b/one', '00000001', 3, 4), // exactly 75%: not weak
        quiz('/curriculum/a/b/two', '00000002', 1, 4, 5),
        quiz('/curriculum/a/b/two', '00000003', 2, 4, 9),
        quiz('/curriculum/a/b/three', '00000004', 0, 3),
        quiz('/curriculum/a/b/four', '00000005', 0, 0), // no questions: ignored
      ]),
    );
    expect(result.map((lesson) => lesson.lessonPath)).toEqual(['/curriculum/a/b/three', '/curriculum/a/b/two']);
    expect(result[1].quizzes.map((q) => q.key)).toEqual(['/curriculum/a/b/two#00000002', '/curriculum/a/b/two#00000003']);
    expect(result[1].lowestFraction).toBe(0.25);
    expect(result[1].lastAt).toBe(9);
  });

  it('keeps only quizzes on known lessons, so a stored path that is not a lesson never reaches a link', () => {
    const known = new Set(['/curriculum/a/b/one']);
    const quizzes = Object.fromEntries([
      quiz('/curriculum/a/b/one', '00000001', 0, 4),
      quiz('javascript:alert(1)', '00000002', 0, 4),
      quiz('//evil.example/x', '00000003', 0, 4),
      quiz('/curriculum/a/b/removed', '00000004', 0, 4),
    ]);
    const filtered = quizzesOnKnownLessons(quizzes, known);
    expect(Object.keys(filtered)).toEqual(['/curriculum/a/b/one#00000001']);
    expect(weakQuizLessons(filtered).map((lesson) => lesson.lessonPath)).toEqual(['/curriculum/a/b/one']);
    expect(quizzesOnKnownLessons(quizzes, new Map())).toEqual({});
  });

  it('takes a custom threshold and returns nothing when every quiz passes', () => {
    const quizzes = Object.fromEntries([quiz('/curriculum/a/b/one', '00000001', 4, 5)]);
    expect(weakQuizLessons(quizzes)).toEqual([]);
    expect(weakQuizLessons(quizzes, 0.9)).toHaveLength(1);
  });
});

describe('labSummaries', () => {
  const labs: LabMeta[] = [
    { id: 'basics-1', version: '2', title: 'Basics', stepCount: 3, href: '/practice/lab/basics-1' },
    { id: 'uvm-1', version: '1', title: 'UVM', stepCount: 2, href: '/practice/lab/uvm-1' },
    { id: 'idle', version: '1', title: 'Idle', stepCount: 1, href: '/practice/lab/idle' },
  ];
  const record = (patch: Partial<LabProgressRecord>): LabProgressRecord => ({
    labId: 'basics-1',
    labVersion: '2',
    currentStepId: null,
    completedSteps: [],
    stepEvidence: {},
    fileBuffers: {},
    status: 'in_progress',
    startedAt: 1,
    updatedAt: 1,
    ...patch,
  });

  it('splits in-progress and done labs, prefers the current version and ignores unknown labs', () => {
    const result = labSummaries(
      [
        record({ labVersion: '1', completedSteps: ['a', 'b', 'c', 'd'], status: 'completed', updatedAt: 50, completedAt: 50 }),
        record({ completedSteps: ['a'], updatedAt: 20 }),
        record({ labId: 'uvm-1', labVersion: '0', completedSteps: ['a', 'b'], status: 'completed', updatedAt: 30, completedAt: 25 }),
        record({ labId: 'retired', labVersion: '1', updatedAt: 99 }),
      ],
      labs,
    );
    expect(result.inProgress).toEqual([
      expect.objectContaining({ id: 'basics-1', completedSteps: 1, stepCount: 3, currentVersion: true, status: 'in_progress' }),
    ]);
    expect(result.completed).toEqual([
      expect.objectContaining({ id: 'uvm-1', completedSteps: 2, currentVersion: false, completedAt: 25 }),
    ]);
  });
});

describe('exerciseSummaries', () => {
  it('lists attempted exercises with their titles, most recent first', () => {
    const result = exerciseSummaries(
      [
        { exerciseId: 'uvm-phase-sorter', progress: { bestScore: 87.6, attempts: 3, lastPlayed: '2026-10-10T10:00:00.000Z' } },
        { exerciseId: 'scoreboard-connector', progress: { bestScore: 120, attempts: 1, lastPlayed: '2026-10-12T10:00:00.000Z' } },
        { exerciseId: 'never-played', progress: { bestScore: 0, attempts: 0 } },
        { exerciseId: 'mystery', progress: { bestScore: 40, attempts: 2 } },
      ],
      [
        { id: 'uvm-phase-sorter', title: 'UVM Phase Sorter', href: '/exercises/uvm-phase-sorter' },
        { id: 'scoreboard-connector', title: 'Scoreboard Connector', href: '/exercises/scoreboard-connector' },
      ],
    );
    expect(result.map((entry) => [entry.id, entry.title, entry.bestScore, entry.attempts, entry.href])).toEqual([
      ['scoreboard-connector', 'Scoreboard Connector', 100, 1, '/exercises/scoreboard-connector'],
      ['uvm-phase-sorter', 'UVM Phase Sorter', 88, 3, '/exercises/uvm-phase-sorter'],
      ['mystery', 'mystery', 40, 2, undefined],
    ]);
  });
});

describe('trackedCardCount', () => {
  it('counts only cards still in their deck', () => {
    const state = { deckId: 'd', interval: 1, repetitions: 1, ease: 2.5, dueAt: 0, lastReviewedAt: 0, lapses: 0, reviews: 1 };
    expect(
      trackedCardCount({
        cards: { a: state, b: state, gone: state, orphan: { ...state, deckId: 'nope' } },
        decks: { d: { lessons: [], cardIds: ['a', 'b'], firstSeenAt: 0, lastSeenAt: 0 } },
        positions: {},
      }),
    ).toBe(2);
  });
});

describe('hasLearnerData and backupReminder', () => {
  const empty: LearnerDataSnapshot = {
    curriculum: {},
    lessonLog: { lessons: {} },
    labs: [],
    flashcards: { cards: {}, decks: {}, positions: {} },
    notebook: [],
    assessments: { placement: [], quizzes: {} },
    activity: {},
    exercises: [],
  };

  it('treats an empty browser, and modules with nothing in them, as no data', () => {
    expect(hasLearnerData(empty)).toBe(false);
    expect(hasLearnerData({ ...empty, curriculum: { F1A: { completedLessons: [] } } })).toBe(false);
    expect(hasLearnerData({ ...empty, exercises: [{ exerciseId: 'x', progress: { bestScore: 0, attempts: 0 } }] })).toBe(false);
  });

  it('notices any recorded data', () => {
    expect(hasLearnerData({ ...empty, curriculum: { F1A: { completedLessons: [], lastVisitedAt: 1 } } })).toBe(true);
    expect(hasLearnerData({ ...empty, activity: { '2026-10-18': { quiz: 1 } } })).toBe(true);
    expect(hasLearnerData({ ...empty, lessonLog: { lessons: { '/curriculum/a/b/c': { firstVisitedAt: 1, lastVisitedAt: 1, visits: 1 } } } })).toBe(true);
  });

  it('reminds when there is data and no backup in the last 14 days', () => {
    const now = local(2026, 10, 18);
    expect(backupReminder({}, false, now)).toBe(false);
    expect(backupReminder({}, true, now)).toBe(true);
    expect(backupReminder({ lastExportAt: now - 13 * DAY_MS }, true, now)).toBe(false);
    expect(backupReminder({ lastExportAt: now - 14 * DAY_MS }, true, now)).toBe(false);
    expect(backupReminder({ lastExportAt: now - 15 * DAY_MS }, true, now)).toBe(true);
    expect(backupReminder({ lastExportAt: now - 15 * DAY_MS }, false, now)).toBe(false);
  });
});
