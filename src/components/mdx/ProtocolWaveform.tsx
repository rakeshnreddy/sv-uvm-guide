'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  createWaveDromIndex,
  parseWaveDromSource,
  renderWaveDromToElement,
  type WaveDromSource,
} from '@/lib/wavedrom';

interface ProtocolWaveformProps {
  spec: WaveDromSource | string;
  title?: string;
  caption?: React.ReactNode;
  ariaLabel?: string;
  legend?: React.ReactNode;
  notes?: React.ReactNode;
  className?: string;
}

const FALLBACK_HEADING = 'Unable to render timing diagram.';

export function ProtocolWaveform({
  spec,
  title,
  caption,
  ariaLabel,
  legend,
  notes,
  className,
}: ProtocolWaveformProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const waveformIndexRef = useRef<number | null>(null);

  if (waveformIndexRef.current === undefined) {
    waveformIndexRef.current = createWaveDromIndex();
  }

  const titleId = useId();
  const captionId = useId();
  const legendId = useId();
  const notesId = useId();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const outputElement = outputRef.current;
    if (!outputElement) {
      return;
    }

    try {
      const source = parseWaveDromSource(spec);
      renderWaveDromToElement({
        index: waveformIndexRef.current ?? 0,
        source,
        outputElement,
      });
      setErrorMessage(null);
    } catch (error) {
      outputElement.replaceChildren();
      setErrorMessage(error instanceof Error ? error.message : 'Unknown waveform render error.');
    }
  }, [spec]);

  const describedBy = [caption ? captionId : null, legend ? legendId : null, notes ? notesId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <figure
      className={cn(
        'not-prose my-6 overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm',
        className,
      )}
      data-testid="protocol-waveform"
    >
      {title && (
        <div className="border-b border-border/50 px-5 py-4">
          <h3 id={titleId} className="text-base font-semibold text-foreground sm:text-lg">
            {title}
          </h3>
        </div>
      )}

      <div className="px-5 py-5">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-inner shadow-slate-200/60">
          <div
            ref={outputRef}
            aria-describedby={describedBy}
            aria-label={title ? ariaLabel : ariaLabel ?? title ?? 'Protocol timing diagram'}
            aria-labelledby={title && !ariaLabel ? titleId : undefined}
            className={cn(
              'min-w-max [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-none',
              errorMessage ? 'hidden' : 'block',
            )}
            role="img"
          />

          {errorMessage && (
            <div
              aria-live="polite"
              className="min-w-[20rem] rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
              data-testid="protocol-waveform-error"
              role="status"
            >
              <p className="font-semibold">{FALLBACK_HEADING}</p>
              <p className="mt-1 text-amber-900">
                Check the WaveDrom spec and try again.
              </p>
              <p className="mt-3 font-mono text-xs text-amber-800">{errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      {(caption || legend || notes) && (
        <figcaption className="border-t border-border/50 px-5 py-4 text-sm text-muted-foreground">
          {caption && (
            <p id={captionId} className="leading-6">
              {caption}
            </p>
          )}

          {legend && (
            <div
              id={legendId}
              className={cn(
                'rounded-xl border border-border/50 bg-muted/35 p-3',
                caption ? 'mt-3' : undefined,
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                Legend
              </p>
              <div className="mt-2 text-sm text-foreground">{legend}</div>
            </div>
          )}

          {notes && (
            <div
              id={notesId}
              className={cn(
                'rounded-xl border border-border/50 bg-muted/35 p-3',
                caption || legend ? 'mt-3' : undefined,
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                Notes
              </p>
              <div className="mt-2 text-sm text-foreground">{notes}</div>
            </div>
          )}
        </figcaption>
      )}
    </figure>
  );
}

export type { WaveDromSource as ProtocolWaveformSpec };

export default ProtocolWaveform;
