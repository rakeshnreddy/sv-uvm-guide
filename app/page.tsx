import UvmHeroDiagram from '@/app/components/UvmHeroDiagram';
import HighlightsCarousel from '@/app/components/HighlightsCarousel';
import React from 'react';

// Component-specific styles can be defined here or in a CSS module
const pageContainerStyles: React.CSSProperties = { // Renamed from pageStyles to avoid conflict if pageStyles is global
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '2rem 0', // Vertical padding, horizontal handled by sections within .page-container
  // backgroundColor and color are now handled by globals.css on body
};

const heroSectionStyles: React.CSSProperties = {
  width: '100%',
  maxWidth: '1000px',
  textAlign: 'center',
  marginBottom: '3rem',
  padding: '0 1rem', // Padding for smaller screens
};

const mainHeadingStyles: React.CSSProperties = {
  fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', // Responsive font size
  fontWeight: 'bold',
  // color: 'var(--accent-color)', // Handled by global h1 style in globals.css
  marginBottom: '1rem',
};

const subHeadingStyles: React.CSSProperties = {
  fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
  color: 'var(--text-light)', // Using CSS variable
  marginBottom: '2rem',
  maxWidth: '700px', // Limit width of subheading
  marginLeft: 'auto',
  marginRight: 'auto',
};

const highlightsSectionStyles: React.CSSProperties = {
  width: '100%',
  maxWidth: '1200px',
  marginTop: '4rem',
  marginBottom: '4rem',
  padding: '0 1rem', // Padding for smaller screens
};

const sectionTitleStyles: React.CSSProperties = {
  // fontSize: '2rem', // Handled by global h2 style
  fontWeight: 'bold',
  // color: 'var(--text-light)', // Handled by global h2 style (which is accent)
  textAlign: 'center',
  marginBottom: '2rem',
};

export default function HomePage() {
  return (
    // The main wrapper div now uses pageContainerStyles and className for global padding.
    // The <main> tag is in layout.tsx
    <div style={pageContainerStyles} className="page-container">
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
    </div>
  );
}
