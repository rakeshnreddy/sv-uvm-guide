import { regionGuideById, type RegionGuideEntry } from '@/components/visuals/scheduler/region-guide';
import { codeLinesFor } from '@/components/visuals/scheduler/scheduler-view-helpers';
import type { OwnerKind } from '@/components/visual-system/visual-language';
import { REGION_LABELS, REGION_ORDER, simulateTimeSlot, slotTimeLabel, type RegionId, type SvValue, type TraceStep } from '@/lib/sv-scheduler-model';
import { getTracePreset, type TraceScenarioId } from '@/lib/sv-scheduler-scenarios';

/**
 * One frame of the scheduler model for the landing hero, computed from the
 * same scenario data and the same simulation the live TimeSlotTraceVisualizer
 * runs (src/lib/sv-scheduler-model.ts, src/lib/sv-scheduler-scenarios.ts), so
 * the code, the region ladder and the waveform cannot disagree with the
 * interactive. Pure: the hero renders it on the server as static markup.
 */

/** The scenario the frame shows: the two-stage shift register written with <=. */
export const HERO_SCENARIO_ID: TraceScenarioId = 'shift-nba';

/** The statement the frame stops on: Stage B's `q2 <= q1`, read in Active while both writes wait in NBA. */
export const HERO_STATEMENT_ID = 'b1';

/**
 * The lesson that holds the live TimeSlotTraceVisualizer with this scenario, at
 * the heading above it. The visualizer opens on another scenario (the racing
 * blocking version) and reads no query parameter, so the caption tells the
 * learner which scenario button to choose (SchedulerFrame.scenarioLabel).
 */
export const LIVE_MODEL_HREF = '/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index#watch-one-clock-edge-step-by-step';

/** How the ladder groups the nine regions (IEEE 1800-2023 §4.4, §4.5): read-only ends around the two iterative sets. */
export type RegionGroupId = 'preponed' | 'activeSet' | 'reactiveSet' | 'postponed';

export interface FrameRegion {
  id: RegionId;
  label: string;
  family: RegionGuideEntry['family'];
  /** Events queued in the region at this step. */
  queued: string[];
  /** The region whose events execute at this step. */
  executing: boolean;
}

export interface FrameRegionGroup {
  id: RegionGroupId;
  regions: FrameRegion[];
}

export interface FrameCodeLine {
  /** 1-based, as the live code panel numbers them. */
  number: number;
  text: string;
  owner?: OwnerKind;
  current: boolean;
}

export interface FrameSignal {
  name: string;
  /** One value per scheduler step, step 1 first. */
  values: SvValue[];
}

export interface SchedulerFrame {
  title: string;
  /** The scenario's button label in the live visualizer ("Shift register · <="), for the caption's hint. */
  scenarioLabel: string;
  timeLabel: string;
  /** 0-based index of the frame's step in the run. */
  stepIndex: number;
  stepCount: number;
  /** The model's own narration of the step. */
  narration: string;
  groups: FrameRegionGroup[];
  executingRegion: RegionId;
  code: FrameCodeLine[];
  signals: FrameSignal[];
  /** Values after this step, in watch order. */
  values: { name: string; value: SvValue; changed: boolean }[];
}

/** The region the ladder marks for a step, as the live visualizer marks it. */
export function executingRegionOf(step: Pick<TraceStep, 'kind' | 'region'>): RegionId {
  if (step.kind === 'slot-start') return 'preponed';
  if (step.kind === 'slot-end') return 'postponed';
  return step.region;
}

const GROUP_OF: Record<RegionId, RegionGroupId> = {
  preponed: 'preponed',
  active: 'activeSet',
  inactive: 'activeSet',
  nba: 'activeSet',
  observed: 'activeSet',
  reactive: 'reactiveSet',
  reInactive: 'reactiveSet',
  reNba: 'reactiveSet',
  postponed: 'postponed',
};

export function buildSchedulerFrame(scenarioId: TraceScenarioId = HERO_SCENARIO_ID, statementId: string = HERO_STATEMENT_ID): SchedulerFrame {
  const preset = getTracePreset(scenarioId);
  const scenario = preset.build();
  const run = simulateTimeSlot(scenario);
  const stepIndex = run.trace.findIndex((step) => step.kind === 'statement' && step.stmtId === statementId);
  if (stepIndex < 0) throw new Error(`Scenario ${scenarioId} never executes statement ${statementId}`);
  const step = run.trace[stepIndex];
  const executingRegion = executingRegionOf(step);

  const groups: FrameRegionGroup[] = [];
  for (const id of REGION_ORDER) {
    const groupId = GROUP_OF[id];
    let group = groups[groups.length - 1];
    if (!group || group.id !== groupId) {
      group = { id: groupId, regions: [] };
      groups.push(group);
    }
    group.regions.push({
      id,
      label: REGION_LABELS[id],
      family: regionGuideById[id].family,
      queued: step.queues[id].map((item) => item.label),
      executing: id === executingRegion,
    });
  }

  const code = codeLinesFor(scenario).map((line, index) => ({
    number: index + 1,
    text: line.text,
    owner: line.owner,
    current: Boolean(line.key) && line.key === step.stmtId,
  }));

  return {
    title: scenario.title,
    scenarioLabel: preset.label,
    timeLabel: slotTimeLabel(scenario),
    stepIndex,
    stepCount: run.trace.length,
    narration: step.what,
    groups,
    executingRegion,
    code,
    signals: scenario.watch.map((name) => ({ name, values: run.trace.map((s) => s.values[name]) })),
    values: scenario.watch.map((name) => ({ name, value: step.values[name], changed: step.changed.includes(name) })),
  };
}
