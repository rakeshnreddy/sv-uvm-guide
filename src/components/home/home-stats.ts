import type { Module } from '@/lib/curriculum-data';

/**
 * Every number the landing page states, computed from the data the rest of
 * the site uses rather than written by hand (DESIGN.md section 9: counts come
 * from data). Pure functions over plain inputs, so the page passes the data in
 * and the tests check each number against its source.
 */

/** The counts the root metadata and the hero paragraph state. */
export interface HomeStats {
  lessonCount: number;
  tierCount: number;
  labCount: number;
}

export function getHomeStats(curriculum: readonly Module[], labs: readonly unknown[]): HomeStats {
  return {
    lessonCount: curriculum.reduce(
      (sum, tier) => sum + tier.sections.reduce((sectionSum, section) => sectionSum + section.topics.length, 0),
      0,
    ),
    tierCount: new Set(curriculum.map((tier) => tier.tier)).size,
    labCount: labs.length,
  };
}

/**
 * The main standards the lessons are sourced to, as the earlier "Sourced to
 * the standards" highlight stated them (checked against the lessons in phase
 * 1). A named list, not a count: the lessons also cite other standards (IEEE
 * 1801, IEEE 1364), and the AMBA entry is a family of specifications, so the
 * page never states how many standards the lessons cite.
 */
export const MAIN_STANDARDS: readonly { name: string; covers: string }[] = [
  { name: 'IEEE 1800-2023', covers: 'SystemVerilog' },
  { name: 'IEEE 1800.2-2020', covers: 'UVM' },
  { name: 'the Arm AMBA specifications', covers: 'AXI, AHB and APB' },
];

/** Everything the landing page counts. */
export interface LandingFacts extends HomeStats {
  /** Practice pages of kind "interactive" (the Practice hub's "Interactive models" section). */
  interactiveModelCount: number;
  /** Practice pages of kind "exercise" (the Practice hub's "Exercises" section). */
  exerciseCount: number;
  /** Interview question banks and the questions in them (the /interview-prep page). */
  interviewBankCount: number;
  interviewQuestionCount: number;
  /** Questions in the placement quiz ("Find your level"). */
  placementQuestionCount: number;
  /** The main standards the lessons are sourced to (named, not counted). */
  standards: readonly { name: string; covers: string }[];
}

export interface LandingSources {
  curriculum: readonly Module[];
  labs: readonly unknown[];
  practicePages: readonly { kind: string }[];
  interviewBanks: readonly { questionCount: number }[];
  placementQuestions: readonly unknown[];
  standards?: readonly { name: string; covers: string }[];
}

export function getLandingFacts({
  curriculum,
  labs,
  practicePages,
  interviewBanks,
  placementQuestions,
  standards = MAIN_STANDARDS,
}: LandingSources): LandingFacts {
  return {
    ...getHomeStats(curriculum, labs),
    interactiveModelCount: practicePages.filter((page) => page.kind === 'interactive').length,
    exerciseCount: practicePages.filter((page) => page.kind === 'exercise').length,
    interviewBankCount: interviewBanks.length,
    interviewQuestionCount: interviewBanks.reduce((sum, bank) => sum + bank.questionCount, 0),
    placementQuestionCount: placementQuestions.length,
    standards,
  };
}

/** "four" for 4, up to twelve; larger counts stay as figures. */
export function countWord(count: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  return words[count] ?? String(count);
}

/** Where the course takes a learner, as the hero's headline and the descriptions say it. */
export const COURSE_SPAN = 'from your first testbench to expert level';

/** The hero's one factual paragraph. */
export function heroParagraph({ lessonCount, tierCount, labCount, interviewQuestionCount }: HomeStats & { interviewQuestionCount: number }): string {
  return `A free, structured course: ${lessonCount} lessons in ${countWord(tierCount)} tiers, with interactive models you step through, ${labCount} guided labs and ${interviewQuestionCount} interview questions with model answers. No sign-up. Your progress stays in this browser.`;
}

/** The landing page's meta description, from the same counts. */
export function landingDescription(facts: LandingFacts): string {
  return `A free SystemVerilog, UVM and AMBA verification course, ${COURSE_SPAN}: ${facts.lessonCount} lessons in ${facts.tierCount} tiers, ${facts.interactiveModelCount} interactive models, ${facts.labCount} guided labs and ${facts.interviewQuestionCount} interview questions with model answers. No sign-up; your progress stays in your browser.`;
}

/** "1 lesson", "112 lessons". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
