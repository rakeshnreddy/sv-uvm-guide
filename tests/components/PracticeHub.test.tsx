import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import PracticeHub from '@/components/practice/PracticeHub';
import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { getAllLabs, getLabById, labCheckSummary } from '@/lib/lab-registry';
import { labProgressRecords, labRecordId } from '@/lib/learner-store/repositories/labs';
import { getLabLessons, getPracticePages } from '@/lib/practice-links';

describe('PracticeHub', () => {
  it('renders hero section with title and description', () => {
    render(<PracticeHub />);

    expect(
      screen.getByRole('heading', { level: 1, name: /practice hub/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/sharpen your systemverilog/i)).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'exercises page' })).toHaveAttribute('href', '/exercises');
  });

  it('never links coming-soon labs (their routes 404); only available labs are links', () => {
    render(<PracticeHub />);
    const comingSoon = screen.getAllByText(/coming soon/i);
    expect(comingSoon.length).toBeGreaterThan(0);
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
