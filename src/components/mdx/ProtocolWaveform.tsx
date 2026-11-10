'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { WaveDromSurfaceStyle } from './WaveDromSurfaceStyle';
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

  if (waveformIndexRef.current === null) {
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
        'not-prose my-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card',
        className,
      )}
      data-testid="protocol-waveform"
    >
      {title && (
        <div className="border-b border-border px-5 py-4">
          <h3 id={titleId} className="text-h4 font-semibold text-foreground">
            {title}
          </h3>
        </div>
      )}

      <div className="px-5 py-5">
        <WaveDromSurfaceStyle />
        <div
          data-wavedrom-surface=""
          className={cn(
            'overflow-x-auto rounded-xl border border-border p-4',
            // The error note sits on the card; the drawn diagram sits on the always-dark code surface.
            errorMessage ? 'bg-card' : 'bg-code-surface',
          )}
        >
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
              className="min-w-[20rem] rounded-lg border border-warning bg-warning-subtle p-4 text-sm text-foreground"
              data-testid="protocol-waveform-error"
              role="status"
            >
              <p className="font-semibold text-foreground">{FALLBACK_HEADING}</p>
              <p className="mt-1 text-muted-foreground">
                Check the WaveDrom spec and try again.
              </p>
              <p className="mt-3 font-mono text-label text-foreground">{errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      {(caption || legend || notes) && (
        <figcaption className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
          {caption && (
            <p id={captionId} className="leading-6">
              {caption}
            </p>
          )}

          {legend && (
            <div
              id={legendId}
              className={cn(
                'rounded-lg border border-border bg-muted p-3',
                caption ? 'mt-3' : undefined,
              )}
            >
              <p className="text-label font-medium text-subtle">
                Legend
              </p>
              <div className="mt-2 text-sm text-foreground">{legend}</div>
            </div>
          )}

          {notes && (
            <div
              id={notesId}
              className={cn(
                'rounded-lg border border-border bg-muted p-3',
                caption || legend ? 'mt-3' : undefined,
              )}
            >
              <p className="text-label font-medium text-subtle">
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
