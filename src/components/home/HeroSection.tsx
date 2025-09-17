"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import InteractiveUvmArchitectureDiagram from '@/components/diagrams/InteractiveUvmArchitectureDiagram';
import TestimonialsCarousel from './TestimonialsCarousel';
import StatsDisplay from './StatsDisplay';
import { ArrowRight } from 'lucide-react';

const taglines = [
  "From Basics to Brilliance in UVM",
  "Your Interactive Guide to SystemVerilog",
  "Master Verification with Confidence",
  "The Ultimate Open-Source UVM Learning Hub",
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
    <section className="relative w-full min-h-screen bg-[color:var(--blueprint-bg)] text-[color:var(--blueprint-foreground)] overflow-hidden py-24">
      <div className="absolute inset-0 hero-gradient opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(100,255,218,0.25),transparent_55%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050B1A]/70 via-transparent to-[#050B1A]" />

      <div className="relative z-10 flex flex-col items-center gap-14 px-6">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="glass-card glow-border max-w-5xl w-full px-8 py-12 text-center"
        >
          <motion.h1
            className="text-5xl md:text-7xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white/95 to-white/60"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Master SystemVerilog & UVM
          </motion.h1>

          <AnimatePresence mode="wait">
            <motion.p
              key={taglineIndex}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
              className="text-xl md:text-2xl mb-8 text-[color:var(--blueprint-foreground)]/80 max-w-3xl mx-auto"
            >
              {taglines[taglineIndex]}
            </motion.p>
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button size="lg" asChild>
              <a
                href="/quiz/placement"
                className="btn-gradient text-white font-bold text-lg px-8 py-6 rounded-full shadow-blueprint"
              >
                Take Skill Level Assessment
                <ArrowRight className="ml-2" />
              </a>
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          className="glass-card max-w-4xl w-full px-4 py-6"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <InteractiveUvmArchitectureDiagram />
        </motion.div>

        <StatsDisplay />
        <TestimonialsCarousel />
      </div>
    </section>
  );
};

export default HeroSection;
