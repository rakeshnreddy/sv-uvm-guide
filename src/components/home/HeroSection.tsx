import React from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Compass } from 'lucide-react';
import Link from 'next/link';

import { PLACEMENT_QUIZ_HREF } from '@/lib/site-links';

import { heroSubtitle, type HomeStats } from './home-stats';

const highlights = ({ labCount }: HomeStats) => [
  {
    title: 'Curated tiers',
    description: 'Progress through four tiers that mirror real verification onboarding, from fundamentals to SoC strategy.',
  },
  {
    title: 'Hands-on practice',
    description: `${labCount} guided labs, plus quizzes and flashcards for review`,
  },
  {
    title: 'Sourced to the standards',
    description:
      'Lessons cite IEEE 1800-2023 for SystemVerilog, IEEE 1800.2-2020 for UVM and the Arm AMBA specifications for AXI, AHB and APB.',
  },
];

type HeroSectionProps = HomeStats;

/** The home page hero. Static markup, so it is visible before and without JavaScript. */
const HeroSection = (stats: HeroSectionProps) => {
  return (
    <section className="w-full bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-6 pb-24 pt-28">
        <div className="flex flex-col items-center gap-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            <Compass aria-hidden="true" className="h-4 w-4" /> Complete SV/UVM roadmap
          </span>
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Master SystemVerilog & UVM with confidence
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">{heroSubtitle(stats)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="rounded-3xl border border-border/60 bg-card/80 p-6 text-left shadow-sm">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
              Start with a quick skills check
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Calibrate the roadmap to your baseline and jump straight to the SystemVerilog and UVM lessons that will help most right now.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {/* Same label and target as the Practitioner route's call to action (src/lib/learning-paths.ts). */}
              <Button size="lg" asChild>
                <Link href={PLACEMENT_QUIZ_HREF}>
                  Find your level
                  <ArrowRight aria-hidden="true" className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/curriculum">Browse the curriculum</Link>
              </Button>
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-3">
            {highlights(stats).map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border/60 bg-card/80 p-4 text-left shadow-sm"
              >
                <dt className="text-sm font-semibold text-primary">{item.title}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{item.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
