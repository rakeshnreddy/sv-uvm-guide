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

const ExerciseList: React.FC<ExerciseListProps> = ({ exercises }) => {
  if (!exercises || exercises.length === 0) {
    return <p className="text-muted-foreground">No exercises available yet. Please check back soon!</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {exercises.map((exercise) => (
        <Link href={exercise.status === 'planned' ? '#' : exercise.href} key={exercise.title} legacyBehavior>
          <a
            className={`block p-6 bg-card rounded-lg shadow-md transition-all ${
              exercise.status === 'planned'
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:bg-accent/50 hover:shadow-lg transform hover:-translate-y-1'
            }`}
            aria-disabled={exercise.status === 'planned'}
            onClick={(e) => {
              if (exercise.status === 'planned') {
                e.preventDefault();
                // Optionally, you could show a toast or alert here:
                // alert("This exercise is coming soon!");
              }
            }}
          >
            <h3 className="text-xl font-semibold text-accent-foreground mb-2 flex justify-between items-center">
              {exercise.title}
              {exercise.status === 'planned' ? (
                <Construction className="w-5 h-5 text-amber-500" />
              ) : (
                <ArrowRight className="w-5 h-5 text-primary" />
              )}
            </h3>
            <p className="text-sm text-muted-foreground">{exercise.description}</p>
            {exercise.status === 'planned' && (
              <p className="text-xs text-amber-600 mt-2 font-semibold">(Coming Soon)</p>
            )}
          </a>
        </Link>
      ))}
    </div>
  );
};

export default ExerciseList;
