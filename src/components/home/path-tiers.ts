import type { StaticTier } from '@/lib/learner-stats';
import { tierSectionHref, type NavLink } from '@/lib/site-links';
import type { TierNumber } from '@/lib/tier-colors';

/**
 * The rows of the hero's "The path" card: one per tier, from the data the
 * curriculum page uses. The name and the href come from the navigation config
 * (TIER_LINKS in src/lib/site-links.ts), the lesson count from the curriculum
 * totals (buildCurriculumTotals) and the line on what the tier covers from the
 * manifest's audience text (readManifestTiers). Nothing is typed by hand.
 */
export interface PathTier {
  /** The tier folder, 'T1_Foundational'. */
  id: string;
  number: TierNumber;
  /** 'Tier 1: Foundations'. */
  label: string;
  /** '/curriculum#t1'. */
  href: string;
  /** What the tier covers, one line. */
  covers: string;
  lessonCount: number;
}

/**
 * "New to verification or SystemVerilog: the language, time and races, ..." ->
 * "The language, time and races, ...": the part of the manifest's audience
 * text after the colon, which says what the tier covers rather than who it is for.
 */
export function tierCovers(audience: string): string {
  const at = audience.indexOf(': ');
  const covers = (at < 0 ? audience : audience.slice(at + 2)).trim();
  return covers.charAt(0).toUpperCase() + covers.slice(1);
}

export interface PathTierSources {
  totals: readonly StaticTier[];
  manifestTiers: readonly { id: string; audience: string }[];
  tierLinks: readonly NavLink[];
}

export function buildPathTiers({ totals, manifestTiers, tierLinks }: PathTierSources): PathTier[] {
  return totals.map((tier) => {
    const href = tierSectionHref(tier.id);
    const link = tierLinks.find((entry) => entry.href === href);
    if (!link) throw new Error(`Tier ${tier.id} has no link in the navigation config`);
    const audience = manifestTiers.find((entry) => entry.id === tier.id)?.audience;
    if (!audience) throw new Error(`Tier ${tier.id} has no audience in the curriculum manifest`);
    return {
      id: tier.id,
      number: tier.number as TierNumber,
      label: link.label,
      href: link.href,
      covers: tierCovers(audience),
      lessonCount: tier.modules.reduce((sum, module) => sum + module.lessons.length, 0),
    };
  });
}
