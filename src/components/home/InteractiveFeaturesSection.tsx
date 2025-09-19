"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Code, Share2, Gamepad2, Bot, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const featureConfigs = [
  {
    title: 'Live Code Editor',
    description: 'Write, compile, and run SystemVerilog code directly in your browser. Get instant feedback on your solutions.',
    icon: Code,
    href: '/practice/lab',
    imageUrl: '/images/feature-code-editor.png'
  },
  {
    title: 'UVM Diagram Explorer',
    description: 'Visualize complex UVM hierarchies and understand component relationships with our interactive diagrams.',
    icon: Share2,
    href: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#layered-environment-snapshot',
    imageUrl: '/images/feature-uvm-explorer.png'
  },
  {
    title: 'Gamified Exercises',
    description: 'Turn learning into a game. Earn points, badges, and climb the leaderboard as you master new skills.',
    icon: Gamepad2,
    href: '/exercises',
    imageUrl: '/images/feature-gamified-exercises.png'
  },
  {
    title: 'AI Tutor Chat',
    description: 'Stuck on a concept? Get instant, personalized help from our AI assistant, available 24/7.',
    icon: Bot,
    href: '#ai-tutor', // This might not have a direct link, could open a widget
    imageUrl: '/images/feature-ai-tutor.png'
  }
];

const features = featureConfigs.map(config => ({
  ...config,
  href: config.href ?? '#',
}));

const FeatureCard = ({ feature, index }: { feature: (typeof features)[0], index: number }) => (
  <motion.div
    className="bg-card border rounded-xl overflow-hidden h-full flex flex-col"
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
  >
    <div className="bg-muted h-48 flex items-center justify-center">
      {/* Placeholder for an image */}
      <feature.icon className="w-24 h-24 text-muted-foreground/30" />
    </div>
    <div className="p-6 flex flex-col flex-grow">
      <h3 className="text-xl font-bold text-primary mb-2">{feature.title}</h3>
      <p className="text-foreground/80 mb-6 flex-grow">{feature.description}</p>
      <Button asChild variant="outline" className="mt-auto group">
        <Link href={feature.href}>
          Try It Now
          <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </Button>
    </div>
  </motion.div>
);

const InteractiveFeaturesSection = () => {
  return (
    <section className="py-20 bg-background/70">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Experience Interactive Learning</h2>
          <p className="text-lg text-foreground/80 max-w-3xl mx-auto">
            Our platform is more than just text and videos. Engage with the material like never before with our hands-on tools.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default InteractiveFeaturesSection;
