import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { placementQuestions } from '@/components/assessment/placementQuizData';
import { getLandingFacts } from '@/components/home/home-stats';
import InteractiveFeaturesSection, { practiseItems } from '@/components/home/InteractiveFeaturesSection';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { siteLabel } from '@/lib/nav-labels';
import { getPracticePages } from '@/lib/practice-links';
import { INTERVIEW_PREP_HREF, LABS_HREF, PRACTICE_SECTION_HREF } from '@/lib/site-links';
import { appRouteExists } from '../fixtures/site-routes';

const facts = getLandingFacts({
  curriculum: curriculumData,
  labs: getAllLabs(),
  practicePages: getPracticePages(),
  interviewBanks: loadInterviewBanks(),
  placementQuestions,
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

  it('renders visible in the server HTML, with no thumbnails, icons or entrance animation', () => {
    const html = renderToStaticMarkup(<InteractiveFeaturesSection facts={facts} />);
    expect(html).not.toMatch(/opacity:\s*0/);
    expect(html).not.toMatch(/<svg|<img/);
    expect(html).toContain('What you can practise');
  });
});
