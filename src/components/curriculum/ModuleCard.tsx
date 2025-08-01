import React from 'react';
import Link from 'next/link';
import { ModuleEntry, Tier } from '@/lib/curriculum-data';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { CheckCircle, Lock, PlayCircle, Star, Book } from 'lucide-react';

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
  const tierColor = '#0ea5e9';

  const firstTopicSlug = module.lessons?.[0]?.slug || 'index';
  const startLink = tier
    ? `/curriculum/${tier.slug}/${module.slug}/${firstTopicSlug}`
    : '#';

  const isCompleted = progress === 100;

  return (
    <div className={cn("h-full rounded-lg border bg-card text-card-foreground shadow-sm transition-transform duration-300 hover:-translate-y-1", isLocked && "opacity-50 cursor-not-allowed")}>
      <Link href={isLocked ? '#' : startLink} aria-disabled={isLocked} tabIndex={isLocked ? -1 : undefined}>
          <Card className="flex flex-col h-full bg-transparent border-none shadow-none">
            <CardHeader className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-shrink-0">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${tierColor}1A`}} // 1A for alpha
                  >
                    <Icon className="w-6 h-6" style={{ color: tierColor }} />
                  </div>
                </div>
                {isLocked && <Lock className="w-5 h-5 text-muted-foreground" />}
                {isCompleted && <CheckCircle className="w-5 h-5 text-green-500" />}
              </div>
              <CardTitle className="text-lg font-semibold leading-tight">{module.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow p-4 pt-0">
              {/* Progress Bar can go here */}
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    <span>{module.lessons.length} Lessons</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Button variant={progress > 0 ? "secondary" : "default"} className="w-full" disabled={isLocked}>
                    {progress > 0 && progress < 100 ? (
                        <>Continue ({progress}%)</>
                    ) : isCompleted ? (
                        <>Review</>
                    ) : (
                        <><PlayCircle className="mr-2 h-4 w-4" />Start Learning</>
                    )}
                </Button>
            </CardFooter>
          </Card>
      </Link>
    </div>
  );
};
