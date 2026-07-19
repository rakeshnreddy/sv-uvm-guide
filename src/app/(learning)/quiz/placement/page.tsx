import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PlacementQuiz } from '@/components/assessment/PlacementQuiz';

const quizSections = [
  {
    title: 'SystemVerilog Foundations',
    description: 'Covers procedural blocks, data types, and race-free coding patterns.',
    sample: ['Scheduling semantics', 'Interface vs. modport usage', 'Deterministic resets'],
  },
  {
    title: 'Verification Methodology',
    description: 'Evaluates UVM familiarity across components, phasing, and factory overrides.',
    sample: ['Agent composition', 'Sequence arbitration', 'Factory troubleshooting'],
  },
  {
    title: 'Debug & Coverage Habits',
    description: 'Looks for coverage triage, objection management, and failure isolation strategies.',
    sample: ['Functional coverage closure', 'Waveform triage workflow', 'Objection trace reading'],
  },
];

const readinessSignals = [
  'Immediate placement recommendation for Tier 1 through Tier 4 curriculum modules.',
  'Suggested labs and exercises aligned with your weakest scoring rubric.',
  'Baseline telemetry that feeds the personalized dashboard and daily streak goals.',
];

export default function PlacementQuizPage() {
  return (
    <div className="space-y-12">
      <PlacementQuiz />

      <section className="grid gap-6 lg:grid-cols-3">
        {quizSections.map((section) => (
          <article
            key={section.title}
            className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6"
          >
            <h2 className="text-xl font-semibold text-primary">{section.title}</h2>
            <p className="mt-3 text-sm text-[rgba(230,241,255,0.8)]">{section.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-[rgba(230,241,255,0.7)]">
              {section.sample.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--blueprint-accent)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
        <h2 className="text-xl font-semibold text-primary">What you get immediately</h2>
        <ul className="mt-4 space-y-2 text-sm text-[rgba(230,241,255,0.75)]">
          {readinessSignals.map((signal) => (
            <li key={signal} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--blueprint-accent)]" />
              <span>{signal}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-[rgba(230,241,255,0.7)]">
          Want to dive deeper without the placement quiz? Head straight to the
          {' '}
          <Link href="/assessment" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
            assessment center
            <ArrowRight className="h-3 w-3" />
          </Link>
          {' '} to explore practice tabs, analytics, and project-style evaluations.
        </div>
      </section>
    </div>
  );
}
