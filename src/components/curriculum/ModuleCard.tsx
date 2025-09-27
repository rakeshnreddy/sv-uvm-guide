import React from 'react';
import Link from 'next/link';
import { ModuleEntry, Tier } from '@/lib/curriculum-data';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { CheckCircle, Lock, PlayCircle, Star, Book, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/Progress';

interface ModuleCardProps {
  module: ModuleEntry;
  tier?: Tier;
  isLocked?: boolean;
  progress?: number;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  module,
  tier,
  isLocked = false, // Default to unlocked for now
  progress = 0,     // Default to 0 progress
}) => {
  const Icon = Book;
  const firstLesson = module.lessons?.find(lesson => lesson.slug === 'index') ?? module.lessons?.[0];
  const lessonCount = module.lessons?.length ?? 0;
  const startSlug = firstLesson?.slug ?? module.lessons?.[0]?.slug ?? 'index';
  const startLink = tier
    ? `/curriculum/${tier.slug}/${module.slug}/${startSlug}`
    : '/curriculum';
  const isCompleted = progress === 100;
  const hasProgress = progress > 0 && progress < 100;
  const progressValue = Math.max(0, Math.min(progress, 100));
  const statusLabel = isCompleted
    ? 'Completed'
    : hasProgress
      ? `In progress · ${progressValue}%`
      : 'Not started yet';

  const description = firstLesson?.description || 'Curriculum update in progress.';

  const ctaLabel = isCompleted ? 'Review lessons' : hasProgress ? 'Continue learning' : 'Start learning';
  const ctaVariant = (hasProgress || isCompleted) ? 'secondary' : 'default';
  const CtaIcon = isCompleted ? CheckCircle : hasProgress ? ArrowRight : PlayCircle;

  return (
    <Card
      className={cn(
        'relative flex h-full flex-col border border-border/60 bg-card/80 text-card-foreground shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-md',
        isLocked && 'pointer-events-none opacity-60',
      )}
    >
      <CardHeader className="flex-1 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-1 text-left">
              {tier && (
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tier.title}
                </span>
              )}
              <Link
                href={startLink}
                className="text-left text-lg font-semibold leading-tight text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {module.title}
              </Link>
            </div>
          </div>
          {isLocked ? (
            <Lock className="h-5 w-5 text-muted-foreground" />
          ) : isCompleted ? (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="space-y-2">
          <Progress value={progressValue} />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{statusLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            {lessonCount} lesson{lessonCount === 1 ? '' : 's'}
          </span>
          {firstLesson && firstLesson.title !== module.title && (
            <span className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              {firstLesson.title}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="mt-auto">
        {isLocked ? (
          <Button className="w-full" disabled>
            <Lock className="mr-2 h-4 w-4" /> Locked
          </Button>
        ) : (
          <Button asChild variant={ctaVariant} className="w-full">
            <Link href={startLink}>
              {ctaLabel}
              <CtaIcon className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
