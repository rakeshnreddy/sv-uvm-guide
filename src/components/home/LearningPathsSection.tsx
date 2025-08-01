"use client";
import React from 'react';
import LearningPathCard from './LearningPathCard';
import { Button } from '@/components/ui/Button';
import { Baby, TrendingUp, Rocket, Crown, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const learningPaths = [
  {
    tier: 'Beginner',
    title: 'Foundational Knowledge',
    icon: Baby,
    color: 'emerald',
    time: '20-30 hours',
    skills: ['SystemVerilog Basics', 'Data Types', 'Procedural Blocks', 'Your First Testbench'],
    description: 'Start from scratch. No prior verification knowledge needed.',
    href: '/curriculum/T1_Foundational'
  },
  {
    tier: 'Intermediate',
    title: 'UVM Fundamentals',
    icon: TrendingUp,
    color: 'sky',
    time: '40-60 hours',
    skills: ['OOP in SV', 'UVM Basics', 'Sequences & Drivers', 'Monitors & Scoreboards'],
    description: 'For those with SV knowledge, ready to dive into UVM.',
    href: '/curriculum/T2_Intermediate'
  },
  {
    tier: 'Advanced',
    title: 'Mastering UVM',
    icon: Rocket,
    color: 'violet',
    time: '80-100 hours',
    skills: ['Advanced Sequencing', 'Register Layer (RAL)', 'Factory & Overrides', 'Functional Coverage'],
    description: 'Deepen UVM expertise and tackle complex verification scenarios.',
    href: '/curriculum/T3_Advanced'
  },
  {
    tier: 'Expert',
    title: 'Verification Architect',
    icon: Crown,
    color: 'amber',
    time: '120+ hours',
    skills: ['Methodology Customization', 'Performance Optimization', 'SoC Verification', 'Formal Integration'],
    description: 'Become a verification leader and architect cutting-edge testbenches.',
    href: '/curriculum/T4_Expert'
  },
];

const LearningPathsSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Choose Your Learning Path</h2>
          <p className="text-lg text-foreground/80 max-w-3xl mx-auto">
            We offer structured learning paths to take you from novice to expert. Each path is carefully curated to build on previous knowledge.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {learningPaths.map((path, index) => (
            <motion.div
              key={path.tier}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <LearningPathCard path={path} />
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <p className="text-lg text-foreground/80 mb-4">Not sure where to start?</p>
          <Button size="lg" variant="outline" asChild>
            <Link href="/quiz/placement">
              <HelpCircle className="mr-2" />
              Take Placement Quiz
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default LearningPathsSection;
