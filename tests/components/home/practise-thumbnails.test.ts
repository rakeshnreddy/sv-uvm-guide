import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import {
  THUMBNAIL_ROWS,
  THUMBNAIL_TITLE_CHARS,
  buildPractiseThumbnails,
  labThumbnail,
  questionThumbnail,
  shortTitle,
  sorterThumbnail,
  stepTitle,
} from '@/components/home/practise-thumbnails';
import PractiseThumbnail, { questionBarWidth, type PractiseThumbnailKind } from '@/components/home/PractiseThumbnail';
import { buildSchedulerFrame } from '@/components/home/scheduler-frame';
import { getAllLabs } from '@/lib/lab-registry';
import { getPracticeLabItems, requirePracticePage } from '@/lib/practice-links';
import { COMMON_PHASES, RUNTIME_PHASES, phaseOrder } from '@/lib/uvm-phase-model';

const labs = getAllLabs();
const labItems = getPracticeLabItems(labs);
const banks = loadInterviewBanks();
const frame = buildSchedulerFrame();

describe('practise thumbnails (drawn from the product data)', () => {
  it('takes the first lab a learner can open, in course order, with its first steps as the lab lists them', () => {
    const thumb = labThumbnail(labItems, labs)!;
    const firstAvailable = labItems.map((item) => labs.find((lab) => `lab:${lab.id}` === item.id)!).find((lab) => lab.status === 'available')!;
    expect(thumb.title).toBe(firstAvailable.title);
    expect(thumb.code).toBe(labItems.find((item) => item.id === `lab:${firstAvailable.id}`)!.lessons[0].code);
    expect(thumb.stepCount).toBe(firstAvailable.steps.length);
    expect(thumb.steps).toEqual(
      firstAvailable.steps.slice(0, THUMBNAIL_ROWS).map((step, index) => ({ number: index + 1, title: shortTitle(stepTitle(step.title)) })),
    );
    for (const step of thumb.steps) expect(step.title.length).toBeLessThanOrEqual(THUMBNAIL_TITLE_CHARS);
  });

  it('cuts a title to whole words that fit, without an ellipsis or a trailing small word', () => {
    expect(shortTitle('Read the specification and run the starter')).toBe('Read the specification');
    expect(shortTitle('Write the types')).toBe('Write the types');
    expect(shortTitle('Run the starter and record the counts')).toBe('Run the starter');
    expect(shortTitle('Predict, then write R1 and R2')).toBe('Predict, then write R1');
    expect(shortTitle('Supercalifragilisticexpialidocious words')).toBe('Supercalifragilisticexpialidocious');
    expect(shortTitle('One two three', 7)).toBe('One two');
  });

  it('drops only a leading "Step N:" from a step title', () => {
    expect(stepTitle('Step 1: Reproduce the Split Bug')).toBe('Reproduce the Split Bug');
    expect(stepTitle('step 12 - Wire it')).toBe('Wire it');
    expect(stepTitle('The reference model')).toBe('The reference model');
  });

  it('draws the sorter\'s two lanes from the phase model, in schedule order, with each phase\'s direction', () => {
    const thumb = sorterThumbnail('I-UVM-1C');
    expect(thumb.lanes.map((lane) => lane.id)).toEqual(['common', 'schedule']);
    // One-word phases only, so no name is cut: build, connect, run and reset, configure, main.
    expect(thumb.lanes[0].phases.map((phase) => phase.name)).toEqual(['build', 'connect', 'run']);
    expect(thumb.lanes[1].phases.map((phase) => phase.name)).toEqual(['reset', 'configure', 'main']);
    for (const phase of thumb.lanes[0].phases) expect(phase.order).toBe(phaseOrder(COMMON_PHASES.find((entry) => entry.name === phase.name)!));
    for (const phase of thumb.lanes[1].phases) {
      expect(RUNTIME_PHASES.some((entry) => entry.name === phase.name)).toBe(true);
      expect(phase.order).toBe('parallel');
    }
  });

  it('shows the lowest and the highest level of the first interview bank', () => {
    const thumb = questionThumbnail(banks)!;
    const levels = banks[0].levels;
    expect(thumb.rows.map((row) => row.level)).toEqual([levels[0].level, levels[levels.length - 1].level]);
    expect(thumb.rows[0].prompt).toBe(levels[0].questions[0].prompt);
    expect(thumb.rows[0].code).toBe(levels[0].questions[0].lessons[0]?.code ?? null);
    expect(questionThumbnail([])).toBeNull();
  });

  it('uses the hero\'s run of the scheduler model for the waveform, and the teaching lessons\' codes for the tiers', () => {
    const sorterCode = requirePracticePage('/exercises/uvm-phase-sorter').lessons[0].code;
    const thumbs = buildPractiseThumbnails({ labItems, labs, interviewBanks: banks, frame, sorterCode, modelCode: 'F3C' });
    expect(thumbs.interactiveModels).toEqual({ code: 'F3C', signals: frame.signals, cursor: frame.stepIndex });
    expect(thumbs.exercises.code).toBe(sorterCode);
    expect(sorterCode).toBe('I-UVM-1C');
  });
});

describe('practise thumbnails (the drawings)', () => {
  const thumbs = buildPractiseThumbnails({ labItems, labs, interviewBanks: banks, frame, sorterCode: 'I-UVM-1C', modelCode: 'F3C' });
  const draw = (kind: PractiseThumbnailKind) =>
    new DOMParser().parseFromString(renderToStaticMarkup(createElement(PractiseThumbnail, { kind, thumbnails: thumbs })), 'text/html').body;

  it.each(['labs', 'exercises', 'interactiveModels', 'interviewPrep'] as const)('%s: no ellipsis truncation anywhere', (kind) => {
    const body = draw(kind);
    expect(body.querySelector('[data-thumbnail]')).not.toBeNull();
    expect(body.querySelector('.truncate, .text-ellipsis, [class*="line-clamp"]')).toBeNull();
  });

  it('labels the lab by its code and step count, not its long title', () => {
    const body = draw('labs');
    expect(body.textContent).toContain(`${thumbs.labs!.stepCount} steps`);
    expect(body.textContent).not.toContain(thumbs.labs!.title);
  });

  it('draws each interview question as its level and a bar, without the prompt text', () => {
    const body = draw('interviewPrep');
    for (const row of thumbs.interviewPrep!.rows) {
      expect(body.textContent).toContain(row.levelLabel);
      expect(body.textContent).not.toContain(row.prompt.slice(0, 20));
    }
    expect(questionBarWidth('')).toBe(45);
    expect(questionBarWidth('x'.repeat(500))).toBe(100);
  });
});
