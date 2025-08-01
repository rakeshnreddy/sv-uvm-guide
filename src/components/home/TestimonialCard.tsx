"use client";

import React from 'react';
interface Testimonial {
  quote: string;
  name:string;
  title: string;
  image: string;
}

interface TestimonialCardProps {
  testimonial: Testimonial;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({ testimonial }) => {
  return (
    <div className="bg-background/50 dark:bg-black/20 backdrop-blur-sm p-6 rounded-lg shadow-lg h-full flex flex-col justify-between">
      <p className="text-foreground/80 italic mb-4">"{testimonial.quote}"</p>
      <div className="flex items-center">
        <div className="w-12 h-12 rounded-full mr-4 bg-primary/20 flex-shrink-0" />
        <div>
          <p className="font-bold text-foreground">{testimonial.name}</p>
          <p className="text-sm text-foreground/70">{testimonial.title}</p>
        </div>
      </div>
    </div>
  );
};

export default TestimonialCard;
