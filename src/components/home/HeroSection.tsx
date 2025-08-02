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
    <section className="relative w-full min-h-screen flex flex-col justify-center items-center text-center text-white overflow-hidden py-20">
      <div className="absolute inset-0 w-full h-full animated-gradient z-0" />
      <div className="absolute inset-0 w-full h-full bg-black/30 z-0" />

      <div className="relative z-10 p-4 flex flex-col items-center">
        <motion.h1
          className="text-5xl md:text-7xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-300"
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
            className="text-xl md:text-2xl mb-8 text-gray-200 max-w-2xl"
          >
            {taglines[taglineIndex]}
          </motion.p>
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Button size="lg" asChild>
            <a href="/quiz/placement" className="btn-gradient text-white font-bold text-lg px-8 py-6 rounded-full shadow-lg">
              Take Skill Level Assessment
              <ArrowRight className="ml-2" />
            </a>
          </Button>
        </motion.div>

        <motion.div
          className="mt-16 w-full max-w-4xl px-4"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-2xl border border-white/20">
            <InteractiveUvmArchitectureDiagram />
          </div>
        </motion.div>

        <StatsDisplay />
        <TestimonialsCarousel />
      </div>
    </section>
  );
};

export default HeroSection;
