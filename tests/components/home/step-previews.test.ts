import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { buildSchedulerFrame } from '@/components/home/scheduler-frame';
import StepPreview, { type StepPreviewKind } from '@/components/home/StepPreview';
import {
  THUMBNAIL_ROWS,
  THUMBNAIL_TITLE_CHARS,
  buildStepPreviews,
  interviewLevelCount,
  labPreview,
  lessonLayers,
  questionPreview,
  readPreview,
  shortTitle,
  stepThroughPreview,
  stepTitle,
} from '@/components/home/step-previews';
import { readLessonBody } from '@/lib/curriculum-scan';
import { getAllLabs } from '@/lib/lab-registry';
import { getPracticeLabItems } from '@/lib/practice-links';

const labs = getAllLabs();
const labItems = getPracticeLabItems(labs);
const banks = loadInterviewBanks();
const frame = buildSchedulerFrame();
const lessonOne = readLessonBody('T1_Foundational', 'F1A_The_Cost_of_Bugs', 'index');

describe('step previews (drawn from the product data)', () => {
  it('reads lesson 1\'s four layers from its own headings, each with its share of the text', () => {
    const read = readPreview('F1A', lessonOne)!;
    expect(read.layers.map((layer) => layer.name)).toEqual(['Quick Take', 'Build Your Mental Model', 'Make It Work', 'Push Further']);
    expect(Math.max(...read.layers.map((layer) => layer.share))).toBe(1);
    read.layers.forEach((layer) => expect(layer.share).toBeGreaterThan(0));
    expect(lessonLayers('## A\nxx\n## B\nxxxx\n').map((layer) => layer.name)).toEqual(['A', 'B']);
    expect(readPreview('F1A', '## Only one\ntext')).toBeNull();
    expect(readPreview('F1A', null)).toBeNull();
  });

  it('reduces the scheduler frame to the first region, the executing one and those with events queued', () => {
    const preview = stepThroughPreview('F3C', frame);
    expect(preview.regions.map((region) => [region.id, region.executing, region.queued])).toEqual([
      ['preponed', false, 0],
      ['active', true, 0],
      ['nba', false, 2],
    ]);
    expect(preview.line).toBe('q2 <= q1;');
    expect(frame.narration).toBe('q2 <= q1; reads q1 = 0 now, but defers the write.');
    expect(preview.narration).toBe('Reads q1 = 0 now, but defers the write.');
  });

  it('takes the first lab a learner can open, in course order, with its first steps as the lab lists them', () => {
    const thumb = labPreview(labItems, labs)!;
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

  it('shows the shortest question at the lowest level, and counts the levels across the banks', () => {
    const preview = questionPreview(banks)!;
    const lowest = banks[0].levels[0];
    const prompts = banks.flatMap((bank) => bank.levels.filter((group) => group.level === lowest.level).flatMap((group) => group.questions.map((q) => q.prompt)));
    expect(preview.levelLabel).toBe(lowest.label);
    expect(preview.prompt).toBe([...prompts].sort((a, b) => a.length - b.length)[0]);
    expect(questionPreview([])).toBeNull();
    expect(interviewLevelCount(banks)).toBe(new Set(banks.flatMap((bank) => bank.levels.map((level) => level.level))).size);
  });
});

describe('step previews (the drawings)', () => {
  const previews = buildStepPreviews({ firstLesson: { code: 'F1A', body: lessonOne }, modelCode: 'F3C', frame, labItems, labs, interviewBanks: banks });
  const draw = (kind: StepPreviewKind) =>
    new DOMParser().parseFromString(renderToStaticMarkup(createElement(StepPreview, { kind, previews })), 'text/html').body;

  it.each(['read', 'stepThrough', 'build', 'rehearse'] as const)('%s: hidden from assistive technology, with no ellipsis truncation', (kind) => {
    const body = draw(kind);
    expect(body.querySelector('[data-preview][aria-hidden="true"]')).not.toBeNull();
    expect(body.querySelector('.truncate, .text-ellipsis, [class*="line-clamp"]')).toBeNull();
  });

  it('labels the lab by its code and step count, not its long title', () => {
    const body = draw('build');
    expect(body.textContent).toContain(`${previews.build!.stepCount} steps`);
    expect(body.textContent).not.toContain(previews.build!.title);
  });

  it('marks the executing region in the scheduler preview', () => {
    const body = draw('stepThrough');
    expect(Array.from(body.querySelectorAll('[data-executing]')).map((el) => el.getAttribute('data-region'))).toEqual(['active']);
    expect(body.textContent).toContain('q2 <= q1;');
    expect(body.textContent).not.toContain('always @');
  });

  it('draws nothing when the data is missing', () => {
    const empty = { ...previews, read: null, build: null, rehearse: null };
    for (const kind of ['read', 'build', 'rehearse'] as const) {
      expect(renderToStaticMarkup(createElement(StepPreview, { kind, previews: empty }))).toBe('');
    }
  });
});
