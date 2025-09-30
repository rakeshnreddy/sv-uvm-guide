"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import SimplifiedUvmDiagram from './SimplifiedUvmDiagram';
import { verificationStackLinks } from './verification-stack-links';

const InteractiveUvmArchitectureDiagram: React.FC = () => {
  const flow = useMemo(
    () => verificationStackLinks.filter(link => link.componentId),
    [],
  );
  const quickSummaryLink = useMemo(
    () => verificationStackLinks.find(link => link.id === 'interactive'),
    [],
  );

  const [activeId, setActiveId] = useState<string | null>(flow[0]?.id ?? null);

  const activeNode = useMemo(() => {
    return flow.find(node => node.id === activeId) ?? flow[0] ?? null;
  }, [activeId, flow]);

  const downstreamNodes = useMemo(() => {
    if (!activeNode?.next?.length) {
      return [];
    }

    return activeNode.next
      .map(nextId => flow.find(node => node.id === nextId))
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
  }, [activeNode, flow]);

  if (!activeNode) {
    return <SimplifiedUvmDiagram />;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/10">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Explore the verification stack</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            See how each UVM layer hands work to the next
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Select a layer to review its responsibilities, downstream dependencies, and the lesson that dives deeper. The panel updates instantly without the heavy D3 canvas that previously froze the page.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
          <ol className="flex flex-col gap-4" data-testid="uvm-flow-list">
            {flow.map((node, index) => {
              const isActive = node.id === activeNode.id;

              return (
                <li key={node.id} className="flex items-stretch gap-4">
                  <div className="flex flex-col items-center pt-1">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/60 bg-background/70 text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </span>
                    {index < flow.length - 1 && (
                      <span className="mt-2 h-full w-px flex-1 bg-border/60" aria-hidden="true" />
                    )}
                  </div>
                  <button
                    type="button"
                    data-node-id={node.id}
                    onClick={() => setActiveId(node.id)}
                    className={`flex-1 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      isActive
                        ? 'border-primary/70 bg-primary/10 text-foreground shadow-inner'
                        : 'border-border/60 bg-background/70 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                    aria-pressed={isActive}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                      {node.stage ?? 'Layer'}
                    </span>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-base font-semibold">{node.title}</span>
                      <ArrowRight
                        className={`h-4 w-4 transition-transform ${isActive ? 'translate-x-1 text-primary' : 'text-muted-foreground'}`}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{node.description}</p>
                  </button>
                </li>
              );
            })}
          </ol>

          <article
            className="flex flex-col justify-between rounded-2xl border border-border/60 bg-background/80 p-6"
            data-testid="uvm-node-detail"
          >
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/70">
                {activeNode.stage ?? 'Layer'}
              </span>
              <h3 className="mt-1 text-2xl font-semibold text-foreground">
                {activeNode.title}
              </h3>
              <p className="mt-3 text-sm text-muted-foreground">
                {activeNode.insight ?? activeNode.description}
              </p>

              {activeNode.focusAreas && activeNode.focusAreas.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold text-foreground">Focus areas</h4>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {activeNode.focusAreas.map(area => (
                      <li
                        key={area}
                        className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground"
                      >
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {downstreamNodes.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Leads into
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {downstreamNodes.map(node => (
                      <span
                        key={node.id}
                        className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {node.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild data-testid="uvm-node-cta">
                <Link href={activeNode.href}>
                  Open lesson
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {activeNode.tip && (
                <div className="flex max-w-sm items-start gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
                  <Sparkles className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                  <span>{activeNode.tip}</span>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>

      {quickSummaryLink && (
        <div className="space-y-3" data-testid="uvm-quick-summary">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Need a quick summary?
            </h3>
            <p className="text-sm text-muted-foreground">
              Prefer the lightweight overview? Use the quick links below or open the curriculum card directly.
            </p>
          </div>
          <SimplifiedUvmDiagram
            variant="selectable"
            activeId={activeNode.id}
            onNodeSelect={id => setActiveId(id)}
          />
        </div>
      )}
    </div>
  );
};

export default InteractiveUvmArchitectureDiagram;
