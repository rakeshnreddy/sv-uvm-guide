'use client';

import React from 'react';
import { curriculumData, getModules, type Tier, type ModuleEntry } from '@/lib/curriculum-data';
import { useCurriculumProgress } from '../../hooks/useCurriculumProgress';
import { ModuleCard } from './ModuleCard';
import { ArrowRight } from 'lucide-react';

export const Recommendations = () => {
  const { isLoaded, progress, getModuleProgress, isModuleLocked, isTierUnlocked } = useCurriculumProgress();

  if (!isLoaded) {
    return null; // Or a skeleton loader
  }

  type ModuleSelection = { module: ModuleEntry; tier: Tier };
  const unlockedTiers = curriculumData.filter(tier => isTierUnlocked(tier.slug));
  const unlockedModules: ModuleSelection[] = unlockedTiers.flatMap(tier =>
    getModules(tier).map(module => ({ module, tier })),
  );

  const visitedModules = unlockedModules
    .map(entry => ({ ...entry, details: progress[entry.module.id] }))
    .filter((entry): entry is ModuleSelection & { details: NonNullable<typeof progress[string]> } =>
      Boolean(entry.details?.lastVisitedAt),
    )
    .sort((a, b) => (b.details.lastVisitedAt ?? 0) - (a.details.lastVisitedAt ?? 0));

  const selected: ModuleSelection[] = [];
  const seen = new Set<string>();

  const addModule = (entry: ModuleSelection) => {
    if (seen.has(entry.module.id) || isModuleLocked(entry.module.id, entry.tier.slug)) {
      return;
    }
    seen.add(entry.module.id);
    selected.push(entry);
  };

  for (const entry of visitedModules) {
    if (selected.length >= 3) break;
    addModule(entry);
  }

  if (selected.length < 3) {
    for (const entry of unlockedModules) {
      if (selected.length >= 3) break;
      if (getModuleProgress(entry.module.id) === 0) {
        addModule(entry);
      }
    }
  }

  if (selected.length < 3) {
    for (const entry of unlockedModules) {
      if (selected.length >= 3) break;
      addModule(entry);
    }
  }

  if (selected.length === 0) {
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
        {selected.map(({ module, tier }) => (
          <ModuleCard
            key={module.id}
            module={module}
            tier={tier}
            progress={getModuleProgress(module.id)}
            isLocked={false} // We already filtered for unlocked modules
          />
        ))}
      </div>
    </div>
  );
};
