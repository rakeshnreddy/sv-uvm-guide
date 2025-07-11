import React from 'react';

export default function PracticePage() {
  return (
    // MainLayout already provides container, px, py for page content.
    // So, no need for a "page-container" div here if children are directly in <main> of MainLayout.
    // If MainLayout's <main> does not have padding, add "px-4 py-8" or similar to this div.
    <div>
      <h1 className="text-3xl sm:text-4xl font-bold text-accent font-sans mb-6 pb-2 border-b border-border">
        Practice Hub
      </h1>
      <p className="text-lg text-brand-text-primary/90 font-body leading-relaxed">
        This is where you will find interactive coding labs, quizzes, and the Waveform Studio.
        Sharpen your SystemVerilog and UVM skills with hands-on exercises designed to reinforce
        concepts learned in the curriculum. Prepare for real-world verification challenges.
      </p>
      {/* Placeholder for future content */}
      <div className="mt-8 p-6 bg-background/70 dark:bg-slate-800/60 backdrop-blur-xs border border-slate-700/50 rounded-lg">
        <h2 className="text-2xl font-sans text-brand-text-primary mb-4">Coming Soon...</h2>
        <p className="font-body text-brand-text-primary/80">
          Interactive exercises and tools are under development. Check back later!
        </p>
      </div>
    </div>
  );
}
