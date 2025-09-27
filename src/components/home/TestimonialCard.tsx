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
    <div className="flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/80 px-6 py-8 text-left shadow-sm">
      <p className="mb-6 text-base italic text-muted-foreground">
        “{testimonial.quote}”
      </p>
      <div className="flex items-center gap-4">
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted">
          <Image
            src={testimonial.image}
            alt={testimonial.name}
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>
        <div>
          <p className="font-semibold text-foreground">{testimonial.name}</p>
          <p className="text-sm text-muted-foreground">
            {testimonial.title}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestimonialCard;
