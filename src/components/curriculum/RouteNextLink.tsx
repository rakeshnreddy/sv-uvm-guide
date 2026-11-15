"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import React, { useSyncExternalStore } from "react";

import {
  readSelectedRoute,
  routeAnchor,
  subscribeSelectedRoute,
  type RouteId,
  type RouteNextOption,
} from "@/lib/learning-route-state";
import { CURRICULUM_HREF } from "@/lib/site-links";
import { cn } from "@/lib/utils";

import { PREVIOUS_LESSON_LINK_CLASS } from "./LessonPager";
import { inlineLink, secondaryAction } from "./overview-ui";

/** The server render has no chosen route, so it draws nothing and hydration matches. */
const serverRoute = (): RouteId | null => null;

export interface RouteNextLinkProps {
  /** From routeNextOptions(): where each route that takes this lesson goes next and came from. */
  options: readonly RouteNextOption[];
  /** The core-path next lesson's URL, which the page's "Next lesson" action already shows. */
  coreNextHref?: string;
  /** The core-path previous lesson's URL, which the page's "Previous lesson" link already shows. */
  corePrevHref?: string;
  className?: string;
}

/**
 * "Next on your <route> route", for a learner who follows a route (closure
 * finding C10). The page's Next and Previous links follow the core path; a
 * route skips some core modules, so where the two part, these quieter links
 * keep the learner on their route:
 * - a note naming any route step before the next lesson that has practice but
 *   no lessons (the Expert route's interview step);
 * - "Next on your <route> route" when the route's next lesson is not the
 *   core-path one, or a note when this is the route's last lesson;
 * - "Previous on your <route> route" when the route's previous lesson is not
 *   the core-path one.
 * It shows nothing when no route is chosen in this browser, when the lesson is
 * not on the chosen route, or when the route agrees with the core path.
 */
export default function RouteNextLink({ options, coreNextHref, corePrevHref, className }: RouteNextLinkProps) {
  const selected = useSyncExternalStore(subscribeSelectedRoute, readSelectedRoute, serverRoute);
  const option = selected ? options.find((entry) => entry.routeId === selected) : undefined;
  if (!option) return null;

  const { next, prev, routeName } = option;
  const between = option.between ?? [];
  const showNext = Boolean(next) && next?.href !== coreNextHref;
  const showPrev = Boolean(prev) && prev?.href !== corePrevHref;
  if (next && !showNext && !showPrev && between.length === 0) return null;

  const overview = (
    <Link href={`${CURRICULUM_HREF}#${routeAnchor(option.routeId)}`} className={inlineLink}>
      curriculum overview
    </Link>
  );

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)} data-testid="route-next">
      {between.length > 0 ? (
        <p className="text-ui text-muted-foreground" data-testid="route-next-between">
          Your {routeName} route continues with {between.join(", then ")}. It has practice but no lessons: see it on the{" "}
          {overview}.
        </p>
      ) : null}
      {next ? null : (
        <p className="text-ui text-muted-foreground">
          This is the last lesson on your {routeName} route. See the route on the {overview}.
        </p>
      )}
      {next && showNext ? (
        <>
          <Link href={next.href} className={cn(secondaryAction, "w-full justify-start gap-4 px-5 py-3 text-left")}>
            <span className="min-w-0 flex-1">
              <span className="block text-label">Next on your {routeName} route</span>{" "}
              <span className="mt-1 block break-words">{next.label}</span>{" "}
              <span className="mt-1 block text-ui font-normal text-muted-foreground">{next.step}</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>
          <p className="text-ui text-muted-foreground">
            &ldquo;Next lesson&rdquo; follows the core path. Your route continues here instead.
          </p>
        </>
      ) : null}
      {prev && showPrev ? (
        <Link href={prev.href} className={PREVIOUS_LESSON_LINK_CLASS}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">
            Previous on your {routeName} route: <span className="text-foreground group-hover:underline">{prev.label}</span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}
