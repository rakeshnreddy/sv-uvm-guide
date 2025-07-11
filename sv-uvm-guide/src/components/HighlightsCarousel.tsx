'use client';

import React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Card from './Card'; // Path will be correct once Card.tsx is also in src/components

// Embla specific styles like .embla, .embla__container, .embla__slide
// should be in `sv-uvm-guide/src/app/globals.css`.
// This component itself doesn't need additional Tailwind classes for its direct structure,
// as Embla handles the layout. The styling of the Cards within is handled by Card.tsx.

const features = [
  {
    icon: '📚', // Placeholder icon, consider using Lucide icons later
    title: "Authoritative Curriculum",
    description: "Master SystemVerilog and UVM with content vetted by industry experts."
  },
  {
    icon: '💻',
    title: "Interactive Labs",
    description: "Apply your knowledge with hands-on coding exercises and a waveform studio."
  },
  {
    icon: '🤖',
    title: "AI-Powered Tutor",
    description: "Get instant feedback and explanations from your personal AI learning assistant."
  },
  {
    icon: '🧠',
    title: "Spaced Repetition",
    description: "Reinforce concepts effectively with our intelligent flashcard system."
  },
  {
    icon: '💬',
    title: "Community Forum",
    description: "Connect with fellow learners, ask questions, and share your projects."
  }
];

const HighlightsCarousel: React.FC = () => {
  const [emblaRef] = useEmblaCarousel(
    {
      loop: true,
      align: 'start',
    },
    [Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })]
  );

  return (
    <div className="embla" ref={emblaRef}>
      <div className="embla__container">
        {features.map((feature, index) => (
          <div className="embla__slide" key={index}>
            {/* The Card component is now styled with Tailwind internally */}
            <Card
              icon={<span className="text-4xl">{feature.icon}</span>}
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
