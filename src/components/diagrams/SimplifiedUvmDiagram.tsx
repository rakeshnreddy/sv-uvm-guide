"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { verificationStackLinks } from './verification-stack-links';

type SimplifiedUvmDiagramProps = {
  variant?: 'links' | 'selectable';
  activeId?: string | null;
  onNodeSelect?: (id: string) => void;
};

const SimplifiedUvmDiagram: React.FC<SimplifiedUvmDiagramProps> = ({
  variant = 'links',
  activeId,
  onNodeSelect,
}) => {
  return (
    <div className="w-full space-y-6">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/80">
        <Image
          src="/visuals/uvm-architecture.svg"
          alt="Simplified UVM architecture overview"
          width={960}
          height={480}
          className="w-full"
          priority
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {verificationStackLinks.map(({ id, title, description, href }) => {
          const isActive = variant === 'selectable' && activeId === id;
          const cardClasses = cn(
            'group flex flex-col rounded-2xl border border-border/60 bg-background/70 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            variant === 'links' && 'hover:border-primary/60 hover:bg-background/80',
            variant === 'selectable' &&
              (isActive
                ? 'border-primary/70 bg-primary/10 text-foreground'
                : 'hover:border-primary/40 hover:bg-background/80'),
          );

          const content = (
            <>
              <span className="flex items-center justify-between text-sm font-semibold text-primary">
                {title}
                <ArrowRight
                  className={cn(
                    'h-4 w-4 opacity-60 transition-all',
                    variant === 'selectable' && (isActive ? 'translate-x-1 opacity-100 text-primary' : ''),
                    variant === 'links' && 'group-hover:opacity-100',
                  )}
                />
              </span>
              <span className="mt-2 text-sm text-muted-foreground">{description}</span>
            </>
          );

          if (variant === 'links') {
            return (
              <Link key={id} data-node-id={id} href={href} className={cardClasses}>
                {content}
              </Link>
            );
          }

          return (
            <button
              key={id}
              type="button"
              data-node-id={id}
              className={cardClasses}
              onClick={() => onNodeSelect?.(id)}
              aria-pressed={isActive}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SimplifiedUvmDiagram;
