import React from "react";

interface VisualRecapProps {
  title: string;
  /** The governing rule in one sentence. */
  rule: string;
  /** Minimal code example. */
  code: string;
  /** The most common mistake. */
  mistake: string;
  /** Where this shows up in a real testbench. */
  inTestbench: string;
  /** The essential mental picture (usually a small SVG or diagram). */
  children?: React.ReactNode;
}

/**
 * The recap card's frame: the lesson figure frame (DESIGN.md section 12), quiet liquid glass with a
 * hairline and radius 16, no hue gradient.
 */
export const VISUAL_RECAP_CLASS = "glass-liquid not-prose my-8 overflow-hidden";
/** The "Recap" chip: a tag (radius 4) in the lesson's tier colour. */
export const VISUAL_RECAP_TAG_CLASS =
  "rounded border border-tier-current-border bg-tier-current-subtle px-1.5 py-0.5 text-label text-tier-current";
/** The minimal code: on the code surface (dark in both modes), a focusable region when it scrolls sideways. */
export const VISUAL_RECAP_CODE_CLASS =
  "overflow-x-auto rounded-lg border border-code-border bg-code-surface p-3 font-mono text-code text-code-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Compact, animation-free recap card: picture, rule, code, mistake, real-TB location. */
export function VisualRecap({ title, rule, code, mistake, inTestbench, children }: VisualRecapProps) {
  return (
    <section
      aria-label={`Visual recap: ${title}`}
      className={VISUAL_RECAP_CLASS}
    >
      <header className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
        <span className={VISUAL_RECAP_TAG_CLASS}>
          Recap
        </span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </header>
      <div className="grid gap-0 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="border-b border-border/60 p-5">
          <p className="mb-2 text-label text-subtle">Mental picture</p>
          {children}
        </div>
        <dl className="space-y-4 p-5 text-sm">
          <div>
            <dt className="text-label text-subtle">Rule</dt>
            <dd className="mt-1 font-medium text-foreground">{rule}</dd>
          </div>
          <div>
            <dt className="text-label text-subtle">Minimal code</dt>
            <dd className="mt-1">
              <pre
                className={VISUAL_RECAP_CODE_CLASS}
                tabIndex={0}
                role="region"
                aria-label={`Recap code: ${title}`}
              >
                <code>{code.trim()}</code>
              </pre>
            </dd>
          </div>
          <div>
            <dt className="text-label text-danger">✕ Common mistake</dt>
            <dd className="mt-1 text-foreground">{mistake}</dd>
          </div>
          <div>
            <dt className="text-label text-subtle">In a real testbench</dt>
            <dd className="mt-1 text-foreground">{inTestbench}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export default VisualRecap;
