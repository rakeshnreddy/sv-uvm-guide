import React from 'react';

import type { LandingFacts } from './home-stats';

export interface ProofFact {
  id: string;
  /** The figure, set in the mono face with tabular figures: a count, or for the standards the main standard's name. */
  figure: number | string;
  /** What the figure counts or names; plain text after it. */
  label: string;
  /** Phrases in the label that must not break across lines (standard identifiers break at their hyphens). */
  keepTogether?: readonly string[];
}

/** "a, b and c". */
function listOf(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The four facts, every figure from the data (home-stats.ts). */
export function proofFacts(facts: LandingFacts): ProofFact[] {
  return [
    { id: 'lessons', figure: facts.lessonCount, label: `lessons in ${facts.tierCount} tiers` },
    { id: 'labs', figure: facts.labCount, label: 'guided labs' },
    { id: 'questions', figure: facts.interviewQuestionCount, label: 'interview questions with model answers' },
    {
      id: 'standards',
      // A name, not a count (home-stats.ts, MAIN_STANDARDS): the SystemVerilog standard the course is built on.
      figure: 'IEEE 1800',
      label: `Sourced to ${listOf(facts.standards.map((standard) => standard.name))}`,
      // Only identifiers with a hyphenated year ("IEEE 1800-2023"); the longer AMBA phrase may wrap.
      keepTogether: facts.standards.map((standard) => standard.name).filter((name) => /\d-\d/.test(name)),
    },
  ];
}

/** The label with each phrase in `keep` held on one line. */
export function labelNodes(label: string, keep: readonly string[] = []): React.ReactNode[] {
  const phrases = keep.filter(Boolean);
  if (!phrases.length) return [label];
  const escaped = phrases.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return label.split(new RegExp(`(${escaped.join('|')})`)).map((part, index) =>
    phrases.includes(part) ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * Four facts in one row under the hero (two by two on phones). No cards and
 * no icons: a figure and a line each, divided by hairlines.
 */
export default function ProofStrip({ facts }: { facts: LandingFacts }) {
  return (
    <section aria-label="The course in numbers" data-testid="proof-strip" className="border-y border-border py-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
        {proofFacts(facts).map((fact) => (
          <div key={fact.id} data-fact={fact.id} className="flex min-w-0 flex-col gap-1">
            <dt className="order-2 text-ui text-muted-foreground">{labelNodes(fact.label, fact.keepTogether)}</dt>
            <dd className="order-1 whitespace-nowrap font-mono text-h1 tabular-nums text-foreground">{fact.figure}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
