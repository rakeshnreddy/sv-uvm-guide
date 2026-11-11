import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SchedulerFrame, { bitTracePath } from '@/components/home/SchedulerFrame';
import { HERO_SCENARIO_ID, LIVE_MODEL_HREF, buildSchedulerFrame, executingRegionOf } from '@/components/home/scheduler-frame';
import { codeLinesFor } from '@/components/visuals/scheduler/scheduler-view-helpers';
import { createSlugger } from '@/lib/heading-slug';
import { REGION_LABELS, REGION_ORDER, simulateTimeSlot } from '@/lib/sv-scheduler-model';
import { getTracePreset } from '@/lib/sv-scheduler-scenarios';
import { appRouteExists, repoRoot } from '../../fixtures/site-routes';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

const frame = buildSchedulerFrame();
const scenario = getTracePreset(HERO_SCENARIO_ID).build();
const run = simulateTimeSlot(scenario);

describe('the hero frame data (one step of the live model)', () => {
  it('stops on Stage B reading q1 in Active while both nonblocking writes wait in NBA', () => {
    const step = run.trace[frame.stepIndex];
    expect(step.kind).toBe('statement');
    expect(step.stmtId).toBe('b1');
    expect(frame.executingRegion).toBe('active');
    expect(frame.narration).toBe(step.what);
    expect(frame.narration).toMatch(/q2 <= q1; reads q1 = 0/);
    expect(frame.stepCount).toBe(run.trace.length);
    const nba = frame.groups.flatMap((group) => group.regions).find((region) => region.id === 'nba');
    expect(nba?.queued).toEqual(['q1 ← 1', 'q2 ← 0']);
  });

  it('keeps the nine regions in the model order, grouped into the read-only ends and the two iterative sets', () => {
    const regions = frame.groups.flatMap((group) => group.regions);
    expect(regions.map((region) => region.id)).toEqual(REGION_ORDER);
    expect(regions.map((region) => region.label)).toEqual(REGION_ORDER.map((id) => REGION_LABELS[id]));
    expect(frame.groups.map((group) => [group.id, group.regions.map((region) => region.id)])).toEqual([
      ['preponed', ['preponed']],
      ['activeSet', ['active', 'inactive', 'nba', 'observed']],
      ['reactiveSet', ['reactive', 'reInactive', 'reNba']],
      ['postponed', ['postponed']],
    ]);
    expect(regions.filter((region) => region.executing).map((region) => region.id)).toEqual(['active']);
  });

  it('shows the code the model generates, with the executing statement as the current line', () => {
    expect(frame.code.map((line) => line.text)).toEqual(codeLinesFor(scenario).map((line) => line.text));
    expect(frame.code.filter((line) => line.current).map((line) => line.text)).toEqual(['always @(posedge clk) q2 <= q1;']);
  });

  it('draws a waveform that agrees with the run: clk rises first, q1 only after the NBA update, q2 stays 0', () => {
    const wave = Object.fromEntries(frame.signals.map((signal) => [signal.name, signal.values]));
    expect(Object.keys(wave)).toEqual(scenario.watch);
    expect(wave.clk).toEqual(run.trace.map((step) => step.values.clk));
    expect(wave.q1[frame.stepIndex]).toBe(0);
    expect(wave.q1[wave.q1.length - 1]).toBe(1);
    expect(new Set(wave.q2)).toEqual(new Set([0]));
    expect(frame.values).toEqual(scenario.watch.map((name) => ({ name, value: run.trace[frame.stepIndex].values[name], changed: false })));
  });

  it('marks Preponed and Postponed for the slot start and end, as the live ladder does', () => {
    expect(executingRegionOf({ kind: 'slot-start', region: 'active' })).toBe('preponed');
    expect(executingRegionOf({ kind: 'slot-end', region: 'active' })).toBe('postponed');
    expect(executingRegionOf({ kind: 'statement', region: 'reactive' })).toBe('reactive');
  });

  it('throws for a statement the scenario never runs', () => {
    expect(() => buildSchedulerFrame('shift-nba', 'nope')).toThrow(/never executes/);
  });

  it('links the live model in a lesson that holds the visualizer with this scenario, at the heading above it', () => {
    expect(appRouteExists(LIVE_MODEL_HREF)).toBe(true);
    const [route, anchor] = LIVE_MODEL_HREF.split('#');
    const file = path.join(repoRoot, 'content', route.replace(/^\//, '').replace(/\/index$/, '/index.mdx'));
    const source = fs.readFileSync(file, 'utf8');
    const slug = createSlugger();
    const headings = [...source.matchAll(/^#{2,4} (.+)$/gm)].map((match) => slug(match[1]));
    expect(headings).toContain(anchor);
    const afterHeading = source.slice(source.indexOf('### Watch one clock edge, step by step'));
    const visualizer = /<TimeSlotTraceVisualizer[^>]*\/>/.exec(afterHeading)?.[0] ?? '';
    expect(visualizer).toContain(`"${HERO_SCENARIO_ID}"`);
  });
});

describe('bitTracePath', () => {
  it('draws a level per step and a vertical edge where the value changes', () => {
    expect(bitTracePath([0, 1, 1])).toBe('M0,20 L10,20 M10,20 L10,6 M10,6 L20,6 M20,6 L30,6');
  });

  it('leaves X steps to the hatch and draws no edge into or out of them', () => {
    expect(bitTracePath(['X', 1])).toBe('M10,6 L20,6');
  });

  it('keeps a gap between one row\'s low level and the next row\'s high level', () => {
    // Row 0 low is at 20; row 1 high is at 28 + 6 = 34.
    expect(bitTracePath([0])).toBe('M0,20 L10,20');
    expect(bitTracePath([1], 28)).toBe('M0,34 L10,34');
  });
});

describe('<SchedulerFrame>', () => {
  it('is the one real-glass card, with the code on the solid code surface', () => {
    const { container } = render(<SchedulerFrame frame={frame} />);
    expect(container.querySelectorAll('.glass')).toHaveLength(1);
    expect(screen.getByTestId('home-hero-card')).toHaveClass('glass');
    const code = container.querySelector('[data-frame-part="code"]');
    expect(code).toHaveClass('bg-code-surface');
    expect(code?.closest('.glass')).toBe(screen.getByTestId('home-hero-card'));
  });

  it('marks the executing region and the current line for assistive technology', () => {
    render(<SchedulerFrame frame={frame} />);
    const current = screen.getAllByRole('listitem').filter((item) => item.getAttribute('aria-current') === 'step');
    expect(current.map((item) => item.textContent)).toEqual([expect.stringContaining('Executing: always @(posedge clk) q2 <= q1;'), '▶Activeexecuting']);
    expect(within(screen.getByRole('list', { name: 'Code under simulation' })).getByText(/Executing:/)).toBeInTheDocument();
  });

  it('has the caption, the link to the live model and the scenario to choose there', () => {
    const { container } = render(<SchedulerFrame frame={frame} />);
    expect(screen.getByRole('figure', { name: 'One time slot, region by region' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the live model' })).toHaveAttribute('href', LIVE_MODEL_HREF);
    expect(frame.scenarioLabel).toBe(getTracePreset(HERO_SCENARIO_ID).label);
    expect(screen.getByTestId('hero-frame').lastElementChild).toHaveTextContent(`Open the live model, then choose ${frame.scenarioLabel}`);
  });

  it('separates the waveform rows with a hairline', () => {
    const { container } = render(<SchedulerFrame frame={frame} />);
    expect(container.querySelectorAll('[data-frame-part="waveform"] line.stroke-border')).toHaveLength(frame.signals.length - 1);
  });

  it('hides the waveform and values on phones: ladder and code only', () => {
    const { container } = render(<SchedulerFrame frame={frame} />);
    expect(container.querySelector('[data-frame-part="state"]')).toHaveClass('hidden', 'sm:flex');
    expect(container.querySelector('[data-frame-part="state"] [data-frame-part="waveform"]')).not.toBeNull();
    expect(container.querySelector('[data-frame-part="ladder"]')).not.toHaveClass('hidden');
  });

  it('renders as static markup with no script, no animation and nothing below 12 px', () => {
    const html = renderToStaticMarkup(<SchedulerFrame frame={frame} />);
    expect(html).not.toMatch(/animate-|transition|<script/);
    expect(html).not.toMatch(/text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/);
  });
});
