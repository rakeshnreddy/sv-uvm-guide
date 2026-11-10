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

/** The shared accent link style: the accent colour, underlined on hover. */
const accentLinkClass =
  "rounded-sm font-medium text-primary underline-offset-4 transition-colors duration-150 ease-bench hover:underline motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * A link that stands on its own line: a block whose padding makes it at least
 * 40 px tall (an easy tap target on a phone), so the line height of the text
 * around it never changes.
 */
export const BLOCK_LINK_CLASS = `block w-fit max-w-full py-2.5 leading-5 ${accentLinkClass}`;

/** One way back: a block link on its own line, then what it leads to. */
function WayBack({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <li>
      <Link href={href} className={BLOCK_LINK_CLASS}>
        {label}
      </Link>
      <p className="text-sm text-muted-foreground">{description}</p>
    </li>
  );
}

/**
 * "Find your way back": the curriculum overview, the first lesson and the
 * practice hub. Shared by the not-found page and the lesson error page, so no
 * dead end looks different from another.
 */
export function FindYourWayBack() {
  return (
    <div className="mt-6">
      <h2 className="text-h3 text-foreground">Find your way back</h2>
      <ul className="mt-2 space-y-3">
        <WayBack href="/curriculum" label="Curriculum overview" description="Every tier, module and lesson in order." />
        <WayBack href={firstLessonHref()} label="Start at the first lesson" description="If you are new to verification." />
        <WayBack href="/practice" label="Practice hub" description="Labs, exercises and interactive models." />
      </ul>
    </div>
  );
}

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
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p data-testid="not-found-eyebrow" className="text-label text-subtle">
          Error 404
        </p>
        <h1 id="not-found-title" className="mt-2 text-h1 text-foreground">
          Page not found
        </h1>
        <p className="mt-3 text-lead text-muted-foreground">This page could not be found.</p>
        {pathname ? (
          <p className="mt-1 break-all text-sm text-muted-foreground">
            Requested address: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{pathname}</code>
          </p>
        ) : null}

        {suggestions.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-h3 text-foreground">Did you mean</h2>
            <ul className="mt-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion.href}>
                  <Link href={suggestion.href} className={BLOCK_LINK_CLASS}>
                    {suggestion.title.startsWith(`${suggestion.code}:`)
                      ? suggestion.title
                      : `${suggestion.code}: ${suggestion.title}`}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <FindYourWayBack />

        <div className="mt-6">
          <h2 className="text-h3 text-foreground">Search tips</h2>
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
