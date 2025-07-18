import React from 'react';
import Panel from '@/components/ui/Panel';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center py-8 md:py-16 bg-background text-brand-text-primary">
      <section className="w-full max-w-4xl text-center mb-12 md:mb-20 px-4" data-testid="hero-section">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-accent font-sans mb-4">
          Master SystemVerilog & UVM
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-brand-text-primary max-w-2xl mx-auto mb-8 font-body">
          Your journey to becoming a verification expert starts here. Explore our interactive curriculum and tools.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Panel href="/curriculum" title="Curriculum" description="Explore the full curriculum." />
          <Panel href="/sv-concepts" title="SV Concepts" description="Master the fundamentals of SystemVerilog." />
          <Panel href="/uvm-concepts" title="UVM Concepts" description="Learn the Universal Verification Methodology." />
          <Panel href="/exercises" title="Exercises" description="Test your knowledge with interactive exercises." />
          <Panel href="/dashboard" title="Dashboard" description="Track your progress and review your notes." />
          <Panel href="/community" title="Community" description="Connect with other learners and experts." />
        </div>
      </section>
    </div>
  );
}
