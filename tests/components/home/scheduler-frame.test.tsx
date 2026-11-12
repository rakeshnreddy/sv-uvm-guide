import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { HERO_SCENARIO_ID, LIVE_MODEL_HREF, buildSchedulerFrame, executingRegionOf } from '@/components/home/scheduler-frame';
import { codeLinesFor } from '@/components/visuals/scheduler/scheduler-view-helpers';
import { createSlugger } from '@/lib/heading-slug';
import { REGION_LABELS, REGION_ORDER, simulateTimeSlot } from '@/lib/sv-scheduler-model';
import { getTracePreset } from '@/lib/sv-scheduler-scenarios';
import { appRouteExists, repoRoot } from '../../fixtures/site-routes';

const frame = buildSchedulerFrame();
const scenario = getTracePreset(HERO_SCENARIO_ID).build();
const run = simulateTimeSlot(scenario);

describe('the "Step through" frame data (one step of the live model)', () => {
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
