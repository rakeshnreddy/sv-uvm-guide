import React from 'react';

export default function ResourcesPage() {
  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-bold text-accent font-sans mb-6 pb-2 border-b border-border">
        Resources
      </h1>
      <p className="text-lg text-brand-text-primary/90 font-body leading-relaxed">
        Discover a curated collection of SystemVerilog and UVM resources. This includes links to official documentation,
        coding style guides, useful articles, recommended books, and third-party tools that can aid your learning
        and development process.
      </p>
      {/* Placeholder for future content */}
      <div className="mt-8 p-6 bg-background/70 dark:bg-slate-800/60 backdrop-blur-xs border border-slate-700/50 rounded-lg">
        <h2 className="text-2xl font-sans text-brand-text-primary mb-4">Content Catalog</h2>
        <p className="font-body text-brand-text-primary/80">
          Links and categorized resources will be listed here soon.
        </p>
      </div>
    </div>
  );
}
