"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Construction } from 'lucide-react';

interface ExerciseLink {
  href: string;
  title: string;
  description: string;
  status: 'completed' | 'wip' | 'planned';
}

interface ExerciseListProps {
  exercises: ExerciseLink[];
}

import Panel from '@/components/ui/Panel';

const ExerciseList: React.FC<ExerciseListProps> = ({ exercises }) => {
  if (!exercises || exercises.length === 0) {
    return <p className="text-muted-foreground">No exercises available yet. Please check back soon!</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {exercises.map((exercise) => (
        <Panel
          key={exercise.title}
          href={exercise.status === 'planned' ? '#' : exercise.href}
          title={exercise.title}
          description={exercise.description}
        />
      ))}
    </div>
  );
};

export default ExerciseList;
