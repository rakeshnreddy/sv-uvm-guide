/*
 * The Practice hub's data, as plain values (no React): what each row says and
 * how the lists group. PracticeHub renders it; tests check it against the
 * registries, so every lab, page and bank stays listed.
 */
import type { LabManifest } from '@/lib/lab-manifest';
import { labCheckSummary } from '@/lib/lab-registry';
import type { PracticeItem } from '@/lib/practice-links';
import { tierOfModuleCode, tierOfTierSlug, type TierNumber } from '@/lib/tier-colors';

import manifest from '../../../content/curriculum/curriculum.manifest.json';

/**
 * The longest outcome line, in characters, before it is cut at a clause or
 * word boundary. Long enough that almost every first sentence is kept whole:
 * the row and tile clamp the line with CSS (two and three lines), so the text
 * is cut once, at a line end, and only where the width runs out.
 */
export const OUTCOME_MAX_CHARS = 200;

/** A cut shorter than this would say too little; the line is cut at a word instead. */
const MIN_CLAUSE_CHARS = 48;

/** The first sentence: up to the first ". ", "! " or "? " (a full stop inside "uvm-core 2020.3.1" is not an end). */
export function firstSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const match = /^(.*?[.!?])(?=\s|$)/.exec(trimmed);
  return match ? match[1] : trimmed;
}

/**
 * What an outcome line is read from: a bare description, or an item whose
 * author-written `outcome` (a lab manifest's, a page's or a bank's) wins over
 * its description.
 */
export type OutcomeSource = string | { description: string; outcome?: string };

/** The author-written outcome of a source, when it has one. */
function authoredOutcome(source: OutcomeSource): string | undefined {
  return typeof source === 'string' ? undefined : source.outcome?.trim() || undefined;
}

function descriptionOf(source: OutcomeSource): string {
  return typeof source === 'string' ? source : source.description;
}

/**
 * One line saying what the item lets you do. An item's author-written
 * `outcome` is used as written. Otherwise it is the first sentence of the
 * description, whole when it fits in OUTCOME_MAX_CHARS; a longer sentence is
 * cut at the last comma, semicolon or colon that fits (keeping at least
 * MIN_CLAUSE_CHARS), else at the last space, never inside a word, and ends
 * with an ellipsis. The full description is on the item's own page.
 */
export function outcomeLine(source: OutcomeSource, max: number = OUTCOME_MAX_CHARS): string {
  const authored = authoredOutcome(source);
  if (authored) return authored;
  const sentence = firstSentence(descriptionOf(source));
  if (sentence.length <= max) return sentence;
  const head = sentence.slice(0, max + 1);
  const clauseEnd = Math.max(head.lastIndexOf(', '), head.lastIndexOf('; '), head.lastIndexOf(': '));
  const cut = clauseEnd >= MIN_CLAUSE_CHARS ? clauseEnd : head.lastIndexOf(' ');
  const kept = (cut > 0 ? sentence.slice(0, cut) : sentence.slice(0, max)).replace(/[\s,;:.]+$/, '');
  return `${kept}…`;
}

/**
 * A tier's title from the curriculum manifest ("Tier 1: Foundations"), the
 * one source the footer, the outline and the curriculum page read too.
 */
export function tierTitle(tier: TierNumber): string {
  const entry = (manifest as { tiers: { id: string; title: string }[] }).tiers.find((t) => tierOfTierSlug(t.id) === tier);
  return entry?.title ?? `Tier ${tier}`;
}

/** The interview banks' shared lead-in, ended by a colon or by "covering". */
const INTERVIEW_LEAD_IN = /^Interview prep(?:aration)? from junior to senior staff(?::|\s+covering)\s+/i;

/**
 * An interview bank's outcome line: its author-written `outcome` when it has
 * one, else the topics its description lists after its lead-in:
 * "Interview preparation from junior to senior staff: data types and
 * operators, arrays, …" (or "… staff covering APB, AHB, …") reads "Data types
 * and operators, arrays, …". Any other first sentence loses the text up to
 * its first colon; one with no colon is used whole. Cut like outcomeLine.
 */
export function topicsLine(source: OutcomeSource, max: number = OUTCOME_MAX_CHARS): string {
  const authored = authoredOutcome(source);
  if (authored) return authored;
  const sentence = firstSentence(descriptionOf(source));
  const leadIn = INTERVIEW_LEAD_IN.exec(sentence);
  const colon = sentence.indexOf(': ');
  const topics = leadIn ? sentence.slice(leadIn[0].length) : colon >= 0 ? sentence.slice(colon + 2) : sentence;
  return outcomeLine(topics.charAt(0).toUpperCase() + topics.slice(1), max);
}

/** The tier a practice item belongs to: the tier of the module that teaches it, from the curriculum data. */
export function practiceItemTier(item: Pick<PracticeItem, 'lessons'>): TierNumber | undefined {
  const [lesson] = item.lessons;
  return lesson ? tierOfModuleCode(lesson.code) : undefined;
}

export interface PracticeTierGroup<T extends Pick<PracticeItem, 'lessons'>> {
  /** Undefined for items whose teaching lesson sits in no tier (none today). */
  tier: TierNumber | undefined;
  /** The tier's manifest title ("Tier 1: Foundations"); "Other labs" with no tier. */
  title: string;
  items: T[];
}

/** The heading of the group for items with no tier. */
export const UNTIERED_GROUP_TITLE = 'Other labs';

/**
 * Items grouped by tier, tiers in order 1 to 4 and items in their given
 * (curriculum) order inside each group; untiered items last. The tier title
 * comes from the curriculum manifest (tierTitle), so it reads "Tier 1:
 * Foundations" as it does everywhere else.
 */
export function groupByTier<T extends Pick<PracticeItem, 'lessons'>>(items: readonly T[]): PracticeTierGroup<T>[] {
  const groups = new Map<TierNumber | undefined, PracticeTierGroup<T>>();
  for (const item of items) {
    const tier = practiceItemTier(item);
    let group = groups.get(tier);
    if (!group) {
      group = { tier, title: tier ? tierTitle(tier) : UNTIERED_GROUP_TITLE, items: [] };
      groups.set(tier, group);
    }
    group.items.push(item);
  }
  return [...groups.values()].sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99));
}

/** "1 lab", "4 labs". */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * How a lab is checked and how long it is, for its row: "6 steps · auto-checked"
 * or "4 steps · self-checked". The kind comes from labCheckSummary, the one rule
 * the lab page follows too.
 */
export function labRowMeta(lab: Pick<LabManifest, 'graderId' | 'steps'>): string {
  const kind = labCheckSummary(lab).startsWith('Auto-checked') ? 'auto-checked' : 'self-checked';
  return `${countLabel(lab.steps.length, 'step')} · ${kind}`;
}
