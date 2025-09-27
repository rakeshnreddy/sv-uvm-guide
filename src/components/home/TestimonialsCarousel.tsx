"use client";

import React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import TestimonialCard from './TestimonialCard';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const testimonials = [
  {
    quote: "This platform transformed my understanding of UVM. The interactive labs are a game-changer!",
    name: "Alex Johnson",
    title: "Verification Engineer",
    image: "/avatars/01.svg",
  },
  {
    quote: "I finally grasped complex SystemVerilog concepts thanks to the clear explanations and examples.",
    name: "Maria Garcia",
    title: "ASIC Designer",
    image: "/avatars/02.svg",
  },
  {
    quote: "The best resource for UVM on the web. I recommend it to all my colleagues.",
    name: "David Chen",
    title: "Senior DV Engineer",
    image: "/avatars/03.svg",
  },
  {
    quote: "The community forum is incredibly helpful. I've learned so much from other users.",
    name: "Samantha Lee",
    title: "FPGA Developer",
    image: "/avatars/04.svg",
  },
  {
    quote: "An indispensable tool for anyone serious about a career in semiconductor verification.",
    name: "Ben Carter",
    title: "VLSI Student",
    image: "/avatars/05.svg",
  }
];

type TestimonialsCarouselProps = {
  className?: string;
};

const TestimonialsCarousel = ({ className }: TestimonialsCarouselProps) => {
  const [emblaRef] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000 })]);

  return (
    <motion.div
      className={cn('w-full', className)}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6 }}
    >
      <h3 className="mb-3 text-center text-3xl font-semibold text-foreground">
        What our learners say
      </h3>
      <div className="neon-divider mx-auto mb-8 max-w-2xl" />
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {testimonials.map((testimonial, index) => (
            <div
              className="flex-[0_0_100%] p-4 md:flex-[0_0_50%] lg:flex-[0_0_33.33%]"
              key={index}
            >
              <TestimonialCard testimonial={testimonial} />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default TestimonialsCarousel;
