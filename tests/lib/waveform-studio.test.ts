import { describe, expect, it } from 'vitest';
import {
  STUDIO_SAMPLES,
  analyzeSource,
  formatSource,
  parseStudioSource,
  relaxedToStrictJson,
} from '@/lib/waveform-studio';
import { lessonFigure } from '@/lib/axi-channel-model';

const sample = (id: string) => {
  const found = STUDIO_SAMPLES.find((s) => s.id === id);
  if (!found) throw new Error(`missing sample ${id}`);
  return found;
};

describe('relaxed WaveJSON parsing (never evaluated)', () => {
  it('accepts the WaveDrom editor style: bare keys, single quotes, trailing commas, comments', () => {
    const text = `{ signal: [
      { name: 'clk', wave: 'p...' }, // clock
      { name: 'bus', wave: 'x=.x', data: ['a', "b's"], },
    ], }`;
    const result = parseStudioSource(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.relaxed).toBe(true);
    expect(result.source.signal[1]).toEqual({ name: 'bus', wave: 'x=.x', data: ['a', "b's"] });
  });

  it('keeps strict JSON strict (no relaxed flag)', () => {
    const result = parseStudioSource('{"signal":[{"name":"a","wave":"01"}]}');
    expect(result).toMatchObject({ ok: true, relaxed: false });
  });

  it('rejects code instead of running it', () => {
    expect(() => relaxedToStrictJson('{ signal: alert(1) }')).toThrow(/Unexpected word "alert"/);
    const result = parseStudioSource('{ signal: [ (() => 1)() ] }');
    expect(result.ok).toBe(false);
  });

  it('requires a top-level signal array', () => {
    expect(parseStudioSource('{"head":{}}')).toMatchObject({ ok: false });
    expect(parseStudioSource('   ')).toMatchObject({ ok: false });
  });

  it('round-trips every sample through formatSource', () => {
    for (const s of STUDIO_SAMPLES) {
      const result = parseStudioSource(formatSource(s.source));
      expect(result.ok, s.id).toBe(true);
      if (result.ok) expect(result.source).toEqual(s.source);
    }
  });
});

describe('samples come from the protocol models', () => {
  it('uses the same generator as the B-AXI-1 lesson figures', () => {
    expect(sample('axi-write').source).toEqual(lessonFigure('write'));
    expect(sample('axi-read').source).toEqual(lessonFigure('read'));
  });

  it('legal AXI samples pass the A3.2.1 / A3.3.1 checker', () => {
    for (const id of ['axi-handshake', 'axi-write', 'axi-read']) {
      const analysis = analyzeSource(sample(id).source);
      expect(analysis.axiChecked, id).toBe(true);
      expect(analysis.violations, id).toEqual([]);
    }
  });

  it('write sample: B handshake follows both the AW and the WLAST handshakes', () => {
    const { handshakes } = analyzeSource(sample('axi-write').source);
    const lastW = Math.max(...(handshakes.W ?? []));
    expect(handshakes.B?.[0]).toBeGreaterThan(Math.max(handshakes.AW?.[0] ?? 0, lastW));
  });

  it('debug sample 1: dropping AWVALID before AWREADY violates A3.2.1 at the drop edge', () => {
    const { violations } = analyzeSource(sample('axi-bug-dropped-valid').source);
    expect(violations).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'valid-held', channel: 'AW', edge: 3, clause: expect.stringMatching(/A3\.2\.1/) })]));
  });

  it('debug sample 2: BVALID before the WLAST handshake violates A3.3.1', () => {
    const { violations } = analyzeSource(sample('axi-bug-early-bvalid').source);
    expect(violations).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'b-after-aw-and-wlast', channel: 'B' })]));
  });

  it('fixing only AWVALID is not enough: AWADDR must also stay stable while waiting (A3.2.1)', () => {
    const validOnly = JSON.parse(JSON.stringify(sample('axi-bug-dropped-valid').source).replace('"01.01.0"', '"01...10"'));
    expect(analyzeSource(validOnly).violations.map((v) => v.rule)).toEqual(['payload-stable', 'payload-stable']);
    const fixed = JSON.parse(JSON.stringify(validOnly).replace('"x=.x=.x"', '"x=....x"'));
    expect(analyzeSource(fixed).violations).toEqual([]);
  });

  it('AHB samples are rendered but not run through the AXI checker', () => {
    for (const id of ['ahb-pipeline', 'ahb-wait', 'ahb-error']) {
      const analysis = analyzeSource(sample(id).source);
      expect(analysis.axiChecked, id).toBe(false);
      expect(analysis.violations).toEqual([]);
    }
  });
});
