'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, MapPin } from 'lucide-react';

import { SignalTag } from '@/components/ui/SignalTag';
import { useHydrated } from '@/lib/learner-store/react';
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
import { chip, focusRing, inlineLink, primaryAction, secondaryAction, tagInLink, tagLink, textLink } from './overview-ui';

export interface RouteChooserProps {
  routes: ResolvedRoute[];
  milestones: ResolvedMilestone[];
  selectedRoute: RouteId | null;
  onSelectRoute: (id: RouteId | null) => void;
  /** Lesson visits stored in this browser; empty until they have loaded. */
  progress: ProgressLike;
}

export const ROUTE_STEPS_ID = 'route-steps';

/**
 * Before hydration the followed route is not known to React, only to the
 * route-followed script, which marks <html data-route-followed="<id>"> before
 * first paint. These classes (literal, so Tailwind sees them) draw that
 * route's card as followed from the first paint: the raised surface and accent
 * marker, the checked box and, above all, the "Steps on this route" toggle, so
 * the strip paints at its final height and nothing moves when React takes
 * over. A test keeps the attribute name equal to the script's.
 */
export const ROUTE_PRE_PAINT: Record<RouteId, { card: string; box: string; check: string; toggle: string }> = {
  junior: {
    card: '[html[data-route-followed=junior]_&]:bg-muted [html[data-route-followed=junior]_&]:shadow-[inset_2px_0_0_hsl(var(--primary))]',
    box: '[html[data-route-followed=junior]_&]:border-primary [html[data-route-followed=junior]_&]:bg-primary',
    check: 'hidden [html[data-route-followed=junior]_&]:block',
    toggle: 'hidden [html[data-route-followed=junior]_&]:inline-flex',
  },
  practitioner: {
    card: '[html[data-route-followed=practitioner]_&]:bg-muted [html[data-route-followed=practitioner]_&]:shadow-[inset_2px_0_0_hsl(var(--primary))]',
    box: '[html[data-route-followed=practitioner]_&]:border-primary [html[data-route-followed=practitioner]_&]:bg-primary',
    check: 'hidden [html[data-route-followed=practitioner]_&]:block',
    toggle: 'hidden [html[data-route-followed=practitioner]_&]:inline-flex',
  },
  expert: {
    card: '[html[data-route-followed=expert]_&]:bg-muted [html[data-route-followed=expert]_&]:shadow-[inset_2px_0_0_hsl(var(--primary))]',
    box: '[html[data-route-followed=expert]_&]:border-primary [html[data-route-followed=expert]_&]:bg-primary',
    check: 'hidden [html[data-route-followed=expert]_&]:block',
    toggle: 'hidden [html[data-route-followed=expert]_&]:inline-flex',
  },
};

/** The steps toggle's box, shared by the button and its pre-paint stand-in so the two are the same size. */
const STEPS_TOGGLE_CLASS =
  'mt-1 inline-flex min-h-[40px] items-center gap-1 self-start rounded-lg px-1 text-ui font-medium text-primary underline-offset-4';

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

/**
 * Milestone ids as short text, with runs folded: ["M0", "M1", "M2", "M3"] ->
 * "M0 to M3", ["M0", "M2", "M3", "M4"] -> "M0, M2 to M4". Ids that are not
 * "M" and a number are listed as they are.
 */
export function milestoneSpan(ids: readonly string[]): string {
  const parts: string[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length === 0) return;
    parts.push(run.length > 2 ? `M${run[0]} to M${run[run.length - 1]}` : run.map((n) => `M${n}`).join(', '));
    run = [];
  };
  for (const id of ids) {
    const match = /^M(\d+)$/.exec(id);
    if (!match) {
      flush();
      parts.push(id);
      continue;
    }
    const n = Number(match[1]);
    if (run.length > 0 && n !== run[run.length - 1] + 1) flush();
    run.push(n);
  }
  flush();
  return parts.join(', ');
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

/**
 * One route in the strip: its name, who it is for, its lesson count and first
 * modules, its one call to action, and the toggle that follows it. A column of
 * the strip's one quiet-glass panel, so it carries no glass of its own (no glass
 * on glass); the 2 px top edge is the tier the route starts in.
 */
