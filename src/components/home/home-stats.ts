import type { Module } from '@/lib/curriculum-data';

/** The counts the home page states, taken from the curriculum and the lab registry rather than written by hand. */
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

/** The hero's one subtitle. */
export function heroSubtitle({ lessonCount, tierCount, labCount }: HomeStats): string {
  return `${lessonCount} lessons in ${tierCount} tiers, from your first testbench to staff-level interviews, with interactive models, ${labCount} guided labs and interview prep`;
}
