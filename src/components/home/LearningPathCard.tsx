"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Clock, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface LearningPathCardProps {
  path: {
    tier: string;
    title: string;
    icon: React.ElementType;
    color: string;
    time: string;
    skills: string[];
    description: string;
    href: string;
  };
}

const LearningPathCard: React.FC<LearningPathCardProps> = ({ path }) => {
  const colorMap: { [key: string]: { [key: string]: string } } = {
    emerald: {
      bg: 'bg-emerald-500/10 dark:bg-emerald-900/20',
      border: 'border-emerald-500/50',
      text: 'text-emerald-500 dark:text-emerald-400',
      buttonBg: 'bg-emerald-500',
      buttonHoverBg: 'hover:bg-emerald-600',
      shadow: 'hover:shadow-emerald-500/20',
    },
    sky: {
      bg: 'bg-sky-500/10 dark:bg-sky-900/20',
      border: 'border-sky-500/50',
      text: 'text-sky-500 dark:text-sky-400',
      buttonBg: 'bg-sky-500',
      buttonHoverBg: 'hover:bg-sky-600',
      shadow: 'hover:shadow-sky-500/20',
    },
    violet: {
      bg: 'bg-violet-500/10 dark:bg-violet-900/20',
      border: 'border-violet-500/50',
      text: 'text-violet-500 dark:text-violet-400',
      buttonBg: 'bg-violet-500',
      buttonHoverBg: 'hover:bg-violet-600',
      shadow: 'hover:shadow-violet-500/20',
    },
    amber: {
      bg: 'bg-amber-500/10 dark:bg-amber-900/20',
      border: 'border-amber-500/50',
      text: 'text-amber-500 dark:text-amber-400',
      buttonBg: 'bg-amber-500',
      buttonHoverBg: 'hover:bg-amber-600',
      shadow: 'hover:shadow-amber-500/20',
    },
  };
  const colors = colorMap[path.color];

  return (
    <motion.div
      className={`rounded-xl p-6 border ${colors.bg} ${colors.border} flex flex-col h-full transition-all duration-300 ${colors.shadow}`}
      whileHover={{ y: -8, boxShadow: `0px 20px 30px -10px var(--tw-shadow-color)` }}
    >
      <div className={`flex items-center mb-4 ${colors.text}`}>
        <path.icon className="w-8 h-8 mr-3" />
        <h3 className="text-2xl font-bold">{path.tier}</h3>
      </div>
      <h4 className="text-xl font-semibold text-foreground mb-2">{path.title}</h4>
      <p className="text-foreground/70 mb-6 flex-grow">{path.description}</p>

      <div className="mb-6 space-y-3">
        <div className="flex items-center text-foreground/80">
          <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>{path.time} estimated</span>
        </div>
        <div className="flex items-start text-foreground/80">
          <Zap className="w-4 h-4 mr-2 mt-1 flex-shrink-0" />
          <div>
            <span className="font-semibold">Key Skills:</span>
            <ul className="list-none ml-0 mt-1 text-sm text-foreground/70">
              {path.skills.slice(0, 3).map(skill => <li key={skill}>- {skill}</li>)}
            </ul>
          </div>
        </div>
      </div>

      <Button asChild className={`${colors.buttonBg} ${colors.buttonHoverBg} text-white mt-auto font-bold group`}>
        <Link href={path.href}>
          Start Learning
          <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </Button>
    </motion.div>
  );
};

export default LearningPathCard;
