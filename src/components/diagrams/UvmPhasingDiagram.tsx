"use client";
import React from 'react';
import { motion } from 'framer-motion';

const phases = [
  'build_phase',
  'connect_phase',
  'end_of_elaboration_phase',
  'start_of_simulation_phase',
  'run_phase',
  'extract_phase',
  'check_phase',
  'report_phase'
];

const UvmPhasingDiagram: React.FC = () => (
  <div className="flex flex-col space-y-2">
    {phases.map((p, i) => (
      <motion.div
        key={p}
        className="px-4 py-2 rounded border border-primary/40 bg-primary/10"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.1 }}
      >
        {p}
      </motion.div>
    ))}
  </div>
);

export default UvmPhasingDiagram;
