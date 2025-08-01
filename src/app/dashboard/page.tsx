'use client';

import React from 'react';
import { useCurriculumProgress } from '../../hooks/useCurriculumProgress';
import { curriculumData, getModules } from '@/lib/curriculum-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Zap, Layers } from 'lucide-react';

const DashboardPage = () => {
  const { isLoaded, progress, getModuleProgress, getTierProgress, isTierUnlocked } = useCurriculumProgress();

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  const completedModules = curriculumData.flatMap(t => getModules(t)).filter(m => getModuleProgress(m.id) === 100).length;
  const totalModules = curriculumData.flatMap(t => getModules(t)).length;
  const overallProgress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
  const unlockedTiers = curriculumData.filter(t => isTierUnlocked(t.slug)).length;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">Your Progress Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallProgress}%</div>
            <p className="text-xs text-muted-foreground">
              {completedModules} of {totalModules} modules completed
            </p>
            <Progress value={overallProgress} className="mt-4" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiers Unlocked</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">
                {unlockedTiers} / {curriculumData.length}
             </div>
             <p className="text-xs text-muted-foreground">Keep going to unlock more!</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Lessons</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
                {Object.values(progress).reduce((acc, p) => acc + p.completedLessons.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all modules</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Progress by Tier</h2>
        <div className="space-y-6">
          {curriculumData.map(tier => (
            <Card key={tier.slug}>
              <CardHeader>
                <CardTitle>{tier.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tier Progress</span>
                  <span className="font-semibold">{getTierProgress(tier.slug)}%</span>
                </div>
                <Progress value={getTierProgress(tier.slug)} />
                <div className="mt-4 space-y-2">
                    <h4 className="font-semibold">Modules:</h4>
                    {getModules(tier).map(module => (
                        <div key={module.id} className="flex justify-between items-center text-sm">
                            <span>{module.title}</span>
                            <span className={getModuleProgress(module.id) === 100 ? 'text-green-500' : ''}>{getModuleProgress(module.id)}%</span>
                        </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

const DashboardSkeleton = () => (
    <div className="container mx-auto p-4 md:p-8">
        <Skeleton className="h-10 w-1/3 mb-8" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-1/4 mb-1" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <Skeleton className="h-2 w-full" />
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-1/4 mb-1" />
                    <Skeleton className="h-4 w-1/2" />
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-1/4 mb-1" />
                    <Skeleton className="h-4 w-1/2" />
                </CardContent>
            </Card>
        </div>
        <div>
            <Skeleton className="h-8 w-1/4 mb-4" />
            <div className="space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    </div>
)

export default DashboardPage;