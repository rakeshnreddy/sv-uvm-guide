'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Clock, Eye, MapPin } from 'lucide-react';

import { SignalTag } from '@/components/ui/SignalTag';
import { labelWithCode, moduleDisplayTitle, type OverviewModule } from '@/lib/curriculum-overview';
import { TRACE_STATE_LABEL, type TraceState } from '@/lib/progress-trace';
import { tierDataAttribute, tierOfModuleCode } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';
import { chip, focusRing, tagLink, tagInLink, textLink } from './overview-ui';

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
  /**
   * The module's state in this browser, in the progress trace's words: not
   * started, opened (a lesson opened or marked done) or done (every lesson done).
   */
  state?: TraceState;
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
  state = 'not-started',
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
  // The tier from the curriculum data (never the code's prefix): the 2 px top edge and the tinted tag.
  const tier = tierOfModuleCode(module.code);

  return (
    <article
      aria-labelledby={titleId}
      data-tier={tierDataAttribute(tier)}
      className={cn(
        // Quiet glass (DESIGN.md section 11): the module list sits below the colour field, so no blur.
        'glass-quiet flex h-full min-w-0 flex-col rounded-xl p-4 text-card-foreground',
        tier && 'tier-edge',
        elective && 'border-2 border-dashed border-border',
        // The module the learner is in: the raised surface with a 2 px accent edge.
        here && 'border-l-2 border-l-primary bg-muted',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SignalTag code={module.code} />
        {elective && <span className={cn(chip, 'border-dashed border-border text-muted-foreground')}>Elective</span>}
        {here ? (
          <span className={cn(chip, 'border-primary bg-card text-foreground')}>
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> You are here
          </span>
        ) : null}
        {state === 'done' ? (
          <span className={cn(chip, 'border-success/40 text-success')} data-testid="module-state" data-state={state}>
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> {TRACE_STATE_LABEL.done}
          </span>
        ) : state === 'opened' && !here ? (
          <span className={cn(chip, 'border-border text-muted-foreground')} data-testid="module-state" data-state={state}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {TRACE_STATE_LABEL.opened}
          </span>
        ) : null}
      </div>

      <Heading id={titleId} className="mt-2 text-h4 text-foreground">
        <Link
          href={module.href}
          aria-current={here ? 'location' : undefined}
          className={cn('rounded-sm underline-offset-4 transition-colors duration-150 ease-bench hover:text-primary hover:underline motion-reduce:transition-none [overflow-wrap:anywhere]', focusRing)}
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
          <div className="flex flex-wrap items-center gap-x-2">
            <dt className="font-semibold text-foreground">Before you start:</dt>
            <dd>
              <ul className="flex flex-wrap gap-x-1">
                {prerequisites.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={p.href}
                      aria-label={labelWithCode(p.code, p.title)}
                      title={labelWithCode(p.code, p.title)}
                      className={tagLink}
                    >
                      <SignalTag code={p.code} className={tagInLink} />
                    </Link>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {module.milestones.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <dt className="font-semibold text-foreground">Builds toward:</dt>
            <dd>
              <ul className="flex flex-wrap gap-1.5">
                {module.milestones.map((id) => (
                  <li key={id}>
                    <SignalTag code={id} title={milestoneNames[id]} />
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
                    </Link>
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
              'inline-flex min-h-[40px] items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary underline-offset-4 hover:underline',
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
