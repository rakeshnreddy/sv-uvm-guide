import React from 'react';
import Link from 'next/link';
// Corrected import path for curriculum-data
import { curriculumData, CurriculumNode } from '@/lib/curriculum-data';

export default function CurriculumRootPage() { // Renamed component for clarity
  // The curriculumData is now an array of top-level modules
  const topLevelModules = curriculumData;

  if (!topLevelModules || topLevelModules.length === 0) {
    return (
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-accent font-sans mb-6 pb-2 border-b border-border">
          Curriculum Not Found
        </h1>
        <p className="text-lg text-brand-text-primary/90 font-body leading-relaxed">
          The curriculum data could not be loaded or is empty.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-bold text-accent font-sans mb-6 pb-2 border-b border-border">
        Curriculum Overview
      </h1>
      <p className="text-lg text-brand-text-primary/90 font-body leading-relaxed mb-8">
        Welcome to the SystemVerilog & UVM curriculum. Explore the modules below to start your learning journey.
        Each module contains a structured set of topics to guide you from foundational concepts to advanced methodologies.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topLevelModules.map((moduleNode: CurriculumNode) => (
          <Link
            key={moduleNode.id}
            href={moduleNode.path}
            className="block p-6 bg-background/70 dark:bg-slate-800/60 backdrop-blur-xs border border-slate-700/50 rounded-lg shadow-lg hover:shadow-xl hover:border-accent/70 transition-all duration-300 group"
          >
            <h2 className="text-2xl font-sans text-accent mb-2 group-hover:text-secondary-accent transition-colors">
              {moduleNode.title}
            </h2>
            {/* You could add a short description for each module here if available in your data */}
            <p className="text-sm text-brand-text-primary/80 font-body mb-3">
              Explore topics in {moduleNode.title.toLowerCase()}.
            </p>
            <span className="text-sm font-semibold text-accent group-hover:text-secondary-accent transition-colors">
              View Module &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
