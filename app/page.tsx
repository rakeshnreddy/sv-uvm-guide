import UvmHeroDiagram from '@/app/components/UvmHeroDiagram'; // Assuming @ is src and components is under app/
import React from 'react';

// Basic styling for the page, replace with your actual styling solution (e.g., Tailwind, CSS Modules)
const pageStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '2rem',
  minHeight: '100vh',
  backgroundColor: '#0A192F', // Example dark background
  color: '#E6F1FF', // Example light text color
};

const heroSectionStyles: React.CSSProperties = {
  width: '100%',
  maxWidth: '1000px', // Max width for the hero content
  textAlign: 'center',
  marginBottom: '3rem',
};

const mainHeadingStyles: React.CSSProperties = {
  fontSize: '3rem',
  fontWeight: 'bold',
  color: '#64FFDA', // Accent color
  marginBottom: '1rem',
};

const subHeadingStyles: React.CSSProperties = {
  fontSize: '1.25rem',
  color: '#CCD6F6', // Lighter text color
  marginBottom: '2rem',
};

export default function HomePage() {
  return (
    <main style={pageStyles}>
      <section style={heroSectionStyles}>
        <h1 style={mainHeadingStyles}>Master SystemVerilog & UVM</h1>
        <p style={subHeadingStyles}>
          Your journey to becoming a verification expert starts here. Explore our interactive curriculum and tools.
        </p>
        <UvmHeroDiagram />
      </section>

      {/* Placeholder for Highlights Carousel - to be implemented in the next step */}
import HighlightsCarousel from '@/app/components/HighlightsCarousel'; // Import the carousel

// ... (keep existing styles)

// ... (keep existing styles)
const highlightsSectionStyles: React.CSSProperties = {
  width: '100%',
  maxWidth: '1200px', // Allow carousel to be a bit wider
  marginTop: '4rem',
  marginBottom: '4rem',
};

const sectionTitleStyles: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 'bold',
  color: '#CCD6F6',
  textAlign: 'center',
  marginBottom: '2rem',
};


export default function HomePage() {
  return (
    <main style={pageStyles}>
      <section style={heroSectionStyles}>
        <h1 style={mainHeadingStyles}>Master SystemVerilog & UVM</h1>
        <p style={subHeadingStyles}>
          Your journey to becoming a verification expert starts here. Explore our interactive curriculum and tools.
        </p>
        <UvmHeroDiagram />
      </section>

      <section id="highlights-carousel-section" style={highlightsSectionStyles}>
        <h2 style={sectionTitleStyles}>Key Features</h2>
        <HighlightsCarousel />
      </section>
    </main>
  );
}
