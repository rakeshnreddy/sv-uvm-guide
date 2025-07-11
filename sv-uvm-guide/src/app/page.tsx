import UvmHeroDiagram from '@/components/UvmHeroDiagram'; // Adjusted import path
import HighlightsCarousel from '@/components/HighlightsCarousel'; // Adjusted import path
import React from 'react';

// Inline styles will be replaced by Tailwind classes

export default function HomePage() {
  return (
    // The <main> tag is part of MainLayout.tsx, so this div is the page content container
    // Applying Tailwind classes for overall page structure and theme
    <div className="flex flex-col items-center py-8 md:py-16 bg-background text-brand-text-primary">

      {/* Hero Section */}
      <section className="w-full max-w-4xl text-center mb-12 md:mb-20 px-4">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-accent font-sans mb-4">
          Master SystemVerilog & UVM
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-brand-text-primary max-w-2xl mx-auto mb-8 font-body">
          Your journey to becoming a verification expert starts here. Explore our interactive curriculum and tools.
        </p>
        {/* UvmHeroDiagram will need its own styling adapted to Tailwind if necessary */}
        <UvmHeroDiagram />
      </section>

      {/* Highlights Carousel Section */}
      <section id="highlights-carousel-section" className="w-full max-w-6xl mt-8 md:mt-16 mb-8 md:mb-16 px-4">
        <h2 className="text-3xl sm:text-4xl font-bold text-brand-text-primary text-center mb-8 md:mb-12 font-sans">
          Key Features
        </h2>
        {/* HighlightsCarousel will also need its internal styling (cards, etc.) adapted to Tailwind */}
        <HighlightsCarousel />
      </section>
    </div>
  );
}
