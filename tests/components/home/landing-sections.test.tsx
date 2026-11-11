import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { placementQuestions } from '@/components/assessment/placementQuizData';
import HeroPrimaryAction from '@/components/home/HeroPrimaryAction';
import HeroSection, { HERO_HEADLINE } from '@/components/home/HeroSection';
import { MAIN_STANDARDS, getHomeStats, getLandingFacts, heroParagraph, landingDescription, plural } from '@/components/home/home-stats';
import type { LandingLesson } from '@/components/home/landing-resume';
import ProofStrip, { proofFacts } from '@/components/home/ProofStrip';
import ReturningLearnerStrip, { continueNote, tierOfLesson } from '@/components/home/ReturningLearnerStrip';
import RoutesStrip from '@/components/home/RoutesStrip';
import { buildSchedulerFrame } from '@/components/home/scheduler-frame';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { buildCurriculumTotals } from '@/lib/learner-stats';
import { FLASHCARDS_KEY, LESSONS_KEY } from '@/lib/learner-store/keys';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import { EXPERT_INDEX_HREF, LEARNING_ROUTES, PLACEMENT_QUIZ_HREF, resolveRoutes, summarizeRoutes } from '@/lib/learning-paths';
import { allLessons, getPracticePages } from '@/lib/practice-links';
import { REVIEW_HREF, START_HERE_HREF } from '@/lib/site-links';
import { appRouteExists, repoRoot } from '../../fixtures/site-routes';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };
  const MockLink = ReactModule.forwardRef<HTMLAnchorElement, LinkProps>(({ href, children, prefetch: _prefetch, ...rest }, ref) => (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  ));
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

const F1A = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const F3C = '/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index';
const labs = getAllLabs();
const routes = summarizeRoutes(resolveRoutes(curriculumData, { labs }));
const facts = getLandingFacts({
  curriculum: curriculumData,
  labs,
  practicePages: getPracticePages(),
  interviewBanks: loadInterviewBanks(),
  placementQuestions,
});
const lessons: LandingLesson[] = allLessons().map(({ href, code, title }) => ({ href, code, title }));
const frame = buildSchedulerFrame();

function resetStore() {
  window.localStorage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
}

beforeEach(resetStore);
afterEach(() => {
  cleanup();
  resetStore();
});

describe('landing facts (every number from the data)', () => {
  it('count lessons, tiers and labs as the curriculum and the lab registry hold them', () => {
    const lessonTotal = curriculumData.reduce((sum, tier) => sum + tier.sections.reduce((n, section) => n + section.topics.length, 0), 0);
    expect(getHomeStats(curriculumData, labs)).toEqual({
      lessonCount: lessonTotal,
      tierCount: new Set(curriculumData.map((tier) => tier.tier)).size,
      labCount: labs.length,
    });
    expect(facts.lessonCount).toBe(allLessons().length);
  });

  it('count the practice hub, the interview banks and the placement quiz from their own data', () => {
    const pages = getPracticePages();
    expect(facts.interactiveModelCount).toBe(pages.filter((page) => page.kind === 'interactive').length);
    expect(facts.exerciseCount).toBe(pages.filter((page) => page.kind === 'exercise').length);
    const bankDir = path.join(repoRoot, 'content', 'interview-questions');
    const bankFiles = fs.readdirSync(bankDir).filter((file) => file.endsWith('.json'));
    expect(facts.interviewBankCount).toBe(bankFiles.length);
    expect(facts.interviewQuestionCount).toBe(
      bankFiles.reduce((sum, file) => sum + JSON.parse(fs.readFileSync(path.join(bankDir, file), 'utf8')).questions.length, 0),
    );
    expect(facts.placementQuestionCount).toBe(placementQuestions.length);
    expect(facts.standards).toBe(MAIN_STANDARDS);
    for (const count of [facts.interactiveModelCount, facts.exerciseCount, facts.interviewQuestionCount, facts.placementQuestionCount]) {
      expect(count).toBeGreaterThan(0);
    }
  });

  it('build the hero paragraph and the meta description from the counts', () => {
    expect(heroParagraph({ lessonCount: 112, tierCount: 4, labCount: 30 })).toBe(
      'A free course in SystemVerilog, UVM and AMBA verification: 112 lessons in 4 tiers, with interactive models you step through, 30 guided labs and interview prep. No sign-up. Your progress stays in this browser.',
    );
    const description = landingDescription(facts);
    expect(description).toContain(`${facts.lessonCount} lessons in ${facts.tierCount} tiers`);
    expect(description).toContain(`${facts.interactiveModelCount} interactive models`);
    expect(description).toContain(`${facts.labCount} guided labs`);
    expect(description).toContain(`${facts.interviewQuestionCount} interview questions`);
    expect(description).not.toMatch(/!|mastery|definitive/i);
  });

  it('pluralise', () => {
    expect(plural(1, 'lesson', 'lessons')).toBe('1 lesson');
    expect(plural(47, 'lesson', 'lessons')).toBe('47 lessons');
  });
});

