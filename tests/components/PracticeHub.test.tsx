import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import PracticeHub from '@/components/practice/PracticeHub';
import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { getAllLabs, getLabById, labCheckSummary } from '@/lib/lab-registry';
import { labProgressRecords, labRecordId } from '@/lib/learner-store/repositories/labs';
import { getLabLessons, getPracticePages } from '@/lib/practice-links';
import { PRACTICE_SECTION_ID } from '@/lib/site-links';

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

  it('groups items by category and renders cards', () => {
    render(<PracticeHub />);

    const exerciseHeading = screen.getByRole('heading', {
      level: 2,
      name: /exercise/i,
    });
    expect(exerciseHeading).toBeInTheDocument();

    const cardTitles = screen.getAllByRole('heading', { level: 3 });
    expect(cardTitles.length).toBeGreaterThan(0);
    // The old /exercises index redirects here: nothing links to it any more.
    expect(document.querySelector('a[href="/exercises"]')).toBeNull();
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
      const card = within(region).getByRole('link', { name: exercise.title }).closest('li') as HTMLElement;
      expect(within(card).getByText('Learn it in')).toBeInTheDocument();
      expect(within(card).getAllByRole('link').map((a) => a.getAttribute('href'))).toContain(exercise.lessons[0].href);
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
      const heading = screen.getByRole('heading', { level: 4, name: lab.title });
      expect(heading.closest('a')).toBeNull();
      expect(within(heading).queryByRole('link')).toBeNull();
    }
  });

  it('names the lesson behind every available lab and links it', () => {
    render(<PracticeHub />);
    for (const lab of getAllLabs().filter((entry) => entry.status === 'available')) {
      const card = screen.getByRole('link', { name: lab.title }).closest('li') as HTMLElement;
      expect(within(card).getByText('Learn it in')).toBeInTheDocument();
      const hrefs = within(card).getAllByRole('link').map((a) => a.getAttribute('href'));
      expect(hrefs).toContain(getLabLessons(lab)[0].href);
      expect(card).toHaveTextContent(`${labCheckSummary(lab)}. Progress is saved in this browser.`);
      expect(card).not.toHaveTextContent(/sign[ -]in/i);
    }
  });

  it('says how each lab is checked and that progress stays in this browser', () => {
    render(<PracticeHub />);
    const labs = screen.getByRole('region', { name: 'Labs' });
    expect(labs).toHaveTextContent(
      'Guided labs with starter code, step-by-step instructions and reference solutions. Your progress is saved in this browser.',
    );
    expect(labs).not.toHaveTextContent(/sign[ -]in/i);
    for (const id of ['basics-1', 'simple-dut-1']) {
      const card = screen.getByRole('link', { name: getLabById(id)!.title }).closest('li') as HTMLElement;
      expect(card).toHaveTextContent('Auto-checked steps (structural, in your browser). Progress is saved in this browser.');
    }
    const selfChecked = screen.getByRole('link', { name: getLabById('pss-portable-intent')!.title }).closest('li') as HTMLElement;
    expect(selfChecked).toHaveTextContent('Self-checked steps: you mark each one complete. Progress is saved in this browser.');
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
      const card = screen.getByRole('link', { name: lab.title }).closest('li') as HTMLElement;
      expect(card).toContainElement(badges[0]);
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
      const card = link.closest('li') as HTMLElement;
      expect(within(card).getAllByRole('link').map((a) => a.getAttribute('href'))).toContain(page.lessons[0].href);
    }
    const interactive = screen.getByRole('region', { name: 'Interactive models' });
    expect(within(interactive).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(
      pages.filter((page) => page.kind === 'interactive').map((page) => page.title),
    );
  });

  it('links each interview bank to its section of /interview-prep', () => {
    render(<PracticeHub />);
    const region = screen.getByRole('region', { name: 'Interview prep' });
    for (const bank of loadInterviewBanks()) {
      expect(within(region).getByRole('link', { name: bank.title })).toHaveAttribute('href', `/interview-prep#${bank.anchor}`);
    }
    expect(within(region).getByRole('link', { name: 'interview prep page' })).toHaveAttribute('href', '/interview-prep');
  });
});
