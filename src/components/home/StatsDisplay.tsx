"use client";

import React from 'react';
import { Users, CheckCircle, BarChart } from 'lucide-react';
import { motion } from 'framer-motion';

const stats = [
  {
    icon: <Users className="w-8 h-8 mx-auto" />,
    value: "12,000+",
    label: "Active Learners",
  },
  {
    icon: <CheckCircle className="w-8 h-8 mx-auto" />,
    value: "94%",
    label: "Completion Rate",
  },
  {
    icon: <BarChart className="w-8 h-8 mx-auto" />,
    value: "600+",
    label: "Interactive Exercises",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.5,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const StatsDisplay = () => {
  return (
    <motion.div
      className="mt-8 w-full"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            className="glass-card px-6 py-8 text-center"
            variants={itemVariants}
          >
            <div className="flex items-center justify-center text-[color:var(--blueprint-accent)] mb-3">
              {stat.icon}
            </div>
            <p className="text-3xl font-bold text-[color:var(--blueprint-foreground)]">{stat.value}</p>
            <p className="text-sm text-[color:var(--blueprint-foreground)]/70">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default StatsDisplay;
