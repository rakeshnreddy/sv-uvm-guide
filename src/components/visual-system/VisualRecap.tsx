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

/** Compact, animation-free recap card: picture, rule, code, mistake, real-TB location. */
export function VisualRecap({ title, rule, code, mistake, inTestbench, children }: VisualRecapProps) {
  return (
    <section
      aria-label={`Visual recap: ${title}`}
      className="not-prose my-8 overflow-hidden rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/[0.07] via-transparent to-violet-500/[0.07]"
    >
      <header className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-200">
          Recap
        </span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </header>
      <div className="grid gap-0 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="border-b border-border/60 p-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mental picture</p>
          {children}
        </div>
        <dl className="space-y-4 p-5 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Rule</dt>
            <dd className="mt-1 font-medium text-foreground">{rule}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Minimal code</dt>
            <dd className="mt-1">
              <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12.5px] leading-5 text-slate-100 [font-variant-ligatures:none]">
                <code>{code.trim()}</code>
              </pre>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">✕ Common mistake</dt>
            <dd className="mt-1 text-foreground">{mistake}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">In a real testbench</dt>
            <dd className="mt-1 text-foreground">{inTestbench}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export default VisualRecap;
