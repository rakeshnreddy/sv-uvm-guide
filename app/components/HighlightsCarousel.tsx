'use client';

import React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Card from './Card'; // Assuming Card.tsx is in the same directory

// Basic Embla Carousel styles - you should move these to a global CSS file
// or use CSS modules for better organization.
const emblaStyles = `
.embla {
  overflow: hidden;
  padding-top: 1rem;
  padding-bottom: 1rem;
}
.embla__container {
  display: flex;
}
.embla__slide {
  position: relative;
  flex: 0 0 80%; /* Show 80% of a slide, so part of the next is visible */
  margin-right: 1rem;
}
@media (min-width: 768px) {
  .embla__slide {
    flex: 0 0 30%; /* On larger screens, show more slides */
  }
}
`;

const features = [
  {
    icon: '📚', // Placeholder icon
    title: "Authoritative Curriculum",
    description: "Master SystemVerilog and UVM with content vetted by industry experts."
  },
  {
    icon: '💻', // Placeholder icon
    title: "Interactive Labs",
    description: "Apply your knowledge with hands-on coding exercises and a waveform studio."
  },
  {
    icon: '🤖', // Placeholder icon
    title: "AI-Powered Tutor",
    description: "Get instant feedback and explanations from your personal AI learning assistant."
  },
  {
    icon: '🧠', // Placeholder icon
    title: "Spaced Repetition",
    description: "Reinforce concepts effectively with our intelligent flashcard system."
  },
  {
    icon: '💬', // Placeholder icon
    title: "Community Forum",
    description: "Connect with fellow learners, ask questions, and share your projects."
  }
];

const HighlightsCarousel: React.FC = () => {
  const [emblaRef] = useEmblaCarousel(
    {
      loop: true,
      align: 'start', // Align slides to the start
    },
    [Autoplay({ delay: 4000, stopOnInteraction: false })] // Autoplay plugin
  );

  return (
    <>
      <style jsx global>{emblaStyles}</style> {/* Not ideal for production, better to use global css */}
      <div className="embla" ref={emblaRef}>
        <div className="embla__container">
          {features.map((feature, index) => (
            <div className="embla__slide" key={index}>
              <Card
                icon={<span>{feature.icon}</span>} // Replace with actual icons later
                title={feature.title}
                description={feature.description}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default HighlightsCarousel;
