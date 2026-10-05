"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useTransition } from "react";

import { FindYourWayBack } from "@/components/curriculum/CurriculumNotFound";
import { cn } from "@/lib/utils";

interface LessonErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for lesson pages (G30-PAGE-04): what happened, a retry
 * button, and the same ways back into the curriculum as the not-found page.
 * It renders inside the learning layout, so the navbar, course outline and
 * footer stay. The page's only h1 is this heading while the error shows.
 */
export default function LessonError({ error, reset }: LessonErrorProps) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const retry = () => {
    if (retrying) return;
    // A failed server render needs fresh data: refetch the route, then re-render this segment.
    startRetry(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <section aria-labelledby="lesson-error-title" className="mx-auto w-full max-w-3xl py-6" data-testid="lesson-error">
      <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Error</p>
        <h1 id="lesson-error-title" className="mt-2 text-3xl font-bold text-foreground">
          This lesson could not be shown
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Something went wrong while loading this page. Try again. If it keeps happening, the links below lead to the rest
          of the curriculum.
        </p>
        {error.digest ? (
          <p className="mt-1 break-all text-sm text-muted-foreground">
            Error reference:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{error.digest}</code>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={retry}
            aria-disabled={retrying || undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "aria-disabled:cursor-progress aria-disabled:opacity-80",
            )}
          >
            <RotateCw aria-hidden="true" className={cn("h-4 w-4", retrying && "motion-safe:animate-spin")} />
            Try again
          </button>
          {/* Always rendered, so screen readers announce the text when it appears. */}
          <p role="status" className="text-sm text-muted-foreground">
            {retrying ? "Loading the lesson again…" : ""}
          </p>
        </div>

        <FindYourWayBack />
      </div>
    </section>
  );
}
