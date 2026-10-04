'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Clock, Eye, MapPin } from 'lucide-react';

import { labelWithCode, moduleDisplayTitle, type OverviewModule } from '@/lib/curriculum-overview';
import { cn } from '@/lib/utils';
import { chip, focusRing, textLink } from './overview-ui';

export interface ModuleCardPrerequisite {
  id: string;
  code: string;
  title: string;
  href: string;
}

export interface ModuleCardProps {
  module: OverviewModule;
  /** The module's manifest prerequisites, resolved to titles and links. */
  prerequisites: ModuleCardPrerequisite[];
  /** Milestone names by id ("M2" -> "Reusable UVM agent, active and passive"). */
  milestoneNames: Readonly<Record<string, string>>;
  /** The learner has opened a lesson in this module (stored in this browser). */
  visited?: boolean;
  /** The module of the lesson the learner opened last. */
  here?: boolean;
  /** Heading level of the module title inside its section. */
  headingLevel?: 3 | 4;
}

/**
 * One module in the curriculum overview: title, what it is about, how long it
 * takes, what to read first, the milestones it builds, its labs and lessons.
 * Electives get a dashed border and an "Elective" label, never colour alone.
 */
export const ModuleCard: React.FC<ModuleCardProps> = ({
  module,
  prerequisites,
  milestoneNames,
  visited = false,
  here = false,
  headingLevel = 4,
}) => {
  const [showLessons, setShowLessons] = useState(false);
  const uid = useId();
  const titleId = `${uid}-title`;
  const lessonsId = `${uid}-lessons`;
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  const elective = module.track === 'elective';
  const lessonCount = module.lessons.length;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        'flex h-full min-w-0 flex-col rounded-2xl border bg-card p-4 text-card-foreground shadow-sm',
        elective ? 'border-2 border-dashed border-border' : 'border-border',
        here && 'ring-2 ring-primary',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono font-semibold text-muted-foreground">{module.code}</span>
        {elective && <span className={cn(chip, 'border-dashed border-border text-muted-foreground')}>Elective</span>}
        {here ? (
          <span className={cn(chip, 'border-primary bg-primary text-primary-foreground')}>
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> You are here
          </span>
        ) : (
          visited && (
            <span className={cn(chip, 'border-border text-muted-foreground')}>
              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Visited
            </span>
          )
        )}
      </div>

      <Heading id={titleId} className="mt-2 text-base font-semibold leading-snug text-foreground">
        <Link
          href={module.href}
          aria-current={here ? 'location' : undefined}
          className={cn('rounded-sm underline-offset-4 hover:text-primary hover:underline [overflow-wrap:anywhere]', focusRing)}
        >
          <span className="sr-only">{module.code}: </span>
          {module.displayTitle}
        </Link>
      </Heading>

      {module.description && <p className="mt-2 text-sm text-muted-foreground">{module.description}</p>}

      <dl className="mt-3 space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <dt className="sr-only">Length</dt>
          <dd className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
            {module.minutes > 0 && <> · about {module.minutes} min</>}
          </dd>
        </div>
        {prerequisites.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="font-semibold text-foreground">Before you start:</dt>
            <dd>
              <ul className="flex flex-wrap gap-x-2 gap-y-1">
                {prerequisites.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={p.href}
                      aria-label={labelWithCode(p.code, p.title)}
                      title={labelWithCode(p.code, p.title)}
                      className={cn(textLink, 'inline-flex min-h-[24px] items-center px-0.5 font-mono')}
                    >
                      {p.code}
                    </Link>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {module.milestones.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="font-semibold text-foreground">Builds toward:</dt>
            <dd>
              <ul className="flex flex-wrap gap-1.5">
                {module.milestones.map((id) => (
                  <li key={id} className={cn(chip, 'border-border font-mono text-foreground')} title={milestoneNames[id]}>
                    {id}
                    {milestoneNames[id] && <span className="sr-only">: {milestoneNames[id]}</span>}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {module.labs.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="font-semibold text-foreground">{module.labs.length === 1 ? 'Lab:' : 'Labs:'}</dt>
            <dd className="min-w-0">
              <ul className="space-y-1">
                {module.labs.map((lab) => (
                  <li key={lab.id} className="[overflow-wrap:anywhere]">
                    <Link href={lab.href} className={textLink}>
                      {lab.title}
                    </Link>{' '}
                    <span className="text-muted-foreground">(sign-in required)</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      {lessonCount > 1 && (
        <div className="mt-auto pt-3">
          <button
            type="button"
            aria-expanded={showLessons}
            aria-controls={lessonsId}
            onClick={() => setShowLessons((open) => !open)}
            className={cn(
              'inline-flex min-h-[40px] items-center gap-1 rounded-md px-1 text-sm font-medium text-primary hover:underline',
              focusRing,
            )}
          >
            <ChevronDown
              className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', showLessons && 'rotate-180')}
              aria-hidden="true"
            />
            Lessons in this module ({lessonCount})
          </button>
          <div id={lessonsId} hidden={!showLessons}>
            {showLessons && (
              <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm">
                {module.lessons.map((lesson) => (
                  <li key={lesson.key} className="[overflow-wrap:anywhere]">
                    <Link href={lesson.href} className={textLink}>
                      {lesson.slug === 'index' ? `Overview: ${module.displayTitle}` : moduleDisplayTitle(lesson.title, module.code)}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

export default ModuleCard;
