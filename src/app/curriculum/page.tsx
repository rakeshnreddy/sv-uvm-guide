'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { curriculumData, getModules } from '@/lib/curriculum-data';
import { TierSection } from '@/components/curriculum/TierSection';
import { useCurriculumProgress } from '../../hooks/useCurriculumProgress';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, List, GitMerge } from 'lucide-react';
import LearningPathDiagram from '@/components/curriculum/LearningPathDiagram';
import { Recommendations } from '@/components/curriculum/Recommendations';

export default function CurriculumPage() {
  const {
    isLoaded,
    getModuleProgress,
    getTierProgress,
    isModuleLocked,
    isTierUnlocked,
  } = useCurriculumProgress();

  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'diagram'>('list');

  useEffect(() => {
    // On load, find the first unlocked, incomplete tier and open it.
    if (isLoaded) {
      const firstUnlockedIncompleteTier = curriculumData.find(tier =>
        isTierUnlocked(tier.slug) && getTierProgress(tier.slug) < 100
      );
      if (firstUnlockedIncompleteTier) {
        setActiveTier(firstUnlockedIncompleteTier.slug);
      } else {
        // If all unlocked are complete, open the last unlocked one
        const lastUnlocked = [...curriculumData].reverse().find(tier => isTierUnlocked(tier.slug));
        setActiveTier(lastUnlocked?.slug || null);
      }
    }
  }, [isLoaded, getTierProgress, isTierUnlocked]);

  const filteredTiers = useMemo(() => {
    return curriculumData.map(tier => {
      const filteredModules = getModules(tier).filter(module => {
        const searchMatch = searchTerm === '' ||
          module.title.toLowerCase().includes(searchTerm.toLowerCase());

        const difficultyMatch = true;

        // Status filter
        const progress = getModuleProgress(module.id);
        const statusMatch = statusFilter === 'all' ||
          (statusFilter === 'not-started' && progress === 0) ||
          (statusFilter === 'in-progress' && progress > 0 && progress < 100) ||
          (statusFilter === 'completed' && progress === 100);

        return searchMatch && difficultyMatch && statusMatch;
      });
      return { ...tier, modules: filteredModules };
    }).filter(tier => tier.modules.length > 0);
  }, [searchTerm, statusFilter, getModuleProgress]);


  if (!isLoaded) {
    return <CurriculumSkeleton />;
  }

  return (
    <div className="p-4 md:p-8 lg:p-12">
      <header className="mb-12 md:mb-16 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-sans bg-clip-text text-transparent bg-gradient-to-r from-primary to-sky-400 mb-4">
          Learning Curriculum
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-4xl mx-auto">
          A guided journey through the world of SystemVerilog and UVM. Start from the basics and progress to expert-level verification techniques, one module at a time.
        </p>
        <div className="mt-8 max-w-2xl mx-auto">
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search modules..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-full border bg-background/50 focus:ring-2 focus:ring-primary focus:outline-none"
                />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select
                    value={difficultyFilter}
                    onChange={e => setDifficultyFilter(e.target.value)}
                    className="w-full px-4 py-2 rounded-full border bg-background/50 focus:ring-2 focus:ring-primary focus:outline-none"
                >
                    <option value="all">All Difficulties</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                </select>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2 rounded-full border bg-background/50 focus:ring-2 focus:ring-primary focus:outline-none"
                >
                    <option value="all">All Statuses</option>
                    <option value="not-started">Not Started</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                </select>
            </div>
        </div>
        <div className="mt-6 flex justify-center">
            <div className="inline-flex rounded-full bg-background/50 border p-1">
                <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
                >
                    <List className="w-4 h-4 mr-2 inline-block" />
                    List View
                </button>
                <button
                    onClick={() => setViewMode('diagram')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewMode === 'diagram' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
                >
                    <GitMerge className="w-4 h-4 mr-2 inline-block" />
                    Diagram View
                </button>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <Recommendations />
        {viewMode === 'list' ? (
          filteredTiers.length > 0 ? (
              filteredTiers.map(tier => (
                <TierSection
                  key={tier.slug}
                  tier={tier}
                  tierProgress={getTierProgress(tier.slug)}
                  isTierUnlocked={isTierUnlocked(tier.slug)}
                  getModuleProgress={getModuleProgress}
                  isModuleLocked={(moduleId) => isModuleLocked(moduleId, tier.slug)}
                  isOpen={activeTier === tier.slug}
                  onToggle={() => setActiveTier(activeTier === tier.slug ? null : tier.slug)}
                />
              ))
          ) : (
              <div className="text-center py-16">
                  <h3 className="text-2xl font-semibold">No Modules Found</h3>
                  <p className="text-muted-foreground mt-2">Try adjusting your search term.</p>
              </div>
          )
        ) : (
          <LearningPathDiagram />
        )}
      </main>
    </div>
  );
}

const CurriculumSkeleton = () => (
  <div className="p-4 md:p-8 lg:p-12">
    <header className="mb-12 md:mb-16 text-center">
      <Skeleton className="h-16 w-3/4 mx-auto mb-4" />
      <Skeleton className="h-7 w-full max-w-4xl mx-auto" />
    </header>
    <main className="max-w-7xl mx-auto">
      {[1, 2].map(i => (
        <div key={i} className="mb-16">
          <Skeleton className="h-10 w-1/2 mb-2" />
          <Skeleton className="h-6 w-3/4 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      ))}
    </main>
  </div>
);
