'use client';

import React from 'react';
import { curriculumData, getModules } from '@/lib/curriculum-data';
import { useCurriculumProgress } from '@/hooks/useCurriculumProgress';
import { ModuleCard } from './ModuleCard';
import { ArrowRight } from 'lucide-react';

export const Recommendations = () => {
  const { isLoaded, getModuleProgress, isModuleLocked, isTierUnlocked } = useCurriculumProgress();

  if (!isLoaded) {
    return null; // Or a skeleton loader
  }

  const recommendedModules = [];
  for (const tier of curriculumData) {
    if (isTierUnlocked(tier.slug)) {
      for (const mod of getModules(tier)) {
        if (recommendedModules.length < 3 && !isModuleLocked(mod.id, tier.slug) && getModuleProgress(mod.id) === 0) {
          recommendedModules.push({ ...mod, tierId: tier.slug });
        }
      }
    }
    if (recommendedModules.length >= 3) break;
  }

  if (recommendedModules.length === 0) {
    return null;
  }

  return (
    <div className="mb-12 md:mb-16">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold flex items-center">
                <ArrowRight className="w-6 h-6 mr-3 text-primary" />
                Recommended For You
            </h2>
            <p className="text-muted-foreground text-sm">Your next steps</p>
        </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {recommendedModules.map(module => (
          <ModuleCard
            key={module.id}
            module={module}
            progress={getModuleProgress(module.id)}
            isLocked={false} // We already filtered for unlocked modules
          />
        ))}
      </div>
    </div>
  );
};