function RouteStripItem({
  route,
  selected,
  onToggle,
  filled,
  stepsOpen,
  onToggleSteps,
  prePaint,
}: {
  route: ResolvedRoute;
  selected: boolean;
  /** Before hydration: draw the card as followed when the route-followed script names this route. */
  prePaint: boolean;
  onToggle: () => void;
  /** This route holds the view's one filled accent action. */
  filled: boolean;
  /** Whether the followed route's steps are showing under the strip. */
  stepsOpen: boolean;
  onToggleSteps: () => void;
}) {
  const anchor = routeAnchor(route.id);
  const tier = routeStartTier(route);
  const opening = routeOpeningModules(route);
  const lessons = route.sequence.length;
  const early = prePaint ? ROUTE_PRE_PAINT[route.id] : undefined;
  return (
    <article
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      data-tier={tierDataAttribute(tier)}
      data-selected={selected ? '' : undefined}
      className={cn(
        'flex h-full min-w-0 scroll-mt-24 flex-col p-5 transition-colors duration-150 ease-bench motion-reduce:transition-none',
        tier && 'tier-edge',
        // The followed route: the raised surface with a 2 px accent marker on the leading edge, as for every current item.
        selected && 'bg-muted shadow-[inset_2px_0_0_hsl(var(--primary))]',
        early?.card,
      )}
    >
      {/* Secondary text, never the subtle colour, on glass (DESIGN.md section 11). */}
      <p className="text-xs font-medium text-muted-foreground">{route.name} route</p>
      <h3 id={`${anchor}-title`} className="mt-1 text-h3 text-foreground">
        {route.tagline}
      </h3>
      <p className="mt-2 text-ui text-muted-foreground">{route.audience}</p>
      <p className="mt-3 font-mono text-xs tabular-nums text-muted-foreground">
        {lessons} {lessons === 1 ? 'lesson' : 'lessons'} · {route.steps.length} steps
        {route.milestones.length > 0 && <> · builds {milestoneSpan(route.milestones.map((m) => m.id))}</>}
      </p>
      {opening.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" data-testid="route-opening-modules">
          Starts with
          {opening.map((m) => (
            <SignalTag key={m.id} code={m.code} title={labelWithCode(m.code, m.title)} />
          ))}
        </p>
      )}
      <div className="mt-auto flex flex-col items-start gap-1 pt-4">
        <Link href={route.cta.href} className={filled ? primaryAction : secondaryAction}>
          {route.cta.label}
        </Link>
        {/* A toggle, drawn as a check box so its pressed state reads without colour. */}
        <button
          type="button"
          aria-pressed={selected}
          onClick={onToggle}
          className={cn(
            'inline-flex min-h-[40px] items-center gap-2 rounded-lg px-1 text-ui font-medium text-foreground transition-colors duration-150 ease-bench hover:text-primary motion-reduce:transition-none',
            focusRing,
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
              selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
              early && cn('text-primary-foreground', early.box),
            )}
          >
            {selected && <Check className="h-3 w-3" strokeWidth={3} />}
            {early && <Check className={cn('h-3 w-3', early.check)} strokeWidth={3} />}
          </span>
          Follow the {route.name} route
        </button>
      </div>
      {selected && (
        // Closed by default: the next lesson is in "Pick up where you left off", and the module list stays near.
        <button
          type="button"
          aria-expanded={stepsOpen}
          aria-controls={ROUTE_STEPS_ID}
          onClick={onToggleSteps}
          data-testid="route-steps-toggle"
          className={cn(STEPS_TOGGLE_CLASS, 'hover:underline', focusRing)}
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', stepsOpen && 'rotate-180')} aria-hidden="true" />
          {routeStepsToggleLabel(route)}
        </button>
      )}
      {early && (
        // The toggle's stand-in until hydration: the same box and words, shown only for the route the script names.
        // Not a control yet (aria-hidden, not focusable); the button replaces it in place.
        <span aria-hidden="true" data-testid="route-steps-toggle-pre-paint" className={cn(STEPS_TOGGLE_CLASS, early.toggle)}>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
          {routeStepsToggleLabel(route)}
        </span>
      )}
    </article>
  );
}

