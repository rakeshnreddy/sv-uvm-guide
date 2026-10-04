'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { VisualFrame } from '@/components/visual-system';
import { createWaveDromIndex, renderWaveDromToElement } from '@/lib/wavedrom';
import { CHANNEL_ORDER } from '@/lib/axi-channel-model';
import { STUDIO_SAMPLES, analyzeSource, formatSource, parseStudioSource } from '@/lib/waveform-studio';

const ASSUMPTIONS = [
  'Column k is the value sampled at rising clock edge k (the waveform is drawn by WaveDrom).',
  'The checker runs on signals named after AXI channels (AWVALID/AWREADY, WVALID/WREADY/WLAST, BVALID/BREADY, ARVALID/ARREADY, RVALID/RREADY) and applies IHI0022E A3.2.1 and A3.3.1.',
  'AHB samples are drawn from the AHB lesson model but are not checked here; use the B-AHB-1 visual for AHB rules.',
];

/**
 * Practice tool: edit WaveJSON, see the waveform, and get AXI handshake
 * violations from the same checker that validates the B-AXI-1 figures.
 */
export default function WaveformStudio() {
  const [sampleId, setSampleId] = useState(STUDIO_SAMPLES[0].id);
  const [text, setText] = useState(() => formatSource(STUDIO_SAMPLES[0].source));
  const outputRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<number | null>(null);
  if (indexRef.current === null) indexRef.current = createWaveDromIndex();
  const [renderError, setRenderError] = useState<string | null>(null);

  const selectId = useId();
  const sourceId = useId();
  const taskId = useId();

  const sample = STUDIO_SAMPLES.find((s) => s.id === sampleId) ?? STUDIO_SAMPLES[0];
  const parsed = useMemo(() => parseStudioSource(text), [text]);
  const analysis = useMemo(() => (parsed.ok ? analyzeSource(parsed.source) : null), [parsed]);

  useEffect(() => {
    const el = outputRef.current;
    if (!el) return;
    if (!parsed.ok) {
      el.replaceChildren();
      return;
    }
    try {
      renderWaveDromToElement({ index: indexRef.current ?? 0, source: parsed.source, outputElement: el });
      setRenderError(null);
    } catch (error) {
      el.replaceChildren();
      setRenderError(error instanceof Error ? error.message : 'WaveDrom could not draw this source.');
    }
  }, [parsed]);

  const loadSample = (id: string) => {
    const next = STUDIO_SAMPLES.find((s) => s.id === id);
    if (!next) return;
    setSampleId(id);
    setText(formatSource(next.source));
  };

  const edited = text !== formatSource(sample.source);

  return (
    <VisualFrame
      label="Waveform studio"
      eyebrow="Practice tool"
      title="Waveform Studio"
      summary="Edit a WaveJSON timing diagram and see it redrawn. AXI signals are checked against the handshake and channel-dependency rules as you type."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <label htmlFor={selectId} className="text-sm font-medium text-foreground">
              Sample
            </label>
            <select
              id={selectId}
              value={sampleId}
              onChange={(e) => loadSample(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STUDIO_SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <p id={taskId} className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
            <span className="font-semibold">Task: </span>
            {sample.task}
          </p>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={sourceId} className="text-sm font-medium text-foreground">
                WaveJSON source
              </label>
              <button
                type="button"
                onClick={() => loadSample(sampleId)}
                disabled={!edited}
                className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Reset sample
              </button>
            </div>
            <textarea
              id={sourceId}
              aria-describedby={taskId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              rows={14}
              className="w-full resize-y rounded-md border border-border bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100 [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {parsed.ok && parsed.relaxed ? (
              <p className="text-xs text-muted-foreground">Relaxed WaveJSON accepted (bare keys, single quotes or trailing commas).</p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <figure className="space-y-2">
            <figcaption className="text-sm font-medium text-foreground">Waveform</figcaption>
            <div className="overflow-x-auto rounded-md border border-border bg-white p-2">
              <div ref={outputRef} data-testid="studio-waveform" aria-hidden="true" />
            </div>
          </figure>

          {!parsed.ok ? (
            <p role="alert" className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-200">
              <span aria-hidden="true">✕ </span>
              {parsed.error}
            </p>
          ) : renderError ? (
            <p role="alert" className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-200">
              <span aria-hidden="true">✕ </span>
              {renderError}
            </p>
          ) : null}

          <section aria-label="Protocol check" className="rounded-md border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Protocol check</h3>
            <div role="status" aria-live="polite">
              {!analysis ? (
                <p className="text-sm text-muted-foreground">Fix the source to run the checker.</p>
              ) : !analysis.axiChecked ? (
                <p className="text-sm text-muted-foreground">
                  No AXI VALID/READY pairs found, so nothing to check. Name signals like <code>AWVALID</code> and <code>AWREADY</code> to enable the checker.
                </p>
              ) : (
                <div className="space-y-2 text-sm">
                  {analysis.violations.length === 0 ? (
                    <p className="font-medium text-emerald-700 dark:text-emerald-300">
                      <span aria-hidden="true">✓ </span>No handshake or dependency violations in {analysis.edges} edges.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {analysis.violations.map((v, i) => (
                        <li key={`${v.rule}-${v.channel}-${v.edge}-${i}`} className="rounded border border-red-500/40 bg-red-500/5 p-2">
                          <p className="font-medium text-red-800 dark:text-red-200">
                            <span aria-hidden="true">✕ </span>
                            {v.channel} channel, edge {v.edge} <span className="font-normal text-muted-foreground">({v.clause})</span>
                          </p>
                          <p className="text-foreground">{v.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    {CHANNEL_ORDER.filter((c) => analysis.handshakes[c]).map((c) => (
                      <React.Fragment key={c}>
                        <dt className="font-mono font-semibold text-foreground">{c}</dt>
                        <dd className="text-muted-foreground">
                          {analysis.handshakes[c]?.length
                            ? `transfers at edge${analysis.handshakes[c]!.length > 1 ? 's' : ''} ${analysis.handshakes[c]!.join(', ')}`
                            : 'no transfer'}
                        </dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </VisualFrame>
  );
}
