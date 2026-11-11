'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Check, MapPin } from 'lucide-react';

import { SignalTag } from '@/components/ui/SignalTag';
import { labelWithCode } from '@/lib/curriculum-overview';
import type { ResolvedMilestone, ResolvedRoute, ResolvedStep } from '@/lib/learning-paths';
import {
  nextOnRoute,
  recentVisits,
  routeAnchor,
  routeIdFromHash,
  type ProgressLike,
  type RouteId,
} from '@/lib/learning-route-state';
import { tierDataAttribute, tierOfModuleCode, type TierNumber } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';
import { CodedLabel, withoutCode } from './CodedLabel';
import { chip, eyebrow, inlineLink, primaryAction, secondaryAction, tagInLink, textLink } from './overview-ui';

export interface RouteChooserProps {
  routes: ResolvedRoute[];
  milestones: ResolvedMilestone[];
  selectedRoute: RouteId | null;
  onSelectRoute: (id: RouteId | null) => void;
  /** Lesson visits stored in this browser; empty until they have loaded. */
  progress: ProgressLike;
}

export const ROUTE_STEPS_ID = 'route-steps';

/** The modules a route works through, in order, without the "skim first" review steps. */
function routeModules(route: ResolvedRoute): ResolvedStep['modules'] {
  return route.steps.filter((step) => step.kind !== 'review').flatMap((step) => step.modules);
}

/**
 * The tier a route starts in: the tier of its first module, from the
 * curriculum data. It colours the route card's top edge (DESIGN.md section 11).
 */
export function routeStartTier(route: ResolvedRoute): TierNumber | undefined {
  const [first] = routeModules(route);
  return first ? tierOfModuleCode(first.code) : undefined;
}

/** The first modules of a route, shown as signal tags on its card. */
export function routeOpeningModules(route: ResolvedRoute, count = 3): ResolvedStep['modules'] {
  return routeModules(route).slice(0, count);
}

/** A link whose text starts with a module code: the code as a tier-tinted signal tag, then the title. */
function ModuleLink({ href, code, title }: { href: string; code: string; title: string }) {
  return (
    // The name is set in full: the tag's box would otherwise put a space before the colon in some accessible-name computations.
    <Link href={href} aria-label={labelWithCode(code, title)} className={cn(textLink, 'group')}>
      <CodedLabel code={code} title={withoutCode(title, code)} tagClassName={tagInLink} />
    </Link>
  );
}

function RouteCard({
  route,
  selected,
  onToggle,
  filled,
}: {
  route: ResolvedRoute;
  selected: boolean;
  onToggle: () => void;
  /** This card holds the view's one filled accent action. */
  filled: boolean;
}) {
  const anchor = routeAnchor(route.id);
  const tier = routeStartTier(route);
  const opening = routeOpeningModules(route);
  return (
    <article
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      data-tier={tierDataAttribute(tier)}
      className={cn(
        // Quiet glass: three blurred cards plus the header and a menu would pass the limit of three blurred layers (DESIGN.md section 11).
        'glass-quiet flex min-w-0 scroll-mt-24 flex-col rounded-xl p-5 text-card-foreground',
        tier && 'tier-edge',
        // The followed route: the raised surface with a 2 px accent edge, as for every current item.
        selected && 'border-l-2 border-l-primary bg-muted',
      )}
    >
      <p className={eyebrow}>{route.name} route</p>
      <h3 id={`${anchor}-title`} className="mt-1 text-h3 text-foreground">
        {route.tagline}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{route.audience}</p>
      <p className="mt-2 text-sm text-foreground">{route.layers}</p>
      {opening.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-subtle" data-testid="route-opening-modules">
          Starts with
          {opening.map((m) => (
            <SignalTag key={m.id} code={m.code} title={labelWithCode(m.code, m.title)} />
          ))}
        </p>
      )}
      <p className="mt-2 text-xs text-subtle">
        {route.steps.length} steps · {route.sequence.length} lessons
        {route.milestones.length > 0 && <> · builds {route.milestones.map((m) => m.id).join(', ')}</>}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
        <Link href={route.cta.href} className={filled ? primaryAction : secondaryAction}>
          {route.cta.label}
        </Link>
        <button
          type="button"
          aria-pressed={selected}
          onClick={onToggle}
          className={cn(secondaryAction, selected && 'border-primary')}
        >
          {selected && <Check className="h-4 w-4" aria-hidden="true" />}
          Follow the {route.name} route
        </button>
      </div>
      {selected && (
        <p className="mt-3 text-sm text-foreground">
          You are following this route.{' '}
          <a href={`#${ROUTE_STEPS_ID}`} className={inlineLink}>
            See its {route.steps.length} steps
          </a>
        </p>
      )}
    </article>
  );
}

