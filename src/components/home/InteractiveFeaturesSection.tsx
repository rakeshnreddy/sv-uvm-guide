import React from 'react';
import { Button } from '@/components/ui/Button';
import { Code, Share2, Gamepad2, FlaskConical, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { LABS_HREF, PRACTICE_SECTION_HREF } from '@/lib/site-links';

const features = [
  {
    title: 'Step Through the Scheduler',
    description: 'Watch one clock edge region by region, flip = and <=, and let the model run every legal process order to expose races.',
    icon: Code,
    href: '/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index',
    linkLabel: 'Step through the scheduler',
  },
  {
    title: 'UVM Architecture Map',
    description: 'Explore how tests, environments, agents, drivers, monitors and scoreboards fit together, then jump to the lesson for each layer.',
    icon: Share2,
    href: '/practice/visualizations/uvm-architecture',
    linkLabel: 'Open the architecture map',
  },
  {
    title: 'Hands-on Exercises',
    description: 'Order the UVM phases, assemble an agent, connect a scoreboard and experiment with sequencer arbitration, all with keyboard-accessible drag and drop.',
    icon: Gamepad2,
    href: PRACTICE_SECTION_HREF.exercises,
    linkLabel: 'Try an exercise',
  },
  {
    title: 'Guided Labs',
    description: 'Starter code, step-by-step instructions and reference solutions for SystemVerilog and UVM testbenches. Your progress is saved in this browser.',
    icon: FlaskConical,
    href: LABS_HREF,
    linkLabel: 'Browse the labs',
  },
];

type Feature = (typeof features)[number];

const FeatureCard = ({ feature }: { feature: Feature }) => (
  <div className="glass-quiet rounded-xl overflow-hidden h-full flex flex-col transition-colors hover:border-primary/60 motion-reduce:transition-none">
    <div className="bg-muted/60 h-24 flex items-center justify-center" aria-hidden>
      <feature.icon className="w-12 h-12 text-primary/70" />
    </div>
    <div className="p-6 flex flex-col flex-grow">
      <h3 className="text-h3 text-foreground mb-2">{feature.title}</h3>
      <p className="text-muted-foreground mb-6 flex-grow">{feature.description}</p>
      <Button asChild variant="outline" className="mt-auto">
        <Link href={feature.href}>
          {feature.linkLabel}
          <ArrowRight aria-hidden="true" className="ml-2 w-4 h-4" />
        </Link>
      </Button>
    </div>
  </div>
);

const InteractiveFeaturesSection = () => {
  return (
    <section className="w-full py-20 bg-background/70">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-h2 text-foreground mb-4">Experience Interactive Learning</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Interactives say whether they are illustrations or tested models, and many ask you to predict an outcome before they reveal it.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default InteractiveFeaturesSection;
