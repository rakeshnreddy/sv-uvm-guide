import UvmHeroDiagram from '@/components/UvmHeroDiagram';
import HighlightsCarousel from '@/components/HighlightsCarousel';
import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { DollarSign, Zap, BarChart, BookOpen, Code, MessageSquare, Users } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center py-8 md:py-16 bg-background text-brand-text-primary">

      {/* Hero Section */}
      <section className="w-full max-w-4xl text-center mb-12 md:mb-20 px-4" data-testid="hero-section">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-accent font-sans mb-4">
          Master SystemVerilog & UVM
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-brand-text-primary max-w-2xl mx-auto mb-8 font-body">
          Your comprehensive guide to mastering SystemVerilog and the Universal Verification Methodology (UVM).
          From fundamentals to advanced topics, kickstart your journey to becoming a verification expert.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/curriculum" className="p-6 bg-card hover:bg-accent/50 rounded-lg shadow-md transition-all hover:shadow-lg transform hover:-translate-y-1">
            <h3 className="text-xl font-semibold text-accent-foreground mb-2">Curriculum</h3>
            <p className="text-sm text-muted-foreground">Explore the full curriculum.</p>
          </Link>
          <Link href="/sv-concepts" className="p-6 bg-card hover:bg-accent/50 rounded-lg shadow-md transition-all hover:shadow-lg transform hover:-translate-y-1">
            <h3 className="text-xl font-semibold text-accent-foreground mb-2">SV Concepts</h3>
            <p className="text-sm text-muted-foreground">Master the fundamentals of SystemVerilog.</p>
          </Link>
          <Link href="/uvm-concepts" className="p-6 bg-card hover:bg-accent/50 rounded-lg shadow-md transition-all hover:shadow-lg transform hover:-translate-y-1">
            <h3 className="text-xl font-semibold text-accent-foreground mb-2">UVM Concepts</h3>
            <p className="text-sm text-muted-foreground">Learn the Universal Verification Methodology.</p>
          </Link>
          <Link href="/exercises" className="p-6 bg-card hover:bg-accent/50 rounded-lg shadow-md transition-all hover:shadow-lg transform hover:-translate-y-1">
            <h3 className="text-xl font-semibold text-accent-foreground mb-2">Exercises</h3>
            <p className="text-sm text-muted-foreground">Test your knowledge with interactive exercises.</p>
          </Link>
          <Link href="/dashboard" className="p-6 bg-card hover:bg-accent/50 rounded-lg shadow-md transition-all hover:shadow-lg transform hover:-translate-y-1">
            <h3 className="text-xl font-semibold text-accent-foreground mb-2">Dashboard</h3>
            <p className="text-sm text-muted-foreground">Track your progress and review your notes.</p>
          </Link>
          <Link href="/community" className="p-6 bg-card hover:bg-accent/50 rounded-lg shadow-md transition-all hover:shadow-lg transform hover:-translate-y-1">
            <h3 className="text-xl font-semibold text-accent-foreground mb-2">Community</h3>
            <p className="text-sm text-muted-foreground">Connect with other learners and experts.</p>
          </Link>
        </div>
      </section>

      {/* Highlights Carousel Section */}
      <section id="highlights-carousel-section" className="w-full max-w-6xl mt-8 md:mt-16 mb-8 md:mb-16 px-4">
        <h2 className="text-3xl sm:text-4xl font-bold text-brand-text-primary text-center mb-8 md:mb-12 font-sans">
          Key Features
        </h2>
        <HighlightsCarousel />
      </section>
    </div>
  );
}
