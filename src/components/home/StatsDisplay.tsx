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
      className="mt-12 w-full"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="mx-auto max-w-4xl grid grid-cols-3 gap-8">
        {stats.map((stat, index) => (
          <motion.div key={index} className="text-center text-white" variants={itemVariants}>
            <div className="text-accent mb-2">{stat.icon}</div>
            <p className="text-3xl font-bold">{stat.value}</p>
            <p className="text-sm opacity-80">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default StatsDisplay;
