"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

import { curriculumData } from "@/lib/curriculum-data";
import { lessonPath, suggestLessonsForPath } from "@/lib/curriculum/lesson-urls";

function firstLessonHref(): string {
  const tier = curriculumData[0];
  const section = tier?.sections[0];
  const topic = section?.topics.find((entry) => entry.slug === "index") ?? section?.topics[0];
  return tier && section && topic ? lessonPath([tier.slug, section.slug, topic.slug]) : "/curriculum";
}

const linkClass =
  "font-semibold text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

/**
 * The not-found page body (G30-PAGE-04): what happened, "did you mean" links
 * built from the requested path, the ways back into the curriculum, and search
 * tips. Used by the root not-found page and by the curriculum route.
 */
export default function CurriculumNotFound() {
  // The root not-found page is prerendered once (as /_not-found) and served for
  // every unmatched URL, so read the address the browser actually requested
  // after mounting; the server HTML and the first client render stay identical.
  const routerPathname = usePathname();
  const [pathname, setPathname] = useState("");
  useEffect(() => {
    setPathname(window.location.pathname);
  }, [routerPathname]);
  const suggestions = useMemo(() => (pathname ? suggestLessonsForPath(pathname) : []), [pathname]);

  return (
    <section aria-labelledby="not-found-title" className="mx-auto w-full max-w-3xl py-6" data-testid="not-found">
      <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Error 404</p>
        <h1 id="not-found-title" className="mt-2 text-3xl font-bold text-foreground">
          Page not found
        </h1>
        <p className="mt-3 text-base text-muted-foreground">This page could not be found.</p>
        {pathname ? (
          <p className="mt-1 break-all text-sm text-muted-foreground">
            Requested address: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{pathname}</code>
          </p>
        ) : null}

        {suggestions.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-foreground">Did you mean</h2>
            <ul className="mt-2 space-y-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion.href}>
                  <Link href={suggestion.href} className={linkClass}>
                    {suggestion.title.startsWith(`${suggestion.code}:`)
                      ? suggestion.title
                      : `${suggestion.code}: ${suggestion.title}`}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">Find your way back</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <Link href="/curriculum" className={linkClass}>
                Curriculum overview
              </Link>
              : every tier, module and lesson in order.
            </li>
            <li>
              <Link href={firstLessonHref()} className={linkClass}>
                Start at the first lesson
              </Link>{" "}
              if you are new to verification.
            </li>
            <li>
              <Link href="/practice" className={linkClass}>
                Practice hub
              </Link>
              : labs, exercises and interactive models.
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">Search tips</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Search by module code, such as <kbd className="font-mono">I-SV-5</kbd>, or by a term the lesson teaches, such as{" "}
              <kbd className="font-mono">mailbox</kbd> or <kbd className="font-mono">uvm_config_db</kbd>.
            </li>
            <li>Use the search in the top bar, or the module filter on the curriculum overview.</li>
            <li>
              Lesson addresses look like{" "}
              <code className="break-all font-mono">/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/index</code>
              : tier folder, module folder, then the lesson.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