describe('hero', () => {
  const hero = () => render(<HeroSection stats={facts} lessons={lessons} placementQuestionCount={facts.placementQuestionCount} frame={frame} />);

  it('has the one h1 in the display style, the paragraph of counts and no eyebrow', () => {
    hero();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(HERO_HEADLINE);
    expect(h1).toHaveClass('text-display');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(heroParagraph(facts))).toBeInTheDocument();
    expect(document.querySelector('.rounded-full')).toBeNull();
  });

  it('has exactly one filled accent action, "Start lesson 1" to lesson 1, and the secondary "Find your level"', () => {
    hero();
    const filled = Array.from(document.querySelectorAll('a,button')).filter((el) => el.classList.contains('sheen-primary'));
    expect(filled.map((el) => el.textContent)).toEqual(['Start lesson 1']);
    expect(screen.getByTestId('hero-primary-action')).toHaveAttribute('href', F1A);
    expect(lessons[0].href).toBe(F1A);
    const level = screen.getByRole('link', { name: 'Find your level' });
    expect(level).toHaveAttribute('href', PLACEMENT_QUIZ_HREF);
    expect(level).not.toHaveClass('sheen-primary');
    expect(screen.getByText(`Placement quiz: ${placementQuestions.length} questions, suggests where to start`)).toBeInTheDocument();
  });

  it('gives the frame at least half the width from 1024 px, after the actions in reading order', () => {
    const { container } = hero();
    const section = screen.getByTestId('home-hero');
    expect(section).toHaveClass('lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]');
    expect(section.lastElementChild).toBe(screen.getByTestId('hero-frame'));
    expect(container.querySelectorAll('.glass')).toHaveLength(1);
  });
});

describe('hero primary action', () => {
  it('reads "Start lesson 1" in the server HTML, at a fixed width', () => {
    window.localStorage.setItem(LESSONS_KEY, JSON.stringify({ v: 1, data: { lessons: { [F3C]: { firstVisitedAt: 1, lastVisitedAt: 2, visits: 1 } } } }));
    const html = renderToStaticMarkup(<HeroPrimaryAction lessons={lessons} />);
    expect(html).toContain('Start lesson 1');
    expect(html).toContain('sm:w-64');
    expect(html).toContain('data-state="start"');
  });

  it('becomes "Continue <code>" once the browser holds a lesson position, with the full title in its name', () => {
    window.localStorage.setItem(LESSONS_KEY, JSON.stringify({ v: 1, data: { lessons: { [F3C]: { firstVisitedAt: 1, lastVisitedAt: 2, visits: 1 } } } }));
    render(<HeroPrimaryAction lessons={lessons} />);
    const action = screen.getByTestId('hero-primary-action');
    expect(action).toHaveTextContent(/^Continue F3C$/);
    expect(action.querySelector('.font-mono')).toHaveTextContent('F3C');
    expect(action).toHaveAccessibleName(`Continue F3C: ${lessons.find((lesson) => lesson.href === F3C)?.title}`);
    expect(action).toHaveAttribute('href', F3C);
    expect(action).toHaveAttribute('data-state', 'continue');
  });
});

