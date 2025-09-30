"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Compass } from 'lucide-react';
import Link from 'next/link';

const taglines = [
  "From Basics to Brilliance in UVM",
  "Your Interactive Guide to SystemVerilog",
  "Master Verification with Confidence",
  "The Ultimate Open-Source UVM Learning Hub",
];

const highlights = [
  {
    title: 'Curated tiers',
    description: 'Progress through four tiers that mirror real verification onboarding, from fundamentals to SoC strategy.',
  },
  {
    title: 'Hands-on reinforcement',
    description: 'Pair every concept with labs, flashcards, and quizzes so the knowledge sticks beyond the page.',
  },
  {
    title: 'Reusable playbooks',
    description: 'Lift checklists, diagrams, and best practices directly into your next project without hunting for context.',
  },
];

const HeroSection = () => {
  const [taglineIndex, setTaglineIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prevIndex) => (prevIndex + 1) % taglines.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative isolate overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent"
        aria-hidden
      />
      <div
        className="absolute -top-24 left-1/2 h-80 w-[55%] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl"
        aria-hidden
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-6 pb-24 pt-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center gap-8 text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            <Compass className="h-4 w-4" /> Complete SV/UVM roadmap
          </span>
          <div className="space-y-6">
            <motion.h1
              className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Master SystemVerilog & UVM with confidence
            </motion.h1>
            <AnimatePresence mode="wait">
              <motion.p
                key={taglineIndex}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.4 }}
                className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl"
              >
                {taglines[taglineIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="flex flex-col gap-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-3xl border border-border/60 bg-card/80 p-6 text-left shadow-sm"
          >
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
              Start with a quick skills check
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Calibrate the roadmap to your baseline and jump straight to the SystemVerilog and UVM lessons that will help most right now.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/quiz/placement">
                  Take skill assessment
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/curriculum">Browse the curriculum</Link>
              </Button>
            </div>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border/60 bg-card/80 p-4 text-left shadow-sm"
              >
                <dt className="text-sm font-semibold text-primary">{item.title}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{item.description}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
