"use client";

import React from 'react';
import { Users, CheckCircle, BarChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

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

type StatsDisplayProps = {
  className?: string;
};

const StatsDisplay = ({ className }: StatsDisplayProps) => {
  return (
    <motion.div
      className={cn('w-full', className)}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            className="rounded-2xl border border-border/60 bg-card/80 px-6 py-8 text-center shadow-sm"
            variants={itemVariants}
          >
            <div className="mb-3 flex items-center justify-center text-primary">
              {stat.icon}
            </div>
            <p className="text-3xl font-semibold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default StatsDisplay;