describe('proof strip', () => {
  it('states four facts, each figure in the mono face with tabular figures', () => {
    render(<ProofStrip facts={facts} />);
    const strip = screen.getByRole('region', { name: 'The course in numbers' });
    const figures = within(strip).getAllByRole('definition');
    expect(figures.map((figure) => figure.textContent)).toEqual([facts.lessonCount, facts.interactiveModelCount, facts.labCount].map(String).concat('IEEE 1800'));
    figures.forEach((figure) => expect(figure).toHaveClass('font-mono', 'tabular-nums'));
    expect(proofFacts(facts)[0].label).toContain(`in ${facts.tierCount} tiers`);
  });

  it('names the main standards without claiming a count, and keeps each identifier on one line', () => {
    render(<ProofStrip facts={facts} />);
    expect(proofFacts(facts)[3].label).toBe('Sourced to IEEE 1800-2023, IEEE 1800.2-2020 and the Arm AMBA specifications');
    expect(proofFacts(facts)[3].label).not.toMatch(/\d+ standards/);
    const term = document.querySelector('[data-fact="standards"] dt')!;
    expect(Array.from(term.querySelectorAll('.whitespace-nowrap')).map((span) => span.textContent)).toEqual(['IEEE 1800-2023', 'IEEE 1800.2-2020']);
    expect(term).toHaveTextContent(proofFacts(facts)[3].label);
  });
});

