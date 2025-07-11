'use client';

import React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Card from './Card'; // Assuming Card.tsx is in the same directory

// All emblaStyles have been moved to globals.css

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
    // Removed <style jsx global>{emblaStyles}</style> as styles are in globals.css
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
  );
};

export default HighlightsCarousel;
