import React, { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * The template for practice, exercise and guide pages. It is unboxed: one
 * content-width container, a plain header with a hairline below, then the
 * content. There is no outer card, so an interactive card never sits on a
 * card of the same colour.
 *
 * Running text (paragraphs, lists, quotes, headings) uses the prose styles and
 * is capped at 68 characters per line. Anything marked `not-prose`, and every
 * chart and diagram slot, uses the full container width.
 */

/** Prose styles for the children, with running text capped at 68ch. */
export const infoPageProseClass =
  "prose max-w-none prose-p:max-w-[68ch] prose-ul:max-w-[68ch] prose-ol:max-w-[68ch] prose-blockquote:max-w-[68ch] prose-headings:max-w-[68ch] prose-code:before:content-none prose-code:after:content-none";

interface InfoPageProps {
  title?: string;
  description?: string;
  children?: ReactNode; // Main content of the page
  // Optional slots for specific types of content; these render outside the prose styles at full width.
  charts?: ReactNode[];
  diagrams?: ReactNode[];
  /**
   * Add the page gutters (16 px on phones, 24 on tablets, 32 on desktop).
   * Pages inside the app shell (MainLayout) pass `false`: the shell already
   * provides the gutter, and doubling it squeezes phones.
   */
  gutter?: boolean;
}

export const InfoPage: React.FC<InfoPageProps> = ({
  title,
  description,
  children,
  charts,
  diagrams,
  gutter = true,
}) => {
  return (
    <div
      data-testid="info-page"
      className={cn("mx-auto w-full max-w-6xl", gutter ? "px-4 py-8 sm:px-6 lg:px-8" : "pb-8")}
    >
      <article>
        {title && (
          <header className="mb-8 border-b border-border pb-6">
            <h1 className="text-h1 text-foreground">{title}</h1>
            {description && (
              <p className="mt-3 max-w-[68ch] text-lead text-muted-foreground">{description}</p>
            )}
          </header>
        )}

        {children && (
          <section className={cn("mb-8", infoPageProseClass)}>
            {children}
          </section>
        )}

        {charts && charts.length > 0 && (
          <section className="not-prose mb-8">
            <h2 className="mb-4 mt-10 text-h2 text-foreground">Charts and visualizations</h2>
            <div className="space-y-8">
              {charts.map((chart, index) => (
                <div key={`chart-${index}`} className="min-w-0">{chart}</div>
              ))}
            </div>
          </section>
        )}

        {diagrams && diagrams.length > 0 && (
          <section className="not-prose mb-8">
            <h2 className="mb-4 mt-10 text-h2 text-foreground">Diagrams and illustrations</h2>
            <div className="space-y-8">
              {diagrams.map((diagram, index) => (
                <div key={`diagram-${index}`} className="min-w-0">{diagram}</div>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
};

export default InfoPage;