function StepDetails({ step }: { step: ResolvedStep }) {
  return (
    <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
      {step.review.length > 0 && (
        <>
          <dt className="font-semibold text-foreground">Skim first</dt>
          <dd className="min-w-0">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {step.review.map((m) => (
                <li key={m.id} className="[overflow-wrap:anywhere]">
                  <ModuleLink href={m.href} code={m.code} title={m.title} />
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
      {step.modules.length > 0 && (
        <>
          <dt className="font-semibold text-foreground">Modules</dt>
          <dd className="min-w-0">
            <ul className="space-y-1">
              {step.modules.map((m) => (
                <li key={m.id} className="[overflow-wrap:anywhere]">
                  <ModuleLink href={m.href} code={m.code} title={m.title} />{' '}
                  <span className="text-muted-foreground">
                    ({m.lessonCount} {m.lessonCount === 1 ? 'lesson' : 'lessons'})
                  </span>
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
      {step.practice.length > 0 && (
        <>
          <dt className="font-semibold text-foreground">Practice</dt>
          <dd className="min-w-0">
            <ul className="space-y-1">
              {step.practice.map((item) => (
                <li key={`${item.kind}-${item.label}`} className="[overflow-wrap:anywhere]">
                  <span className="text-muted-foreground">{item.kindLabel}: </span>
                  {item.href ? (
                    <Link href={item.href} className={textLink}>
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-foreground">{item.label}</span>
                  )}
                  {item.note && <span className="text-muted-foreground"> ({item.note})</span>}
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
      {step.milestones.length > 0 && (
        <>
          <dt className="font-semibold text-foreground">Builds</dt>
          <dd className="min-w-0">
            <ul className="space-y-1">
              {step.milestones.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline gap-x-2">
                  <SignalTag code={m.id} className="self-center" />
                  <span className="text-muted-foreground">{m.name}</span>
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
    </dl>
  );
}

function RouteSteps({ route, progress }: { route: ResolvedRoute; progress: ProgressLike }) {
  const position = nextOnRoute(route.sequence, progress);
  const nextLesson = position.status === 'complete' ? undefined : route.sequence[position.index];
  const currentStep = nextLesson?.stepIndex;

  return (
    <div
      id={ROUTE_STEPS_ID}
      role="region"
      aria-labelledby={`${ROUTE_STEPS_ID}-heading`}
      className="glass-quiet mt-6 scroll-mt-24 rounded-2xl p-5 text-card-foreground sm:p-6"
    >
      <h3 id={`${ROUTE_STEPS_ID}-heading`} className="text-h3 text-foreground">
        The {route.name} route: {route.steps.length} steps
      </h3>
      {route.assumesSummary && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{route.assumesSummary}</p>}
      {position.status === 'complete' && (
        <p className="mt-2 text-sm text-foreground">You have opened the last lesson on this route.</p>
      )}

      <ol className="mt-5 space-y-4">
        {route.steps.map((step, index) => {
          const current = index === currentStep;
          return (
            <li
              key={step.id}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'rounded-xl border border-border p-4',
                current && 'border-l-2 border-l-primary bg-muted',
                step.kind === 'elective' && !current && 'border-2 border-dashed',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(chip, 'border-border text-foreground')}>Step {step.number}</span>
                {step.kind === 'review' && <span className={cn(chip, 'border-border text-muted-foreground')}>Skim</span>}
                {step.kind === 'elective' && (
                  <span className={cn(chip, 'border-dashed border-border text-muted-foreground')}>Elective</span>
                )}
                {current && (
                  <span className={cn(chip, 'border-primary bg-card text-foreground')}>
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> You are here
                  </span>
                )}
              </div>
              <h4 className="mt-2 text-h4 text-foreground">{step.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{step.summary}</p>
              {current && nextLesson && (
                <p className="mt-2 text-sm text-foreground [overflow-wrap:anywhere]">
                  <Link href={nextLesson.href} className={inlineLink}>
                    {position.status === 'not-started' ? 'First lesson: ' : 'Next lesson: '}
                    {labelWithCode(nextLesson.moduleCode, nextLesson.title)}
                  </Link>
                </p>
              )}
              <StepDetails step={step} />
            </li>
          );
        })}
      </ol>

      {route.skipped.length > 0 && (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-foreground">Left for later</p>
          <p className="mt-1 text-muted-foreground">
            This route skips these core modules to reach a working testbench sooner. They stay in the module list below.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {route.skipped.map((m) => (
              <li key={m.id} className="[overflow-wrap:anywhere]">
                <ModuleLink href={m.href} code={m.code} title={m.title} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The milestone ladder: the testbench each milestone stands for, the routes that build it and its lab. */
export function MilestoneLadder({ milestones, routes }: { milestones: ResolvedMilestone[]; routes: ResolvedRoute[] }) {
  const routeName = (id: RouteId) => routes.find((r) => r.id === id)?.name ?? id;
  return (
    <section aria-labelledby="milestone-ladder-heading" className="glass-quiet mt-6 rounded-2xl p-5 sm:p-6">
      <h3 id="milestone-ladder-heading" className="text-h3 text-foreground">
        The milestone ladder
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Each route builds real testbenches, one rung at a time. A milestone is a testbench you can run and defend, from
        a self-checking directed bench (M0) to a subsystem capstone (M8).
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {milestones.map((m) => (
          <li key={m.id} className="min-w-0 rounded-xl border border-border p-4">
            <p className="flex items-start gap-2">
              <SignalTag code={m.id} standalone className="mt-0.5" />
              <span className="text-sm font-medium text-foreground">{m.name}</span>
            </p>
            <p className="mt-2 text-xs text-subtle">
              {m.routes.length > 0 ? `Built on: ${m.routes.map(routeName).join(', ')}` : 'Not built on any route yet'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {m.lab ? (
                m.lab.href ? (
                  <>
                    Lab:{' '}
                    <Link href={m.lab.href} className={textLink}>
                      {m.lab.title}
                    </Link>
                  </>
                ) : (
                  <>Lab coming soon: {m.lab.title}</>
                )
              ) : (
                'No lab yet'
              )}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The route chooser on /curriculum: Junior "Start here", Practitioner
 * "Working DV engineer" and Expert "Jump in". Following a route shows its
 * steps with the learner's position, and is remembered in this browser.
 * "/curriculum#route-<id>" follows that route.
 */
export function RouteChooser({ routes, milestones, selectedRoute, onSelectRoute, progress }: RouteChooserProps) {
  useEffect(() => {
    const apply = () => {
      const id = routeIdFromHash(window.location.hash);
      if (id && routes.some((r) => r.id === id)) onSelectRoute(id);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [routes, onSelectRoute]);

  const selected = routes.find((r) => r.id === selectedRoute) ?? null;
  // One filled accent action per view: the Junior route's call to action, unless
  // "Pick up where you left off" is showing (a followed route or a visited
  // lesson), whose continue action then holds the accent.
  const resumeShown = selectedRoute !== null || recentVisits(progress, 1).length > 0;

  return (
    <section id="routes" aria-labelledby="routes-heading" className="mb-12 scroll-mt-24">
      <div className="max-w-3xl">
        <h2 id="routes-heading" className="text-h2 text-foreground">
          Choose your route
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Three ordered paths through the same lessons. Each step lists its modules, its practice and the testbench
          milestone it builds. Follow a route to see your next lesson; every module stays one click away below.
        </p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {routes.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            selected={route.id === selectedRoute}
            onToggle={() => onSelectRoute(route.id === selectedRoute ? null : route.id)}
            filled={route.id === 'junior' && !resumeShown}
          />
        ))}
      </div>
      {selected && <RouteSteps route={selected} progress={progress} />}
      <MilestoneLadder milestones={milestones} routes={routes} />
      <p className="mt-4 text-sm text-muted-foreground">
        Not sure where you fit?{' '}
        <Link href="/quiz/placement" className={inlineLink}>
          Take the placement quiz
        </Link>
        .
      </p>
    </section>
  );
}

export default RouteChooser;
