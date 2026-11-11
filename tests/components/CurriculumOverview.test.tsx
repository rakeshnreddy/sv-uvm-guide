import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { samePageHash } from '@/components/curriculum/CurriculumBrowser';
import CurriculumOverview from '@/components/curriculum/CurriculumOverview';
import { continueLessons } from '@/lib/continue-lesson-data';
import { curriculumData, findPrevNextTopics } from '@/lib/curriculum-data';
import { PLANNED_MODULES, buildCurriculumOverview, type LessonPosition } from '@/lib/curriculum-overview';
import { readLessonMinutes, readManifestTiers } from '@/lib/curriculum-scan';
import { getAllLabs } from '@/lib/lab-registry';
import { resolveMilestones, resolveRoutes } from '@/lib/learning-paths';
import { ROUTE_STORAGE_KEY } from '@/lib/learning-route-state';
import { tierSectionHref, tierSectionId } from '@/lib/site-links';

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const labs = getAllLabs();
const manifestTiers = readManifestTiers();
const tiers = buildCurriculumOverview({
  data: curriculumData,
  tiers: manifestTiers,
  minutesByLesson: readLessonMinutes(curriculumData),
  labs,
  nextOf: (lesson: LessonPosition) => {
    const next = findPrevNextTopics([lesson.tierId, lesson.moduleId, lesson.lessonSlug]).next;
    if (!next) return undefined;
    const [tierId, moduleId, lessonSlug] = next.slug.split('/');
    return { tierId, moduleId, lessonSlug };
  },
});
const routes = resolveRoutes(curriculumData, { labs });
const milestones = resolveMilestones(labs);

function renderOverview() {
  return render(<CurriculumOverview tiers={tiers} routes={routes} milestones={milestones} planned={PLANNED_MODULES} continueLessons={continueLessons()} />);
}

function visit(moduleId: string, lessonSlug: string, at = 1_000) {
  localStorage.setItem(
    'curriculumProgress',
    JSON.stringify({ [moduleId]: { completedLessons: [], lastVisitedAt: at, lastVisitedLesson: lessonSlug } }),
  );
}

function tierButton(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 3, name: title });
  return within(heading).getByRole('button');
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = '';
});

