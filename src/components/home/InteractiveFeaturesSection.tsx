"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Code, Share2, Gamepad2, FlaskConical, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const featureConfigs = [
  {
    title: 'Step Through the Scheduler',
    description: 'Watch one clock edge region by region, flip = and <=, and let the model run every legal process order to expose races.',
    icon: Code,
    href: '/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index',
  },
  {
    title: 'UVM Architecture Map',
    description: 'Explore how tests, environments, agents, drivers, monitors and scoreboards fit together, then jump to the lesson for each layer.',
    icon: Share2,
    href: '/practice/visualizations/uvm-architecture',
  },
  {
    title: 'Hands-on Exercises',
    description: 'Order the UVM phases, assemble an agent, connect a scoreboard and experiment with sequencer arbitration, all with keyboard-accessible drag and drop.',
    icon: Gamepad2,
    href: '/exercises',
  },
  {
    title: 'Guided Labs',
    description: 'Starter code, step-by-step instructions and reference solutions for SystemVerilog and UVM testbenches. Sign in to open a lab.',
    icon: FlaskConical,
    href: '/practice',
  },
];

const features = featureConfigs.map(config => ({
  ...config,
  href: config.href ?? '#',
}));

const FeatureCard = ({ feature, index }: { feature: (typeof features)[0], index: number }) => (
  <motion.div
    className="bg-card border rounded-xl overflow-hidden h-full flex flex-col"
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
  >
    <div className="bg-muted/60 h-24 flex items-center justify-center" aria-hidden>
      <feature.icon className="w-12 h-12 text-primary/70" />
    </div>
    <div className="p-6 flex flex-col flex-grow">
      <h3 className="text-xl font-bold text-primary mb-2">{feature.title}</h3>
      <p className="text-foreground/80 mb-6 flex-grow">{feature.description}</p>
      <Button asChild variant="outline" className="mt-auto group">
        <Link href={feature.href}>
          Try It Now
          <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </Button>
    </div>
  </motion.div>
);

const InteractiveFeaturesSection = () => {
  return (
    <section className="py-20 bg-background/70">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Experience Interactive Learning</h2>
          <p className="text-lg text-foreground/80 max-w-3xl mx-auto">
            Interactives say whether they are illustrations or tested models, and many ask you to predict an outcome before they reveal it.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default InteractiveFeaturesSection;
