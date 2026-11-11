import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import PracticeHub, { PRACTICE_TILE_LIMIT, getPracticeHubData, pairSingleItemSections } from '@/components/practice/PracticeHub';
import { getInterviewPracticeItems, loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { labRowMeta, outcomeLine, tierTitle } from '@/components/practice/practice-hub-data';
import { getAllLabs, getLabById } from '@/lib/lab-registry';
import { labProgressRecords, labRecordId } from '@/lib/learner-store/repositories/labs';
import { getLabLessons, getPracticeLabItems, getPracticePages, type PracticeKind } from '@/lib/practice-links';
import { PRACTICE_SECTION_ID, TIER_LINKS } from '@/lib/site-links';
import { tierOfModuleCode } from '@/lib/tier-colors';
import { siteLabel } from '@/lib/nav-labels';

/** The row or tile of the item whose title link is `name`. */
function itemOf(name: string, scope: HTMLElement = document.body): HTMLElement {
  return within(scope).getByRole('link', { name }).closest('li') as HTMLElement;
}

describe('PracticeHub', () => {
  it('renders the page header: the h1, the lead and the section jump links on the hairline', () => {
    const { container } = render(<PracticeHub />);

    const heading = screen.getByRole('heading', { level: 1, name: /practice hub/i });
    const header = heading.closest('[data-page-header]') as HTMLElement;
    expect(header).not.toBeNull();
    expect(within(header).getByText(/^Labs, exercises, interactive models, tools and interview questions/)).toHaveAttribute(
      'data-page-header-lead',
    );
    expect(within(header).getByRole('navigation', { name: 'Practice sections' })).toBeInTheDocument();
    // One frame: the shell caps the content at 1152 px without a second centred container.
    const shell = container.querySelector('[data-page-shell]') as HTMLElement;
    expect(shell).toHaveAttribute('data-width', 'content');
    expect(shell.querySelector('[data-page-shell-inner]')).not.toHaveClass('mx-auto');
  });

  it('groups items by category: a section per kind, rows for long lists and tiles for short ones', () => {
    const { container } = render(<PracticeHub />);
    expect(screen.getByRole('heading', { level: 2, name: /exercise/i })).toBeInTheDocument();
    for (const section of getPracticeHubData().sections) {
      const region = screen.getByRole('region', { name: section.label });
      const rows = region.querySelectorAll('[data-practice-row]');
      const tiles = region.querySelectorAll('[data-practice-tile]');
      if (section.items.length > PRACTICE_TILE_LIMIT) {
        expect(rows, section.id).toHaveLength(section.items.length);
        expect(tiles, section.id).toHaveLength(0);
      } else {
        expect(tiles, section.id).toHaveLength(section.items.length);
        expect(rows, section.id).toHaveLength(0);
      }
    }
    // Interview banks are rows; nothing is a card inside a card.
    expect(screen.getByRole('region', { name: 'Interview prep' }).querySelectorAll('[data-practice-row]')).toHaveLength(
      loadInterviewBanks().length,
    );
    expect(container.querySelectorAll('[data-card] [data-card]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-card] [data-practice-tile]')).toHaveLength(0);
    // The old /exercises index redirects here: nothing links to it any more.
    expect(document.querySelector('a[href="/exercises"]')).toBeNull();
  });

  it('lists every item once: the jump counts and the rows and tiles equal the data', () => {
    const { container } = render(<PracticeHub />);
    const labs = getPracticeLabItems(getAllLabs());
    const pages = getPracticePages();
    const banks = loadInterviewBanks();
    const expected: Record<string, number> = {
      [PRACTICE_SECTION_ID.labs]: labs.length,
      [PRACTICE_SECTION_ID.interviewPrep]: getInterviewPracticeItems(banks).length,
    };
    const kinds: [PracticeKind, keyof typeof PRACTICE_SECTION_ID][] = [
      ['exercise', 'exercises'],
      ['interactive', 'interactiveModels'],
      ['diagram', 'diagrams'],
      ['chart', 'charts'],
      ['tool', 'tools'],
    ];
    for (const [kind, section] of kinds) expected[PRACTICE_SECTION_ID[section]] = pages.filter((page) => page.kind === kind).length;

    const nav = screen.getByRole('navigation', { name: 'Practice sections' });
    for (const [id, count] of Object.entries(expected)) {
      const jump = nav.querySelector(`a[href="#${id}"]`) as HTMLElement;
      expect(jump, id).not.toBeNull();
      expect(jump.querySelector('span')?.textContent, id).toBe(String(count));
      const region = (container.querySelector(`#${id}`) as HTMLElement).closest('section') as HTMLElement;
      expect(region.querySelectorAll('[data-practice-row], [data-practice-tile]'), id).toHaveLength(count);
    }
    expect(labs.length).toBe(getAllLabs().length);
    expect(container.querySelectorAll('[data-practice-row], [data-practice-tile]')).toHaveLength(
      labs.length + pages.length + banks.length,
    );
  });

  it('groups labs by tier under the tier name and step mark, inside a data-tier scope', () => {
    render(<PracticeHub />);
    const region = screen.getByRole('region', { name: 'Labs' });
    const headings = within(region).getAllByRole('heading', { level: 3 });
    const { labGroups } = getPracticeHubData();
    expect(headings.map((heading) => heading.textContent)).toEqual(labGroups.map((group) => group.title));
    expect(headings[0]).toHaveTextContent(/^Tier 1: Foundations$/);
    for (const group of labGroups) {
      const heading = within(region).getByRole('heading', { level: 3, name: group.title });
      const scope = heading.closest('[data-practice-tier-group]') as HTMLElement;
      expect(scope).toHaveAttribute('data-tier', String(group.tier));
      expect(scope).toHaveClass('glass-quiet', 'tier-edge');
      expect(within(heading).getByTestId('tier-step')).toHaveAttribute('aria-hidden', 'true');
      expect(scope.querySelectorAll('[data-practice-row]')).toHaveLength(group.items.length);
      for (const item of group.items) expect(tierOfModuleCode(item.lessons[0].code)).toBe(group.tier);
      // The tier's name is the manifest's, as in the footer and on the curriculum page.
      expect(TIER_LINKS.map((link) => link.label)).toContain(group.title);
    }
  });

  it('gives every section the id site-links.ts exports, with room under the sticky header', () => {
    const { container } = render(<PracticeHub />);
    for (const [section, id] of Object.entries(PRACTICE_SECTION_ID)) {
      const heading = container.querySelector(`#${id}`);
      expect(heading, section).not.toBeNull();
      expect(heading?.tagName).toBe('H2');
      expect(heading).toHaveClass('scroll-mt-24');
      expect(heading?.closest('section')).toHaveAttribute('aria-labelledby', id);
      // The jump list links to every section.
      expect(container.querySelector(`nav[aria-label="Practice sections"] a[href="#${id}"]`), section).not.toBeNull();
    }
  });

  it('keeps what the old exercises index offered: every exercise with the lesson that teaches it', () => {
    render(<PracticeHub />);
    const region = screen.getByRole('region', { name: 'Exercises' });
    expect(region).toHaveTextContent('Your best score is kept in this browser.');
    for (const exercise of getPracticePages().filter((page) => page.kind === 'exercise')) {
      const tile = itemOf(exercise.title, region);
      const [lesson] = exercise.lessons;
      expect(within(tile).getByRole('link', { name: `${lesson.code}: learn it in ${lesson.title}` })).toHaveAttribute('href', lesson.href);
      expect(tile).toHaveTextContent(outcomeLine(exercise.description));
    }
  });

  it('never links coming-soon labs (their routes 404); only available labs are links', () => {
    render(<PracticeHub />);
    // Every registered lab may be available, so there need not be any coming-soon badge.
    const comingSoon = screen.queryAllByText(/coming soon/i);
    expect(comingSoon.length > 0).toBe(getAllLabs().some((lab) => lab.status === 'coming_soon'));
    comingSoon.forEach((badge) => expect(badge.closest('a')).toBeNull());

    const labLinks = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/practice/lab/'));
    expect(labLinks.length).toBeGreaterThan(0);
    labLinks.forEach((a) =>
      expect(getLabById(a.getAttribute('href')!.replace('/practice/lab/', ''))?.status).toBe('available'),
    );

    for (const lab of getAllLabs().filter((entry) => entry.status === 'coming_soon')) {
      const row = document.querySelector(`[data-practice-row="lab:${lab.id}"]`) as HTMLElement;
      expect(row).toHaveTextContent('Coming soon');
      expect(within(row).queryByRole('link', { name: lab.title })).toBeNull();
    }
  });

  it('gives every available lab one compact row: the teaching lesson\'s tag as a link, the title, one outcome line and its state', () => {
    render(<PracticeHub />);
    for (const lab of getAllLabs().filter((entry) => entry.status === 'available')) {
      const row = itemOf(lab.title);
      expect(row).toHaveAttribute('data-practice-row', `lab:${lab.id}`);
      const lesson = getLabLessons(lab)[0];
      const tag = within(row).getByRole('link', { name: `${lesson.code}: learn it in ${lesson.title}` });
      expect(tag).toHaveAttribute('href', lesson.href);
      expect(tag.querySelector('[data-signal-tag]')).toHaveTextContent(lesson.code);
      expect(within(row).getByRole('link', { name: lab.title })).toHaveAttribute('href', `/practice/lab/${lab.id}`);
      // One line, not the long description, prerequisites or "do this after" notes (those are on the lab page).
      expect(row).toHaveTextContent(outcomeLine(lab.description));
      expect(row).not.toHaveTextContent('Before you start');
      expect(row).not.toHaveTextContent('Do this lab after');
      expect(row).toHaveTextContent(labRowMeta(lab));
      expect(within(row).getAllByRole('link')).toHaveLength(2);
      expect(row).not.toHaveTextContent(/sign[ -]in/i);
    }
  });

  it('says how each lab is checked and that progress stays in this browser', () => {
    render(<PracticeHub />);
    const labs = screen.getByRole('region', { name: 'Labs' });
    expect(labs).toHaveTextContent('Your progress is saved in this browser.');
    expect(labs).not.toHaveTextContent(/sign[ -]in/i);
    for (const id of ['basics-1', 'simple-dut-1']) {
      expect(itemOf(getLabById(id)!.title)).toHaveTextContent(/\d+ steps · auto-checked/);
    }
    expect(itemOf(getLabById('pss-portable-intent')!.title)).toHaveTextContent(/\d+ steps · self-checked/);
  });

  it('shows this browser\'s progress on an available lab card, and nothing before there is any', () => {
    const lab = getLabById('basics-1')!;
    try {
      render(<PracticeHub />);
      expect(screen.queryByTestId('lab-progress-badge')).not.toBeInTheDocument();
      cleanup();

      labProgressRecords.set(labRecordId(lab.id, lab.version), {
        labId: lab.id,
        labVersion: lab.version,
        currentStepId: lab.steps[1].id,
        completedSteps: [lab.steps[0].id],
        stepEvidence: {},
        fileBuffers: {},
        status: 'in_progress',
        startedAt: 1_000,
        updatedAt: 2_000,
      });
      render(<PracticeHub />);
      const badges = screen.getAllByTestId('lab-progress-badge');
      expect(badges).toHaveLength(1);
      const row = itemOf(lab.title);
      expect(row).toContainElement(badges[0]);
      expect(badges[0]).toHaveTextContent(`${lab.title}: In progress · step 2 of ${lab.steps.length}`);
      expect(badges[0].closest('a')).toBeNull();
    } finally {
      // Unmount first, so removing the record does not update a mounted badge outside act().
      cleanup();
      labProgressRecords.remove(labRecordId(lab.id, lab.version));
      window.localStorage.clear();
    }
  });

  it('lists every practice page with its teaching lesson, in curriculum order', () => {
    render(<PracticeHub />);
    const pages = getPracticePages();
    for (const page of pages) {
      const link = screen.getByRole('link', { name: page.title });
      expect(link).toHaveAttribute('href', page.href);
      const item = link.closest('li') as HTMLElement;
      expect(within(item).getAllByRole('link').map((a) => a.getAttribute('href'))).toContain(page.lessons[0].href);
    }
    const interactive = screen.getByRole('region', { name: 'Interactive models' });
    const titles = Array.from(interactive.querySelectorAll('[data-practice-row]')).map(
      (row) => within(row as HTMLElement).getAllByRole('link').at(-1)?.textContent,
    );
    expect(titles).toEqual(pages.filter((page) => page.kind === 'interactive').map((page) => page.title));
  });

  it('links each interview bank to its section of /interview-prep', () => {
    render(<PracticeHub />);
    const region = screen.getByRole('region', { name: 'Interview prep' });
    for (const bank of loadInterviewBanks()) {
      expect(within(region).getByRole('link', { name: bank.title })).toHaveAttribute('href', `/interview-prep#${bank.anchor}`);
      expect(itemOf(bank.title, region)).toHaveTextContent(`${bank.questionCount} questions`);
    }
    // The page link's label comes from the navigation config.
    expect(within(region).getByRole('link', { name: siteLabel('/interview-prep') })).toHaveAttribute(
      'href',
      '/interview-prep',
    );
  });

  it('puts consecutive one-item sections side by side, and nothing else', () => {
    const one = (id: string) => ({ id, items: [0] });
    const many = (id: string) => ({ id, items: [0, 1, 2] });
    expect(pairSingleItemSections([many('a'), one('b'), one('c'), one('d')]).map((row) => row.map((s) => s.id))).toEqual([
      ['a'],
      ['b', 'c'],
      ['d'],
    ]);
    expect(pairSingleItemSections([one('a'), many('b'), one('c')]).map((row) => row.length)).toEqual([1, 1, 1]);
    expect(tierTitle(1)).toBe('Tier 1: Foundations');
  });
});
