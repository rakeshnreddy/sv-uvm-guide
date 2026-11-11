import { afterEach, describe, expect, it } from 'vitest';

import {
  RETURNING_ATTRIBUTE,
  START_LESSON_LABEL,
  continueAccessibleName,
  continueLabel,
  continueLesson,
  hasLessonPosition,
  isLessonDone,
  lastOpenedAt,
  resumeLesson,
  returningLearnerScript,
  type LandingLesson,
} from '@/components/home/landing-resume';
import { STRIP_CLASS } from '@/components/home/ReturningLearnerStrip';
import { CURRICULUM_PROGRESS_KEY, LESSONS_KEY } from '@/lib/learner-store/keys';

const F1A = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const F3C = '/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index';
const F4A = '/curriculum/T1_Foundational/F4A_Structuring_Designs_with_Modules_and_Packages/index';
const lessons: LandingLesson[] = [
  { href: F1A, code: 'F1A', title: 'The Cost of Bugs', nextHref: F3C },
  { href: F3C, code: 'F3C', title: 'Delta Cycles and Race Conditions', nextHref: F4A },
  { href: F4A, code: 'F4A', title: 'Structuring Designs with Modules and Packages' },
];
const mod = (at: number, completedLessons: string[] = []) => ({ completedLessons, lastVisitedAt: at });
const visit = (at: number) => ({ firstVisitedAt: at, lastVisitedAt: at, visits: 1 });

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(RETURNING_ATTRIBUTE);
});

describe('the hero primary action labels', () => {
  it('start at lesson 1 and name the lesson to continue', () => {
    expect(START_LESSON_LABEL).toBe('Start lesson 1');
    expect(continueLabel(lessons[1])).toBe('Continue F3C');
    expect(continueAccessibleName(lessons[1])).toBe('Continue F3C: Delta Cycles and Race Conditions');
  });
});

describe('continueLesson (the one continue rule)', () => {
  it('is null for a first-time visitor', () => {
    expect(continueLesson({ lessons: {} }, {}, lessons)).toBeNull();
  });

  it('continues the lesson opened last while it is not marked done', () => {
    expect(continueLesson({ lessons: { [F1A]: visit(1), [F3C]: visit(2) } }, {}, lessons)).toEqual({
      lesson: lessons[1],
      lastOpened: lessons[1],
      reason: 'last-opened',
    });
  });

  it('moves to the next lesson on the learning path once the lesson opened last is marked done', () => {
    const progress = { F3C_Delta_Cycles_and_Race_Conditions: { completedLessons: ['index'] } };
    expect(continueLesson({ lessons: { [F3C]: visit(2) } }, progress, lessons)).toEqual({
      lesson: lessons[2],
      lastOpened: lessons[1],
      reason: 'next-after-done',
    });
  });

  it('stays on the final lesson when it is done, and ignores a next lesson that does not exist', () => {
    const done = { F4A_Structuring_Designs_with_Modules_and_Packages: { completedLessons: ['index'] } };
    expect(continueLesson({ lessons: { [F4A]: visit(3) } }, done, lessons)?.lesson).toEqual(lessons[2]);
    const orphan = [{ ...lessons[1], nextHref: '/curriculum/T9/Gone/index' }];
    const doneF3C = { F3C_Delta_Cycles_and_Race_Conditions: { completedLessons: ['index'] } };
    expect(continueLesson({ lessons: { [F3C]: visit(2) } }, doneF3C, orphan)?.reason).toBe('last-opened');
  });

  it('reads completion by module folder and lesson slug', () => {
    expect(isLessonDone({ F3C_Delta_Cycles_and_Race_Conditions: { completedLessons: ['index'] } }, F3C)).toBe(true);
    expect(isLessonDone({ F3C_Delta_Cycles_and_Race_Conditions: { completedLessons: ['other'] } }, F3C)).toBe(false);
    expect(isLessonDone({}, F3C)).toBe(false);
  });
});

describe('resumeLesson', () => {
  it('is null for a first-time visitor', () => {
    expect(resumeLesson({ lessons: {} }, {}, lessons)).toBeNull();
  });

  it('returns the most recently opened lesson from the lesson log', () => {
    expect(resumeLesson({ lessons: { [F1A]: visit(1), [F3C]: visit(2) } }, {}, lessons)).toEqual(lessons[1]);
  });

  it('reads the legacy curriculumProgress record and ignores lessons that no longer exist', () => {
    expect(resumeLesson({ lessons: {} }, { F3C_Delta_Cycles_and_Race_Conditions: mod(5) }, lessons)).toEqual(lessons[1]);
    expect(resumeLesson({ lessons: { '/curriculum/T9/Gone/index': visit(9) } }, {}, lessons)).toBeNull();
  });
});

describe('lastOpenedAt', () => {
  it('takes the later of the two records for that lesson', () => {
    expect(lastOpenedAt({ lessons: { [F3C]: visit(4) } }, { F3C_Delta_Cycles_and_Race_Conditions: mod(7) }, F3C)).toBe(7);
    expect(lastOpenedAt({ lessons: { [F3C]: visit(4) } }, { F1A_The_Cost_of_Bugs: mod(9) }, F3C)).toBe(4);
    expect(lastOpenedAt({ lessons: {} }, {}, F3C)).toBeNull();
  });
});

describe('hasLessonPosition', () => {
  it('is true for any visit in either record', () => {
    expect(hasLessonPosition({ lessons: {} }, {})).toBe(false);
    expect(hasLessonPosition({ lessons: { [F1A]: visit(1) } }, {})).toBe(true);
    expect(hasLessonPosition({ lessons: {} }, { F1A_The_Cost_of_Bugs: mod(3) })).toBe(true);
    expect(hasLessonPosition({ lessons: {} }, { F1A_The_Cost_of_Bugs: { completedLessons: [] } })).toBe(false);
  });
});

describe('the inline returning-learner script', () => {
  const runScript = () => new Function(returningLearnerScript())();
  const marked = () => document.documentElement.hasAttribute(RETURNING_ATTRIBUTE);

  it('leaves <html> unmarked for a first-time visitor', () => {
    runScript();
    expect(marked()).toBe(false);
  });

  it('marks <html> when the lesson log holds a visit', () => {
    window.localStorage.setItem(LESSONS_KEY, JSON.stringify({ v: 1, data: { lessons: { [F3C]: visit(1) } } }));
    runScript();
    expect(marked()).toBe(true);
  });

  it('marks <html> for a legacy curriculumProgress visit, and not for an empty one', () => {
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, JSON.stringify({ F1A_The_Cost_of_Bugs: {} }));
    runScript();
    expect(marked()).toBe(false);
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, JSON.stringify({ F1A_The_Cost_of_Bugs: { lastVisitedAt: 3 } }));
    runScript();
    expect(marked()).toBe(true);
  });

  it('fails silently on corrupt storage', () => {
    window.localStorage.setItem(LESSONS_KEY, '{not json');
    expect(runScript).not.toThrow();
    expect(marked()).toBe(false);
  });

  it('marks the attribute the strip class reveals', () => {
    expect(STRIP_CLASS).toContain(`[html[${RETURNING_ATTRIBUTE}]_&]:block`);
  });
});