describe('returning-learner strip', () => {
  it('is in the server HTML but hidden, for every visitor', () => {
    const html = renderToStaticMarkup(<ReturningLearnerStrip lessons={lessons} />);
    expect(html).toContain('Pick up where you left off');
    expect(html).toMatch(/class="hidden /);
    expect(html).not.toContain('data-ready');
  });

  it('stays hidden for a first-time visitor', () => {
    render(<ReturningLearnerStrip lessons={lessons} />);
    const strip = screen.getByTestId('returning-learner');
    expect(strip).toHaveClass('!hidden');
    expect(strip).not.toHaveAttribute('data-ready');
  });

  it('shows the lesson to continue and the reviews due when the browser holds progress', () => {
    const now = Date.now();
    window.localStorage.setItem(LESSONS_KEY, JSON.stringify({ v: 1, data: { lessons: { [F3C]: { firstVisitedAt: now - 1000, lastVisitedAt: now - 500, visits: 2 } } } }));
    const card = (dueAt: number) => ({ deckId: 'd1', interval: 1, repetitions: 1, ease: 2.5, dueAt, lastReviewedAt: now - 864e5, lapses: 0, reviews: 1 });
    window.localStorage.setItem(
      FLASHCARDS_KEY,
      JSON.stringify({
        v: 1,
        data: {
          cards: { a: card(now - 1000), b: card(now - 1000), c: card(now + 9 * 864e5) },
          decks: { d1: { lessons: [], cardIds: ['a', 'b', 'c'], firstSeenAt: now - 864e5, lastSeenAt: now } },
          positions: {},
        },
      }),
    );
    render(<ReturningLearnerStrip lessons={lessons} />);
    const strip = screen.getByTestId('returning-learner');
    expect(strip).toHaveAttribute('data-ready', '');
    expect(strip).not.toHaveClass('!hidden');
    expect(within(strip).getByRole('heading', { level: 2, name: 'Pick up where you left off' })).toBeInTheDocument();
    expect(screen.getByTestId('returning-continue')).toHaveAttribute('href', F3C);
    expect(screen.getByTestId('returning-due')).toHaveTextContent('2');
    expect(within(strip).getByRole('link', { name: 'Open the review queue' })).toHaveAttribute('href', REVIEW_HREF);
  });

  it('says why the lesson is the one to continue', () => {
    const f3c = lessons.find((lesson) => lesson.href === F3C)!;
    const next = lessons[lessons.indexOf(f3c) + 1];
    expect(continueNote(f3c, f3c, 'last-opened', null)).toBe('Last opened');
    expect(continueNote(f3c, f3c, 'last-opened', Date.UTC(2026, 10, 11, 12))).toMatch(/^Last opened on .*2026$/);
    expect(continueNote(next, f3c, 'next-after-done', null)).toBe('Next after F3C, which you marked done');
    expect(continueNote(null, null, null, null)).toBe('Your saved lesson has moved. Start from lesson 1');
  });

  it('shows the miniature trace for the tier of the lesson to continue, on one reserved line', () => {
    const now = Date.now();
    window.localStorage.setItem(LESSONS_KEY, JSON.stringify({ v: 1, data: { lessons: { [F3C]: { firstVisitedAt: now - 1000, lastVisitedAt: now - 500, visits: 2 } } } }));
    render(<ReturningLearnerStrip lessons={lessons} />);
    const line = screen.getByTestId('returning-trace');
    expect(line).toHaveClass('h-5');
    const trace = within(line).getByRole('img');
    expect(trace).toHaveAttribute('data-size', 'mini');
    expect(trace).toHaveAttribute('data-tier', '1');
    const tier1Modules = buildCurriculumTotals(curriculumData)[0].modules.length;
    expect(trace).toHaveAccessibleName(`Tier 1: Foundations: 0 of ${tier1Modules} modules done, 1 more opened`);
    expect(line).toHaveTextContent('Tier 1: Foundations');
  });

  it('keeps the trace line empty for a first-time visitor', () => {
    render(<ReturningLearnerStrip lessons={lessons} />);
    const line = screen.getByTestId('returning-trace');
    expect(line).toBeEmptyDOMElement();
    expect(renderToStaticMarkup(<ReturningLearnerStrip lessons={lessons} />)).toContain('data-testid="returning-trace"');
  });

  it('builds the tier for the trace with the same modules and lessons as the dashboard totals', () => {
    for (const tier of buildCurriculumTotals(curriculumData)) {
      const first = tier.modules[0].lessons[0].href;
      const built = tierOfLesson(lessons, first)!;
      expect(built.id).toBe(tier.id);
      expect(built.number).toBe(tier.number);
      expect(built.label).toBe(tier.label);
      expect(built.modules.map((m) => [m.id, m.code, m.lessons.map((l) => `${l.slug} ${l.href}`)])).toEqual(
        tier.modules.map((m) => [m.id, m.code, m.lessons.map((l) => `${l.slug} ${l.href}`)]),
      );
    }
    expect(tierOfLesson(lessons, '/practice')).toBeNull();
  });

  it('keeps fixed card heights, so content arriving after hydration moves nothing', () => {
    const { container } = render(<ReturningLearnerStrip lessons={lessons} />);
    const cards = container.querySelectorAll('[data-card]');
    expect(cards).toHaveLength(2);
    cards.forEach((card) => expect(card).toHaveClass('h-32'));
  });
});

describe('routes strip (G30-PATH-05; NB2 request 3)', () => {
  it('follows LEARNING_ROUTES: one article per route, named by its tagline', () => {
    render(<RoutesStrip routes={routes} />);
    const section = screen.getByRole('region', { name: 'Choose your route' });
    const articles = within(section).getAllByRole('article');
    expect(articles.map((article) => article.getAttribute('data-testid'))).toEqual(LEARNING_ROUTES.map((route) => `home-route-${route.id}`));
    for (const route of routes) {
      const article = screen.getByRole('article', { name: route.tagline });
      expect(within(article).getByText(`${route.name} route`)).toBeInTheDocument();
      expect(within(article).getByText(route.audience)).toBeInTheDocument();
      expect(within(article).getByText(plural(route.lessonCount, 'lesson', 'lessons'))).toBeInTheDocument();
      expect(within(article).getAllByRole('link')).toHaveLength(1);
    }
  });

  it('sends Junior to F1A, Practitioner to the placement quiz and Expert to the expert index, none of them filled', () => {
    render(<RoutesStrip routes={routes} />);
    const card = (name: string) => screen.getByRole('article', { name });
    expect(within(card('Start here')).getByRole('link', { name: 'Begin the Junior route' })).toHaveAttribute('href', F1A);
    expect(within(card('Working DV engineer')).getByRole('link', { name: 'Find your level' })).toHaveAttribute('href', PLACEMENT_QUIZ_HREF);
    expect(within(card('Jump in')).getByRole('link', { name: 'Expert layers' })).toHaveAttribute('href', EXPERT_INDEX_HREF);
    expect(document.querySelectorAll('.sheen-primary')).toHaveLength(0);
  });

  it('links "Compare the routes" to the curriculum page\'s routes section, and only pages that exist', () => {
    render(<RoutesStrip routes={routes} />);
    expect(screen.getByRole('link', { name: 'Compare the routes' })).toHaveAttribute('href', START_HERE_HREF);
    for (const link of screen.getAllByRole('link')) {
      expect(appRouteExists(link.getAttribute('href') ?? ''), link.getAttribute('href') ?? '').toBe(true);
    }
  });
});
