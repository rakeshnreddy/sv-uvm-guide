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
    <section aria-labelledby="lesson-error-title" className="w-full max-w-3xl" data-testid="lesson-error">
      {/* Unboxed, like every page header: the title at the frame's left edge, the hairline under the actions. */}
      <div>
        <p className="text-label text-subtle">Error</p>
        <h1 id="lesson-error-title" className="mt-2 text-h1 text-foreground">
          This lesson could not be shown
        </h1>
        <p className="mt-3 max-w-[27.5em] text-lead text-muted-foreground">
          Something went wrong while loading this page. Try again. If it keeps happening, the links below lead to the rest
          of the curriculum.
        </p>
        {error.digest ? (
          <p className="mt-2 break-all text-ui text-muted-foreground">
            Error reference:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{error.digest}</code>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-8">
          <button
            type="button"
            onClick={retry}
            aria-disabled={retrying || undefined}
            className={cn(
              "sheen-primary inline-flex min-h-11 items-center gap-2 rounded-lg border border-transparent bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-150 ease-bench forced-colors:border-[ButtonText] motion-reduce:transition-none",
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
