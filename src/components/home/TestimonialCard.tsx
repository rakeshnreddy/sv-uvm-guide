"use client";

import React from 'react';
import Image from 'next/image';

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
    <div className="glass-card h-full px-6 py-8 flex flex-col justify-between text-left">
      <p className="text-[color:var(--blueprint-foreground)]/80 italic mb-6">
        “{testimonial.quote}”
      </p>
      <div className="flex items-center gap-4">
        <div className="relative w-12 h-12 rounded-full overflow-hidden border border-[color:var(--blueprint-border)] bg-[color:var(--blueprint-glass-strong)] flex-shrink-0">
          <Image
            src={testimonial.image}
            alt={testimonial.name}
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>
        <div>
          <p className="font-semibold text-[color:var(--blueprint-foreground)]">{testimonial.name}</p>
          <p className="text-sm text-[color:var(--blueprint-foreground)]/65">
            {testimonial.title}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestimonialCard;
