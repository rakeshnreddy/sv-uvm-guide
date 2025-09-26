"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Book, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { resolveCurriculumPath } from '@/lib/curriculum-path';
import type { PersonalizedHomeUser } from '@/lib/personalization';

const recommendationConfigs = [
  { title: 'Advanced Sequences', slug: ['T3_Advanced', 'A-UVM-1_Advanced_Sequencing'] },
  { title: 'The UVM Factory In-Depth', slug: ['T3_Advanced', 'A-UVM-2_The_UVM_Factory_In-Depth'] },
  { title: 'Building a RAL Model', slug: ['T3_Advanced', 'A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL'] },
];

interface PersonalizationSectionProps {
  user: PersonalizedHomeUser | null;
  isLoading?: boolean;
}

const PersonalizationSkeleton = () => (
  <section className="py-20 bg-primary/5">
    <div className="container mx-auto px-4">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded-full bg-white/10" />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4 rounded-xl border bg-card/40 p-6">
            <div className="h-6 w-40 rounded-full bg-white/10" />
            <div className="h-4 w-56 rounded-full bg-white/5" />
            <div className="h-24 rounded-lg bg-white/5" />
            <div className="h-12 w-48 rounded-full bg-white/10" />
          </div>
          <div className="space-y-4 rounded-xl border bg-card/40 p-6">
            <div className="h-6 w-48 rounded-full bg-white/10" />
            <div className="space-y-3">
              <div className="h-4 rounded-full bg-white/5" />
              <div className="h-4 rounded-full bg-white/5" />
              <div className="h-4 rounded-full bg-white/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const PersonalizationSection = ({ user, isLoading }: PersonalizationSectionProps) => {
  if (isLoading) {
    return <PersonalizationSkeleton />;
  }

  if (!user) {
    return null; // Don't render anything if user is not logged in
  }

  const lastLessonHref = resolveCurriculumPath(user.lastLesson.slug, '/curriculum');
  const recommendations = recommendationConfigs.map(config => ({
    ...config,
    href: resolveCurriculumPath([...config.slug], '/curriculum'),
  }));

  return (
    <section className="py-20 bg-primary/5">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Welcome back, {user.name}!</h2>
          <p className="text-lg text-foreground/80 mb-8">
            You're on a <span className="font-bold text-primary">{user.streak}-day learning streak</span>. Keep up the great work!
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
            <motion.div
              className="lg:col-span-2 bg-card p-6 rounded-xl border flex flex-col"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
            >
                <h3 className="text-2xl font-bold text-primary mb-2">Continue Learning</h3>
                <p className="text-muted-foreground mb-4">Pick up where you left off:</p>
                <div className="p-4 rounded-lg border bg-muted/50 flex-grow flex items-center">
                    <h4 className="text-xl font-semibold text-foreground">{user.lastLesson.title}</h4>
                </div>
                <Button asChild size="lg" className="mt-6 w-full md:w-auto">
                    <Link href={lastLessonHref}>
                        Jump Back In <ArrowRight className="ml-2"/>
                    </Link>
                </Button>
            </motion.div>

            <motion.div
              className="bg-card p-6 rounded-xl border"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
                <h3 className="text-2xl font-bold text-primary mb-4">Recommended For You</h3>
                <ul className="space-y-3">
                    {recommendations.map(rec => (
                        <li key={rec.href}>
                            <Link href={rec.href} className="flex items-center group text-foreground/80 hover:text-primary transition-colors">
                                <Book className="mr-3 w-4 h-4 flex-shrink-0"/>
                                <span>{rec.title}</span>
                                <ArrowRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"/>
                            </Link>
                        </li>
                    ))}
                </ul>
            </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PersonalizationSection;
