import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';

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
      <header className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-[rgba(230,241,255,0.65)]">Skill placement</p>
        <h1 className="mt-4 text-4xl font-semibold text-[var(--blueprint-foreground)]">Find the right starting tier</h1>
        <p className="mt-3 max-w-2xl text-sm text-[rgba(230,241,255,0.75)]">
          Answer a focused set of questions so we can recommend the correct blend of curriculum pages, labs, and
          practice drills. Expect ten questions—five multiple choice and five scenario responses.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button asChild size="lg">
            <Link href="/assessment">
              Begin the quiz
              <ArrowRight className="ml-2" />
            </Link>
          </Button>
          <span className="text-xs text-[rgba(230,241,255,0.6)]">Average completion time: 6 minutes</span>
        </div>
      </header>

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
      </section>
    </div>
  );
}
