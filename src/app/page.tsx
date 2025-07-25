import UvmHeroDiagram from '@/components/UvmHeroDiagram';
import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
          The premier open-source destination for mastering SystemVerilog and UVM. <br /> <strong>Engineered for students, professionals, and enthusiasts alike.</strong>
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/curriculum/T1_Foundational/F1_Why_Verification">
            <Button>Start Learning</Button>
          </Link>
          <Link href="/curriculum">
            <Button variant="secondary">Explore Curriculum</Button>
          </Link>
        </div>
      </section>

      {/* Key Features Section */}
      <section id="key-features-section" className="w-full max-w-6xl mt-8 md:mt-16 mb-8 md:mb-16 px-4">
        <h2 className="text-3xl sm:text-4xl font-bold text-primary text-center mb-8 md:mb-12 font-sans">
          Key Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <BookOpen className="w-12 h-12 text-accent" />
              <CardTitle>Authoritative Curriculum</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Master SystemVerilog and UVM with content vetted by industry experts.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Code className="w-12 h-12 text-accent" />
              <CardTitle>Interactive Labs</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Apply your knowledge with hands-on coding exercises and a waveform studio.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Zap className="w-12 h-12 text-accent" />
              <CardTitle>AI-Powered Tutor</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Get instant feedback and explanations from your personal AI learning assistant.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <BarChart className="w-12 h-12 text-accent" />
              <CardTitle>Spaced Repetition</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Reinforce concepts effectively with our intelligent flashcard system.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Users className="w-12 h-12 text-accent" />
              <CardTitle>Community Forum</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Connect with fellow learners, ask questions, and share your projects.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <DollarSign className="w-12 h-12 text-accent" />
              <CardTitle>Free and Open Source</CardTitle>
            </CardHeader>
            <CardContent>
              <p>All content is free and the project is open source. Contribute on GitHub!</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
