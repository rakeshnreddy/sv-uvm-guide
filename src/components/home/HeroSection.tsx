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

/**
 * The home page hero. Static markup, so it is visible before and without
 * JavaScript. It has no background of its own, so the public layout's colour
 * field shows behind it; the skills-check card and the three highlights over
 * the field are glass (DESIGN.md section 11).
 */
const HeroSection = (stats: HeroSectionProps) => {
  return (
    <section className="w-full text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 pb-24 pt-28 sm:px-6">
        <div className="flex flex-col items-center gap-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1 text-label text-muted-foreground">
            <Compass aria-hidden="true" className="h-4 w-4" /> Complete SV/UVM roadmap
          </span>
          <div className="space-y-6">
            <h1 className="text-display font-medium text-foreground">
              Master SystemVerilog & UVM with confidence
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">{heroSubtitle(stats)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="glass rounded-3xl p-6 text-left" data-testid="home-hero-card">
            <h2 className="text-h2 text-foreground">
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
                // Quiet glass: the hero card above is the page's one blurred card (at most three blurred layers, DESIGN.md section 11).
                className="glass-quiet rounded-2xl p-4 text-left"
              >
                <dt className="text-sm font-semibold text-foreground">{item.title}</dt>
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