describe('route chooser', () => {
  it('offers the three routes with their calls to action', () => {
    renderOverview();
    expect(screen.getByRole('heading', { level: 2, name: 'Choose your route' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Start here' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Working DV engineer' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Jump in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Begin the Junior route' })).toHaveAttribute(
      'href',
      '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index',
    );
    expect(screen.getByRole('link', { name: 'Find your level' })).toHaveAttribute('href', '/quiz/placement');
    expect(screen.getByRole('link', { name: 'Expert layers' })).toHaveAttribute('href', '/curriculum/expert-index');
  });

  it('fills only the Junior call to action with the accent; the other routes use the secondary style', () => {
    renderOverview();
    const routes = screen.getByRole('region', { name: 'Choose your route' });
    const filled = Array.from(routes.querySelectorAll('a, button')).filter((el) => el.classList.contains('bg-primary'));
    expect(filled.map((el) => el.textContent)).toEqual(['Begin the Junior route']);
    for (const name of ['Find your level', 'Expert layers']) {
      expect(screen.getByRole('link', { name })).toHaveClass('bg-muted', 'border-border', 'text-foreground');
    }
    expect(screen.getByRole('link', { name: 'Begin the Junior route' })).toHaveClass('forced-colors:border-[ButtonText]');
  });

  it('shows the ordered steps of a followed route and remembers the choice', () => {
    renderOverview();
    const follow = screen.getByRole('button', { name: 'Follow the Junior route' });
    expect(follow).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(follow);
    expect(follow).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(ROUTE_STORAGE_KEY)).toBe('junior');

    const region = screen.getByRole('region', { name: 'The Junior route: 6 steps' });
    const steps = within(region).getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(steps).toEqual([
      'Why verification',
      'The language',
      'Time, races and interfaces',
      'A class-based testbench',
      'Your first UVM testbench',
      'A self-checking UVM environment',
    ]);
    const first = within(region).getAllByRole('listitem').find((li) => li.getAttribute('aria-current') === 'step');
    expect(first).toHaveTextContent('Why verification');
    expect(within(first!).getByRole('link', { name: 'First lesson: F1A: The Cost of Bugs' })).toHaveAttribute(
      'href',
      '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index',
    );

    const lastStep = within(region).getByRole('heading', { level: 4, name: 'A self-checking UVM environment' }).closest('li')!;
    const moduleLinks = within(lastStep).getAllByRole('link').map((a) => a.textContent);
    expect(moduleLinks.indexOf('I-UVM-4: UVM Policy Classes')).toBeLessThan(
      moduleLinks.indexOf('A-UVM-6: Scoreboards and Reference Models'),
    );
    expect(within(region).getByText('Left for later')).toBeInTheDocument();

    fireEvent.click(follow);
    expect(follow).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('region', { name: /The Junior route/ })).not.toBeInTheDocument();
    expect(localStorage.getItem(ROUTE_STORAGE_KEY)).toBeNull();
  });

  it('follows the route named in the URL hash', () => {
    window.location.hash = '#route-practitioner';
    renderOverview();
    expect(screen.getByRole('region', { name: 'The Practitioner route: 6 steps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow the Practitioner route' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the milestone ladder from M0 to M8 and does not link labs that are coming soon', () => {
    renderOverview();
    const ladder = screen.getByRole('region', { name: 'The milestone ladder' });
    const rungs = within(ladder).getAllByRole('listitem');
    expect(rungs).toHaveLength(9);
    expect(rungs[0]).toHaveTextContent('M0');
    expect(within(rungs[0]).getByRole('link')).toHaveAttribute('href', '/practice/lab/simple-dut-1');
    expect(rungs[1]).toHaveTextContent('M1');
    expect(within(rungs[3]).getByRole('link')).toHaveAttribute('href', '/practice/lab/scoreboard-reference-model');
    // Each rung links its lab only while the lab is available.
    resolveMilestones(labs).forEach((milestone, index) => {
      const lab = milestone.lab ? labs.find((entry) => entry.id === milestone.lab!.id) : undefined;
      if (lab?.status === 'available') {
        expect(within(rungs[index]).getByRole('link'), milestone.id).toHaveAttribute('href', `/practice/lab/${lab.id}`);
      } else {
        expect(rungs[index], milestone.id).toHaveTextContent('Lab coming soon');
        expect(within(rungs[index]).queryByRole('link'), milestone.id).not.toBeInTheDocument();
      }
    });
  });
});

describe('modules by tier', () => {
  it('puts each tier heading around its disclosure button, with the manifest audience', () => {
    renderOverview();
    for (const [index, tier] of manifestTiers.entries()) {
      const button = tierButton(tier.title);
      expect(button).toHaveAttribute('aria-expanded', index === 0 ? 'true' : 'false');
      expect(document.getElementById(button.getAttribute('aria-controls')!)).not.toBeNull();
      const section = document.getElementById(`t${index + 1}`)!;
      expect(section).toHaveTextContent(tier.audience);
    }
  });

  it('lists the open tier in manifest order and opens another tier on request', () => {
    renderOverview();
    const t1 = document.getElementById('t1-panel')!;
    const names = within(t1).getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(names.map((n) => n!.split(':')[0])).toEqual(tiers[0].modules.map((m) => m.code));

    fireEvent.click(tierButton('Tier 2: Intermediate'));
    const t2 = document.getElementById('t2-panel')!;
    const upf = within(t2).getByRole('heading', { level: 4, name: /^I-SV-8:/ }).closest('article')!;
    expect(upf).toHaveTextContent('Elective');
    const oop = within(t2).getByRole('heading', { level: 4, name: /^I-SV-1:/ }).closest('article')!;
    expect(oop).not.toHaveTextContent('Elective');
    expect(within(oop).getByRole('link', { name: 'F4B: Bundling Signals with Interfaces and Modports' })).toHaveAttribute(
      'href',
      '/curriculum/T1_Foundational/F4B_Interfaces_and_Modports/index',
    );
  });

  it('opens the tier named in the URL hash', () => {
    window.location.hash = '#t3';
    renderOverview();
    expect(tierButton('Tier 3: Advanced')).toHaveAttribute('aria-expanded', 'true');
  });

  it('gives each tier section the stable id from site-links, with a scroll margin for the sticky header', () => {
    renderOverview();
    for (const tier of manifestTiers) {
      const section = document.getElementById(tierSectionId(tier.id))!;
      expect(section.tagName).toBe('SECTION');
      expect(section).toHaveClass('scroll-mt-24');
      expect(section).toHaveAccessibleName(tier.title);
    }
  });

  it('opens a tier when a link on the page points at its section (no hashchange fires for a client navigation)', () => {
    window.history.pushState({}, '', '/curriculum');
    renderOverview();
    const link = document.createElement('a');
    link.href = tierSectionHref('T4_Expert');
    link.addEventListener('click', (event) => event.preventDefault());
    document.body.appendChild(link);
    expect(tierButton('Tier 4: Expert')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(link);
    expect(tierButton('Tier 4: Expert')).toHaveAttribute('aria-expanded', 'true');
    link.remove();
    window.history.pushState({}, '', '/');
  });

  it('renders module codes, prerequisites and milestones as signal tags', () => {
    renderOverview();
    fireEvent.click(tierButton('Tier 2: Intermediate'));
    const oop = within(document.getElementById('t2-panel')!).getByRole('heading', { level: 4, name: /^I-SV-1:/ }).closest('article')!;
    const tags = Array.from(oop.querySelectorAll('[data-signal-tag]')).map((tag) => tag.textContent);
    expect(tags[0]).toBe('I-SV-1');
    const prerequisite = within(oop).getByRole('link', { name: 'F4B: Bundling Signals with Interfaces and Modports' });
    expect(prerequisite.querySelector('[data-signal-tag]')).toHaveTextContent('F4B');
    // A 40 px target around the small tag.
    expect(prerequisite).toHaveClass('min-h-[40px]');
    const milestones = oop.querySelectorAll('dd ul li [data-signal-tag]');
    for (const tag of Array.from(milestones)) expect(tag.textContent).toMatch(/^(M\d+|[A-Z][\w-]*)$/);
    expect(oop.querySelector('.font-mono:not([data-signal-tag])')).toBeNull();
  });

  it('opens every tier with a search match and says how many modules match', () => {
    renderOverview();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search modules and lessons' }), {
      target: { value: 'mailbox' },
    });
    expect(screen.getByText(/modules? match(es)? “mailbox”/)).toBeInTheDocument();
    expect(tierButton('Tier 2: Intermediate')).toHaveAttribute('aria-expanded', 'true');
    expect(within(document.getElementById('t2-panel')!).getByRole('heading', { level: 4, name: /^I-SV-5:/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(tierButton('Tier 2: Intermediate')).toHaveAttribute('aria-expanded', 'false');
  });

  it('lists a module’s lessons on request', () => {
    renderOverview();
    const f2d = within(document.getElementById('t1-panel')!)
      .getByRole('heading', { level: 4, name: /^F2D:/ })
      .closest('article')!;
    const toggle = within(f2d).getByRole('button', { name: 'Lessons in this module (3)' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(within(list).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/index',
      '/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/tasks-functions',
      '/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/ipc',
    ]);
  });

  it('draws the curriculum map with a link per module and planned modules as text', () => {
    renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
    const map = screen.getByRole('group', { name: 'Curriculum map' });
    const links = within(map).getAllByRole('link');
    expect(links).toHaveLength(tiers.reduce((n, t) => n + t.modules.length, 0));
    expect(within(map).queryAllByText('Planned')).toHaveLength(PLANNED_MODULES.length);
    const f2d = links.find((a) => a.getAttribute('href') === '/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/index')!;
    expect(f2d).toHaveAccessibleDescription(/Needs F2C\. Unlocks F2E, F3A, F4A/);
    act(() => {
      f2d.focus();
    });
    const f2c = links.find((a) => a.getAttribute('href')?.includes('F2C_'))!;
    expect(f2c).toHaveTextContent('Needed first');
  });
});

describe('pick up where you left off', () => {
  it('renders nothing for a first visit', () => {
    renderOverview();
    expect(screen.queryByRole('heading', { name: 'Pick up where you left off' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Recommended For You/i)).not.toBeInTheDocument();
  });

  it('continues the lesson opened last while it is not marked done (F2D/ipc)', async () => {
    visit('F2D_Reusable_Code_and_Parallelism', 'ipc');
    renderOverview();
    const resume = await screen.findByRole('region', { name: 'Pick up where you left off' });
    const action = within(resume).getByTestId('curriculum-continue');
    expect(action).toHaveAttribute('href', '/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/ipc');
    expect(action).toHaveAccessibleName(/^Continue F2D: /);
    expect(action).toHaveTextContent(/^Continue F2D: /);
    expect(within(resume).getByText('The lesson you opened last.')).toBeInTheDocument();
    expect(within(resume).getByRole('heading', { name: 'Recently visited' })).toBeInTheDocument();
    expect(within(resume).getByRole('link', { name: 'F2D: Interprocess Communication' })).toBeInTheDocument();
    const here = within(document.getElementById('t1-panel')!).getByRole('link', { name: /^F2D:/, current: 'location' });
    expect(here.closest('article')).toHaveTextContent('You are here');
    // The continue action holds the one accent fill; the Junior call to action steps down.
    const filled = Array.from(document.querySelectorAll('a, button')).filter((el) =>
      el.classList.contains('bg-primary'),
    );
    expect(filled).toEqual([action]);
    expect(screen.getByRole('link', { name: 'Begin the Junior route' })).toHaveClass('bg-muted');
  });

  it('moves to the lesson after the one opened last once it is marked done (F2D/ipc -> F2E)', async () => {
    localStorage.setItem(
      'curriculumProgress',
      JSON.stringify({
        F2D_Reusable_Code_and_Parallelism: { completedLessons: ['ipc'], lastVisitedAt: 1_000, lastVisitedLesson: 'ipc' },
      }),
    );
    renderOverview();
    const resume = await screen.findByRole('region', { name: 'Pick up where you left off' });
    const action = within(resume).getByTestId('curriculum-continue');
    expect(action).toHaveAttribute('href', '/curriculum/T1_Foundational/F2E_First_Self_Checking_Testbench/index');
    expect(action).toHaveAccessibleName(/^Continue F2E: /);
    expect(within(resume).getByText(/^The lesson after F2D: .*, which you marked done\.$/)).toBeInTheDocument();
  });

  it('shows the next lesson on the followed route once, and marks the current step', async () => {
    localStorage.setItem(ROUTE_STORAGE_KEY, 'junior');
    visit('F2D_Reusable_Code_and_Parallelism', 'ipc');
    renderOverview();
    const resume = await screen.findByRole('region', { name: 'Pick up where you left off' });
    expect(within(resume).getByText('Next on your Junior route')).toBeInTheDocument();
    // Continue (the lesson opened last) and the route's next lesson are two links; only Continue is filled.
    expect(within(resume).getByTestId('curriculum-continue')).toHaveClass('bg-primary');
    expect(screen.getAllByRole('link', { name: /^Continue with F2E: / })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /^Continue with F2E: / })).not.toHaveClass('bg-primary');
    const steps = screen.getByRole('region', { name: 'The Junior route: 6 steps' });
    const current = within(steps).getAllByRole('listitem').find((li) => li.getAttribute('aria-current') === 'step');
    // F2E closes the language step, so the learner is still in it.
    expect(current).toHaveTextContent('The language');
    expect(current).toHaveTextContent('You are here');
    expect(within(current!).getByRole('link', { name: /^Next lesson: F2E: / })).toBeInTheDocument();
  });
});

it('adds no main landmark or h1 of its own', () => {
  const { container } = renderOverview();
  expect(container.querySelector('main')).toBeNull();
  expect(container.querySelector('h1')).toBeNull();
});

describe('samePageHash', () => {
  const here = { href: 'https://example.test/curriculum', pathname: '/curriculum' };

  it('returns the hash of a link to a section of this page', () => {
    expect(samePageHash('/curriculum#t3', here)).toBe('#t3');
    expect(samePageHash('#t2', here)).toBe('#t2');
    expect(samePageHash('/curriculum/#t1', here)).toBe('#t1');
  });

  it('returns null for other pages, other sites and links without a hash', () => {
    expect(samePageHash('/practice#labs', here)).toBeNull();
    expect(samePageHash('https://elsewhere.test/curriculum#t3', here)).toBeNull();
    expect(samePageHash('/curriculum', here)).toBeNull();
  });
});
