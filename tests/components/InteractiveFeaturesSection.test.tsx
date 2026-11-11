import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { placementQuestions } from '@/components/assessment/placementQuizData';
import { getLandingFacts } from '@/components/home/home-stats';
import InteractiveFeaturesSection, { practiseItems } from '@/components/home/InteractiveFeaturesSection';
import { buildPractiseThumbnails } from '@/components/home/practise-thumbnails';
import { buildSchedulerFrame } from '@/components/home/scheduler-frame';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { siteLabel } from '@/lib/nav-labels';
import { getPracticeLabItems, getPracticePages } from '@/lib/practice-links';
import { INTERVIEW_PREP_HREF, LABS_HREF, PRACTICE_SECTION_HREF } from '@/lib/site-links';
import { appRouteExists } from '../fixtures/site-routes';

const facts = getLandingFacts({
  curriculum: curriculumData,
  labs: getAllLabs(),
  practicePages: getPracticePages(),
  interviewBanks: loadInterviewBanks(),
  placementQuestions,
});

const thumbnails = buildPractiseThumbnails({
  labItems: getPracticeLabItems(getAllLabs()),
  labs: getAllLabs(),
  interviewBanks: loadInterviewBanks(),
  frame: buildSchedulerFrame(),
  sorterCode: 'I-UVM-1C',
  modelCode: 'F3C',
});

afterEach(() => {
  cleanup();
});

describe('"What you can practise" (landing phase 4)', () => {
  it('shows four cards, each linked by the destination label and href from site-links.ts', () => {
    render(<InteractiveFeaturesSection facts={facts} />);
    const section = screen.getByRole('region', { name: 'What you can practise' });
    const hrefs = [LABS_HREF, PRACTICE_SECTION_HREF.exercises, PRACTICE_SECTION_HREF.interactiveModels, INTERVIEW_PREP_HREF];
    const links = within(section).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual(hrefs.map((href) => [siteLabel(href), href]));
    for (const link of links) expect(appRouteExists(link.getAttribute('href') ?? '')).toBe(true);
  });

  it('states the real counts', () => {
    expect(practiseItems(facts).map((item) => [item.count, item.unit])).toEqual([
      [facts.labCount, 'labs'],
      [facts.exerciseCount, 'exercises'],
      [facts.interactiveModelCount, 'models'],
      [facts.interviewQuestionCount, 'questions'],
    ]);
    render(<InteractiveFeaturesSection facts={facts} />);
    // A small mono meta per card, not a headline figure, and the unit never repeats the card's heading.
    const metas = screen.getAllByTestId('practise-count');
    expect(metas.map((meta) => meta.textContent)).toEqual(practiseItems(facts).map((item) => `${item.count} ${item.unit}`));
    metas.forEach((meta) => expect(meta).toHaveClass('font-mono', 'text-label'));
    expect(document.querySelectorAll('li .text-h2')).toHaveLength(0);
    expect(screen.getByText(`${facts.interviewBankCount} banks of questions from junior to senior staff level, each with a model answer.`)).toBeInTheDocument();
  });

  it('renders visible in the server HTML, with no icons or entrance animation', () => {
    const html = renderToStaticMarkup(<InteractiveFeaturesSection facts={facts} thumbnails={thumbnails} />);
    expect(html).not.toMatch(/opacity:\s*0/);
    expect(html).not.toMatch(/<img/);
    expect(html).toContain('What you can practise');
  });

  it('draws one thumbnail per card, first in the card, hidden from assistive technology', () => {
    render(<InteractiveFeaturesSection facts={facts} thumbnails={thumbnails} />);
    const cards = within(screen.getByRole('region', { name: 'What you can practise' })).getAllByRole('listitem').filter((item) => item.hasAttribute('data-card'));
    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.firstElementChild?.getAttribute('data-thumbnail'))).toEqual(['labs', 'exercises', 'interactiveModels', 'interviewPrep']);
    for (const card of cards) {
      const drawing = card.firstElementChild as HTMLElement;
      expect(drawing).toHaveAttribute('aria-hidden', 'true');
      // Every drawing frame is the same height, so the four cards' text starts on one line.
      expect(drawing).toHaveClass('h-28');
      // The card is still named by its one link alone.
      expect(within(card).getAllByRole('link')).toHaveLength(1);
    }
  });

  it('draws from the product\'s data: the lab\'s steps, the sorter\'s phases, the model\'s signals and the questions\' levels', () => {
    render(<InteractiveFeaturesSection facts={facts} thumbnails={thumbnails} />);
    const labs = document.querySelector('[data-thumbnail="labs"]') as HTMLElement;
    // The lab's code and step count stand in for its long title; the step titles are cut to whole words.
    expect(labs).toHaveTextContent(`${thumbnails.labs!.stepCount} steps`);
    for (const step of thumbnails.labs!.steps) expect(labs).toHaveTextContent(step.title);
    const sorter = document.querySelector('[data-thumbnail="exercises"]') as HTMLElement;
    expect([...sorter.querySelectorAll('[data-lane="common"] li')].map((li) => li.textContent)).toEqual(['build↓', 'connect↑', 'run']);
    expect([...sorter.querySelectorAll('[data-lane="schedule"] li')].map((li) => li.textContent)).toEqual(['reset', 'configure', 'main']);
    const wave = document.querySelector('[data-thumbnail="interactiveModels"]') as HTMLElement;
    expect(wave.querySelectorAll('path')).toHaveLength(thumbnails.interactiveModels.signals.length);
    const questions = document.querySelector('[data-thumbnail="interviewPrep"]') as HTMLElement;
    expect([...questions.querySelectorAll('[data-level]')].map((row) => row.getAttribute('data-level'))).toEqual(thumbnails.interviewPrep!.rows.map((row) => row.level));
    // Tier colour from the module code of the lesson that teaches each item (never the code's prefix).
    expect(sorter.firstElementChild).toHaveAttribute('data-tier', '2');
  });

  it('leaves the thumbnails out when none are passed', () => {
    const html = renderToStaticMarkup(<InteractiveFeaturesSection facts={facts} />);
    expect(html).not.toContain('data-thumbnail');
  });
});
