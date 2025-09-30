"use client";

import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export type DiagramPlaceholderProps = {
  title: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

const DiagramPlaceholder: React.FC<DiagramPlaceholderProps> = ({
  title,
  description = 'Interactive version returning soon. Explore the referenced lessons to keep progressing while we finalize the visual experience.',
  ctaHref,
  ctaLabel = 'Open related curriculum',
}) => {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-dashed border-primary/30 bg-background/70 p-6 text-center shadow-sm shadow-primary/10 transition-colors hover:border-primary/50 hover:bg-background/80">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-sky-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
      <div className="relative z-10 flex min-h-[220px] flex-col items-center justify-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
        <strong className="text-lg font-semibold text-foreground">{title}</strong>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {ctaHref && (
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/20"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
};

export default DiagramPlaceholder;