/** The name of the control that shows a followed route's steps: "Steps on this route (6)". */
export function routeStepsToggleLabel(route: Pick<ResolvedRoute, 'steps'>): string {
  return `Steps on this route (${route.steps.length})`;
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

function RouteSteps({ route, progress, open }: { route: ResolvedRoute; progress: ProgressLike; open: boolean }) {
  const position = nextOnRoute(route.sequence, progress);
  const nextLesson = position.status === 'complete' ? undefined : route.sequence[position.index];
  const currentStep = nextLesson?.stepIndex;

  return (
    <div
      id={ROUTE_STEPS_ID}
      role="region"
      aria-labelledby={`${ROUTE_STEPS_ID}-heading`}
      hidden={!open}
      className="mt-6 scroll-mt-24"
    >
      <h3 id={`${ROUTE_STEPS_ID}-heading`} className="text-h3 text-foreground">
        The {route.name} route: {route.steps.length} steps
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-foreground">{route.layers}</p>
      {route.assumesSummary && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{route.assumesSummary}</p>}
      {position.status === 'complete' && (
        <p className="mt-2 text-sm text-foreground">You have opened the last lesson on this route.</p>
      )}

      {/* Hairline-divided rows, not boxes: no cards inside the section. */}
      <ol className="mt-4 divide-y divide-border border-y border-border">
        {route.steps.map((step, index) => {
          const current = index === currentStep;
          return (
            <li
              key={step.id}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'py-4 sm:px-4',
                // The current step: the raised surface with a 2 px accent marker on the leading edge, as for every current item.
                current && 'bg-muted px-4 shadow-[inset_2px_0_0_hsl(var(--primary))]',
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

/** The id of a milestone's row in the ladder's description list: "M3" -> "milestone-m3". */
export function milestoneRowId(id: string): string {
  return `milestone-${id.toLowerCase()}`;
}

export const MILESTONE_DETAILS_ID = 'milestone-details';

/**
 * The milestone ladder as one line of milestone tags (SPEC-phases-2-4.md,
 * "Other pages"): M0 to M8, each a link whose name is the milestone's name,
 * shown as a small tip on hover and keyboard focus. "What each milestone
 * builds" opens the full ladder: every milestone's name, the routes that
 * build it and its lab. A tag opens the ladder at its own row.
 */
export function MilestoneLadder({ milestones, routes }: { milestones: ResolvedMilestone[]; routes: ResolvedRoute[] }) {
  const [open, setOpen] = useState(false);
  const routeName = (id: RouteId) => routes.find((r) => r.id === id)?.name ?? id;
  const half = Math.ceil(milestones.length / 2);

  const openAt = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setOpen(true);
    // The row is inside the closed panel until React renders it open: move there on the next frame.
    window.requestAnimationFrame(() => {
      const row = document.getElementById(milestoneRowId(id));
      row?.scrollIntoView?.({ block: 'nearest' });
      row?.focus({ preventScroll: true });
    });
  };

  return (
    <section aria-labelledby="milestone-ladder-heading" className="mt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 id="milestone-ladder-heading" className="text-ui font-medium text-foreground">
          The milestone ladder
        </h3>
        <ol aria-label="Milestones" className="flex flex-wrap items-center">
          {milestones.map((m, index) => (
            <li key={m.id}>
              <a
                href={`#${milestoneRowId(m.id)}`}
                aria-label={`${m.id}: ${m.name}`}
                onClick={(event) => openAt(event, m.id)}
                className={cn(tagLink, 'relative')}
                data-testid="milestone-tag"
              >
                <SignalTag code={m.id} className={tagInLink} />
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-[15rem] rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-card group-hover:block group-focus-visible:block',
                    index < half ? 'left-0' : 'right-0',
                  )}
                >
                  {m.name}
                </span>
              </a>
            </li>
          ))}
        </ol>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={MILESTONE_DETAILS_ID}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'inline-flex min-h-[40px] items-center gap-1 rounded-lg px-1 text-ui font-medium text-primary underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
          What each milestone builds
        </button>
      </div>
      <div id={MILESTONE_DETAILS_ID} hidden={!open} className="mt-2">
        <p className="max-w-3xl text-ui text-muted-foreground">
          A milestone is a testbench you can run and defend, from a self-checking directed bench (M0) to a subsystem
          capstone (M8). Each route builds them one rung at a time.
        </p>
        <ol aria-label="What each milestone builds" className="mt-3 divide-y divide-border border-y border-border">
          {milestones.map((m) => (
            <li
              key={m.id}
              id={milestoneRowId(m.id)}
              tabIndex={-1}
              className="grid min-w-0 scroll-mt-24 grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,14rem)_minmax(0,18rem)]"
            >
              <SignalTag code={m.id} standalone className="self-start justify-self-start" />
              <span className="text-sm font-medium text-foreground">{m.name}</span>
              <span className="col-start-2 text-xs text-subtle sm:col-start-auto sm:text-sm">
                {m.routes.length > 0 ? `Built on: ${m.routes.map(routeName).join(', ')}` : 'Not built on any route yet'}
              </span>
              <span className="col-start-2 text-xs text-muted-foreground [overflow-wrap:anywhere] sm:col-start-auto sm:text-sm">
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
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * The route chooser on /curriculum: Junior "Start here", Practitioner
 * "Working DV engineer" and Expert "Jump in". Following a route is remembered
 * in this browser; its next lesson shows in "Pick up where you left off", and
 * its steps, with the learner's position, open on request under the strip.
 * "/curriculum#route-<id>" follows that route with its steps open.
 */
export function RouteChooser({ routes, milestones, selectedRoute, onSelectRoute, progress }: RouteChooserProps) {
  const [stepsOpen, setStepsOpen] = useState(false);
  // False in the server render and the hydrating render, when the followed route is not yet known to React;
  // it turns true in the same render that reads the stored route, so the stand-ins and the real card swap at once.
  const hydrated = useHydrated();

  // "/curriculum#route-<id>" follows that route and opens its steps; "#route-steps" opens the steps of the followed one.
  useEffect(() => {
    const apply = () => {
      const { hash } = window.location;
      const id = routeIdFromHash(hash);
      if (id && routes.some((r) => r.id === id)) {
        onSelectRoute(id);
        setStepsOpen(true);
      } else if (hash === `#${ROUTE_STEPS_ID}`) {
        setStepsOpen(true);
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [routes, onSelectRoute]);

  const selected = routes.find((r) => r.id === selectedRoute) ?? null;

  const toggleSteps = () => {
    const opening = !stepsOpen;
    setStepsOpen(opening);
    if (!opening) return;
    // Below md the strip stacks, so the steps open under the last route: bring their top into view when it is off screen.
    window.requestAnimationFrame(() => {
      const panel = document.getElementById(ROUTE_STEPS_ID);
      if (panel && panel.getBoundingClientRect().top > window.innerHeight * 0.85) panel.scrollIntoView?.({ block: 'start' });
    });
  };
  // One filled accent action per view: the Junior route's call to action, unless
  // "Pick up where you left off" is showing (a followed route or a visited
  // lesson), whose continue action then holds the accent.
  const resumeShown = selectedRoute !== null || recentVisits(progress, 1).length > 0;

  return (
    <section id="routes" aria-labelledby="routes-heading" className="mb-12 scroll-mt-24">
      <h2 id="routes-heading" className="text-h2 text-foreground">
        Choose your route
      </h2>
      <p className="mt-1 max-w-[40em] text-ui text-muted-foreground">
        Three ordered paths through the same lessons. Follow one to see its steps and your next lesson; every module
        stays one click away below.
      </p>
      {/* One compact strip, the landing page's pattern: one quiet-glass panel split by hairlines. */}
      <ul className="glass-quiet mt-5 grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl text-card-foreground md:grid-cols-3 md:divide-x md:divide-y-0">
        {routes.map((route) => (
          <li key={route.id} className="min-w-0">
            <RouteStripItem
              route={route}
              selected={route.id === selectedRoute}
              onToggle={() => {
                setStepsOpen(false);
                onSelectRoute(route.id === selectedRoute ? null : route.id);
              }}
              filled={route.id === 'junior' && !resumeShown}
              stepsOpen={stepsOpen}
              onToggleSteps={toggleSteps}
              prePaint={!hydrated}
            />
          </li>
        ))}
      </ul>
      {selected && <RouteSteps route={selected} progress={progress} open={stepsOpen} />}
      <MilestoneLadder milestones={milestones} routes={routes} />
    </section>
  );
}

export default RouteChooser;
